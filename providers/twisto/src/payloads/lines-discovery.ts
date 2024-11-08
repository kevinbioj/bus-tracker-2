import { randomUUID } from "node:crypto";
import { Temporal } from "temporal-polyfill";

import { requestorRef } from "../config.js";

export const LINES_DISCOVERY = () =>
	`<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/" xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
    <S:Body>
        <sw:LinesDiscovery xmlns:sw="http://wsdl.siri.org.uk" xmlns:siri="http://www.siri.org.uk/siri">
            <Request>
                <siri:RequestTimestamp>${Temporal.Now.instant()}</siri:RequestTimestamp>
                <siri:RequestorRef>${requestorRef}</siri:RequestorRef>
                <siri:MessageIdentifier>${randomUUID()}</siri:MessageIdentifier>
            </Request>
            <RequestExtension/>
        </sw:LinesDiscovery>
    </S:Body>
  </S:Envelope>`;
