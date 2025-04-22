import { XMLParser } from "fast-xml-parser";
import { Temporal } from "temporal-polyfill";
import type { SiriResponse, SiriVehicleJourney } from "./types.js";

const ET_BODY = () => {
	const now = Temporal.Now.instant();
	return `
    <S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/" xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
      <S:Body>
        <sw:GetEstimatedTimetable xmlns:sw="http://wsdl.siri.org.uk" xmlns:siri="http://www.siri.org.uk/siri">
          <ServiceRequestInfo>
            <siri:RequestTimestamp>${now}</siri:RequestTimestamp>
            <siri:RequestorRef>open-data</siri:RequestorRef>
            <siri:MessageIdentifier>BUS-TRACKER.FR:${now}</siri:MessageIdentifier>
          </ServiceRequestInfo>
          <Request>
            <siri:RequestTimestamp>${now}</siri:RequestTimestamp>
            <siri:MessageIdentifier>BUS-TRACKER.FR:${now}</siri:MessageIdentifier>
            <siri:Lines>
              <siri:LineDirection>
                <siri:LineRef>C1</siri:LineRef>
              </siri:LineDirection>
              <siri:LineDirection>
                <siri:LineRef>C2</siri:LineRef>
              </siri:LineDirection>
              <siri:LineDirection>
                <siri:LineRef>C3</siri:LineRef>
              </siri:LineDirection>
              <siri:LineDirection>
                <siri:LineRef>C4</siri:LineRef>
              </siri:LineDirection>
              <siri:LineDirection>
                <siri:LineRef>C5</siri:LineRef>
              </siri:LineDirection>
              <siri:LineDirection>
                <siri:LineRef>C6</siri:LineRef>
              </siri:LineDirection>
              <siri:LineDirection>
                <siri:LineRef>15</siri:LineRef>
              </siri:LineDirection>
              <siri:LineDirection>
                <siri:LineRef>16</siri:LineRef>
              </siri:LineDirection>
              <siri:LineDirection>
                <siri:LineRef>17</siri:LineRef>
              </siri:LineDirection>
              <siri:LineDirection>
                <siri:LineRef>18</siri:LineRef>
              </siri:LineDirection>
              <siri:LineDirection>
                <siri:LineRef>19</siri:LineRef>
              </siri:LineDirection>
              <siri:LineDirection>
                <siri:LineRef>20</siri:LineRef>
              </siri:LineDirection>
              <siri:LineDirection>
                <siri:LineRef>21</siri:LineRef>
              </siri:LineDirection>
              <siri:LineDirection>
                <siri:LineRef>23</siri:LineRef>
              </siri:LineDirection>
              <siri:LineDirection>
                <siri:LineRef>24</siri:LineRef>
              </siri:LineDirection>
              <siri:LineDirection>
                <siri:LineRef>26</siri:LineRef>
              </siri:LineDirection>
              <siri:LineDirection>
                <siri:LineRef>N1</siri:LineRef>
              </siri:LineDirection>
              <siri:LineDirection>
                <siri:LineRef>N2</siri:LineRef>
              </siri:LineDirection>
              <siri:LineDirection>
                <siri:LineRef>S</siri:LineRef>
              </siri:LineDirection>
            </siri:Lines>
          </Request>
          <RequestExtension/>
        </sw:GetEstimatedTimetable>
      </S:Body>
    </S:Envelope>`;
};

const parser = new XMLParser({
	removeNSPrefix: true,
});

export async function fetchSiriData() {
	const response = await fetch("https://ara-api.enroute.mobi/dkbus/siri", {
		body: ET_BODY(),
		method: "POST",
	});

	const rawData = await response.text();
	const payload = (await parser.parse(rawData)) as SiriResponse;

	const rawFrames =
		payload.Envelope.Body.GetEstimatedTimetableResponse.Answer.EstimatedTimetableDelivery.EstimatedJourneyVersionFrame;
	const frames = rawFrames ? (Array.isArray(rawFrames) ? rawFrames : [rawFrames]) : undefined;

	const journeyMap = new Map<number, { recordedAt: Temporal.Instant; journey: SiriVehicleJourney }>();
	if (!frames) return journeyMap;

	for (const frame of frames) {
		if (!frame.EstimatedVehicleJourney) continue;

		const recordedAt = Temporal.Instant.from(frame.RecordedAtTime);
		const journeys = Array.isArray(frame.EstimatedVehicleJourney)
			? frame.EstimatedVehicleJourney
			: [frame.EstimatedVehicleJourney];

		for (const journey of journeys) {
			journeyMap.set(journey.DatedVehicleJourneyRef, {
				recordedAt,
				journey,
			});
		}
	}

	return journeyMap;
}
