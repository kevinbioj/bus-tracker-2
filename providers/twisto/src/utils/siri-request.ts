import { XMLParser } from "fast-xml-parser";
import ky from "ky";

import { apiKey } from "../config.js";

const parser = new XMLParser({
	removeNSPrefix: true,
});

export async function siriRequest(endpoint: string, body: string) {
	const response = await ky.post(endpoint, {
		body,
		headers: {
			"Content-Type": "application/xml",
			"X-Gravitee-Api-Key": apiKey,
		},
	});

	if (!response.ok) {
		throw new Error(`Request to '${endpoint}' has failed (status ${response.status})`);
	}

	const serializedXml = await response.text();
	return parser.parse(serializedXml);
}
