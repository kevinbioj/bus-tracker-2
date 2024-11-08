import { randomUUID } from "node:crypto";
import { Temporal } from "temporal-polyfill";

import { requestorRef } from "../config.js";

export const GET_VEHICLE_MONITORING = (lineRefs: string[]) => {
	const now = Temporal.Now.instant();
	const messageIdentifier = randomUUID();

	return `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/" xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
    <S:Body>
        <sw:GetVehicleMonitoring xmlns:sw="http://wsdl.siri.org.uk" xmlns:siri="http://www.siri.org.uk/siri">
            <ServiceRequestInfo>
                <siri:RequestTimestamp>${now}</siri:RequestTimestamp>
                <siri:RequestorRef>${requestorRef}</siri:RequestorRef>
                <siri:MessageIdentifier>${messageIdentifier}</siri:MessageIdentifier>
            </ServiceRequestInfo>
            <Request version="2.0:FR-IDF-2.4">
                <siri:RequestTimestamp>${now}</siri:RequestTimestamp>
                <siri:MessageIdentifier>${messageIdentifier}</siri:MessageIdentifier>
                ${lineRefs.map((lineRef) => `<siri:LineRef>${lineRef}</siri:LineRef>`).join("")}
            </Request>
            <RequestExtension/>
        </sw:GetVehicleMonitoring>
    </S:Body>
  </S:Envelope>`;
};
