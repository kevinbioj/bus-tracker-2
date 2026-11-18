export const RESOURCE_KINDS = ["network", "line", "lineAlerts", "vehicle", "journey", "stopDepartures"] as const;

export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export const NETWORKS_URI = "bus-tracker://networks";

export const uriTemplates: Record<ResourceKind, string> = {
	network: "bus-tracker://networks/{networkId}",
	line: "bus-tracker://lines/{lineId}",
	lineAlerts: "bus-tracker://lines/{lineId}/alerts",
	vehicle: "bus-tracker://vehicles/{vehicleId}",
	journey: "bus-tracker://journeys/{journeyId}",
	stopDepartures: "bus-tracker://stops/{stopRef}/departures",
};

const patterns: Record<ResourceKind, RegExp> = {
	network: /^bus-tracker:\/\/networks\/(\d+)$/,
	line: /^bus-tracker:\/\/lines\/(\d+)$/,
	lineAlerts: /^bus-tracker:\/\/lines\/(\d+)\/alerts$/,
	vehicle: /^bus-tracker:\/\/vehicles\/(\d+)$/,
	journey: /^bus-tracker:\/\/journeys\/([^/]+)$/,
	stopDepartures: /^bus-tracker:\/\/stops\/([^/]+)\/departures$/,
};

export function resourceUri(kind: ResourceKind, id: string | number) {
	return uriTemplates[kind].replace(/\{\w+\}/, encodeURIComponent(String(id)));
}

const safeDecode = (value: string) => {
	try {
		return decodeURIComponent(value);
	} catch {
		return undefined;
	}
};

export function parseResourceUri(uri: string): { kind: ResourceKind; id: string } | undefined {
	for (const kind of RESOURCE_KINDS) {
		const encodedId = patterns[kind].exec(uri)?.[1];
		if (encodedId === undefined) continue;
		const id = safeDecode(encodedId);
		return id !== undefined ? { kind, id } : undefined;
	}
	return undefined;
}
