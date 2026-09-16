import type { Gtfs } from "../model/gtfs.js";
import { getJourneyKey } from "../model/gtfs.js";
import type { IdentifiedTripModifications } from "../model/gtfs-rt.js";
import { type RealtimeResources, resolveShape, resolveStop } from "../model/realtime-lookup.js";
import type { ResolvedModification, TripModificationPlan } from "../model/trip-modification.js";

/**
 * Indexe les déviations du cycle par course et par date de service, sous la même clé que
 * {@link Gtfs.journeys}. Les arrêts et tracés qu'elles désignent sont résolus une fois pour toutes,
 * qu'ils proviennent du GTFS statique ou du flux temps réel lui-même.
 */
export function indexTripModifications(
	gtfs: Gtfs,
	tripModifications: IdentifiedTripModifications[],
	resources: RealtimeResources,
) {
	const plans = new Map<string, TripModificationPlan>();

	for (const entity of tripModifications) {
		const modifications = entity.modifications ?? [];

		const dates: Temporal.PlainDate[] = [];
		for (const serviceDate of entity.serviceDates ?? []) {
			try {
				// La spec impose YYYYMMDD ; Temporal accepte aussi la forme étendue des producteurs laxistes.
				dates.push(Temporal.PlainDate.from(serviceDate));
			} catch {
				// Date illisible : les autres dates de l'entité restent exploitables.
			}
		}
		if (dates.length === 0) continue;

		for (const selectedTrips of entity.selectedTrips ?? []) {
			const tripIds = selectedTrips.tripIds ?? [];
			if (tripIds.length === 0) continue;

			const shape = resolveShape(gtfs, resources, selectedTrips.shapeId);

			// Une déviation peut ne rien changer à la desserte et se contenter de faire emprunter un autre
			// tracé : `modifications` est alors vide, et c'est `selected_trips.shape_id` qui porte tout.
			// Sans l'un ni l'autre, l'entité ne décrit rien d'exploitable.
			if (modifications.length === 0 && shape === undefined) continue;

			const resolvedModifications = modifications.map<ResolvedModification>((modification) => ({
				startStopSelector: modification.startStopSelector,
				endStopSelector: modification.endStopSelector,
				propagatedModificationDelayMs: (modification.propagatedModificationDelay ?? 0) * 1000,
				replacementStops: (modification.replacementStops ?? []).flatMap((replacementStop) => {
					const stop = resolveStop(gtfs, resources, replacementStop.stopId);
					if (stop === undefined) return [];
					return { stop, travelTimeToStopMs: (replacementStop.travelTimeToStop ?? 0) * 1000 };
				}),
			}));

			// Calculée une fois par groupe : une déviation vise couramment des centaines de courses.
			const revision = `${entity.id}|${selectedTrips.shapeId ?? ""}|${JSON.stringify(modifications)}`;

			for (const tripId of tripIds) {
				if (!gtfs.trips.has(tripId)) continue;

				for (const date of dates) {
					plans.set(getJourneyKey(date, tripId), {
						modificationsId: entity.id,
						tripId,
						date,
						shape,
						modifications: resolvedModifications,
						revision,
					});
				}
			}
		}
	}

	return plans;
}
