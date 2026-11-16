import type { VehicleJourneyLineType } from "@bus-tracker/contracts";
import dayjs from "dayjs";

import type { Line, Network } from "~/api/networks";
import * as m from "~/paraglide/messages";
import { getLocale } from "~/paraglide/runtime";

const MAX_LISTED_NETWORK_NAMES = 6;

const modeLabels: Record<Exclude<VehicleJourneyLineType, "UNKNOWN">, () => string> = {
	BUS: m.network_modes_bus,
	TROLLEY: m.network_modes_trolley,
	COACH: m.network_modes_coach,
	FERRY: m.network_modes_ferry,
	RAIL: m.network_modes_rail,
	SUBWAY: m.network_modes_subway,
	TRAMWAY: m.network_modes_tramway,
	FUNICULAR: m.network_modes_funicular,
	GONDOLA: m.network_modes_gondola,
};

export const isActiveLine = ({ archivedAt }: Pick<Line, "archivedAt">) =>
	archivedAt === null || dayjs().isBefore(archivedAt);

export const getNetworkLabel = ({ name, authority }: Pick<Network, "name" | "authority">) => {
	const trimmedAuthority = authority?.trim();
	return trimmedAuthority ? `${name} (${trimmedAuthority})` : name;
};

export const formatNetworkModes = (lines: Pick<Line, "archivedAt" | "type">[]) => {
	const lineCountByMode = new Map<keyof typeof modeLabels, number>();
	for (const line of lines) {
		if (line.type === null || line.type === "UNKNOWN" || !isActiveLine(line)) continue;
		lineCountByMode.set(line.type, (lineCountByMode.get(line.type) ?? 0) + 1);
	}

	if (lineCountByMode.size === 0) return m.network_modes_fallback();

	const modes = Array.from(lineCountByMode)
		.toSorted(([, a], [, b]) => b - a)
		.map(([mode]) => modeLabels[mode]());
	return new Intl.ListFormat(getLocale(), { type: "conjunction" }).format(modes);
};

export const formatNetworkNames = (networks: Pick<Network, "name">[]) => {
	const names = networks.map(({ name }) => name);
	return names.length > MAX_LISTED_NETWORK_NAMES
		? `${names.slice(0, MAX_LISTED_NETWORK_NAMES).join(", ")}…`
		: new Intl.ListFormat(getLocale(), { type: "conjunction" }).format(names);
};
