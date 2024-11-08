import { siriEndpoint } from "../config.js";
import { LINES_DISCOVERY } from "../payloads/lines-discovery.js";
import { siriRequest } from "../utils/siri-request.js";

type AnnotatedLine = { LineRef: string; Monitored: boolean };

export async function fetchMonitoredLines() {
	const siriResponse = await siriRequest(siriEndpoint, LINES_DISCOVERY());

	const annotatedLines = siriResponse?.Envelope?.Body?.LinesDiscoveryResponse?.Answer?.AnnotatedLineRef as
		| AnnotatedLine[]
		| AnnotatedLine
		| undefined;

	if (typeof annotatedLines === "undefined") return [];

	return (Array.isArray(annotatedLines) ? annotatedLines : [annotatedLines])
		.filter(({ Monitored }) => Monitored)
		.map(({ LineRef }) => LineRef);
}
