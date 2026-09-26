import type { ServiceAlertCause, ServiceAlertEffect, TranslatedText } from "@bus-tracker/contracts";
import { queryOptions } from "@tanstack/react-query";

import { client } from "./client";

export type ServiceAlert = {
	id: string;
	cause?: ServiceAlertCause;
	effect?: ServiceAlertEffect;
	/** Vide : l'alerte vaut tant qu'elle est publiée. */
	activePeriods: { start?: string; end?: string }[];
	header: TranslatedText;
	/** HTML venu du producteur : à assainir avant tout rendu. */
	description?: TranslatedText;
	url?: TranslatedText;
};

type ServiceAlerts = { items: ServiceAlert[] };

/**
 * L'info trafic change peu : une minute suffit, là où les passages sont sondés toutes les 5 s. Le
 * serveur ne la rafraîchit lui-même que toutes les 30 s.
 */
const serviceAlertsQueryOptions = {
	retry: false,
	refetchInterval: 60_000,
	staleTime: 30_000,
} as const;

export const GetStopAlertsQuery = (stopRef: string | null) =>
	queryOptions({
		...serviceAlertsQueryOptions,
		enabled: stopRef !== null,
		queryKey: ["service-alerts", "stop", stopRef],
		queryFn: () =>
			client
				.get(`/stops/${encodeURIComponent(stopRef!)}/alerts`)
				.then((response) => response.json<ServiceAlerts>())
				.then(({ items }) => items),
	});

export const GetVehicleJourneyAlertsQuery = (journeyId: string) =>
	queryOptions({
		...serviceAlertsQueryOptions,
		queryKey: ["service-alerts", "vehicle-journey", journeyId],
		queryFn: () =>
			client
				.get(`/vehicle-journeys/${encodeURIComponent(journeyId)}/alerts`)
				.then((response) => response.json<ServiceAlerts>())
				.then(({ items }) => items),
	});

export const GetLineAlertsQuery = (lineId: number) =>
	queryOptions({
		...serviceAlertsQueryOptions,
		queryKey: ["service-alerts", "line", lineId],
		queryFn: () =>
			client
				.get(`/lines/${lineId}/alerts`)
				.then((response) => response.json<ServiceAlerts>())
				.then(({ items }) => items),
	});
