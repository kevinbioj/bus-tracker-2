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
	/** Courses dont deux entités publient des tracés concurrents : aucun ne vaut pour l'ensemble. */
	const conflictingShapeKeys = new Set<string>();

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
					const journeyKey = getJourneyKey(date, tripId);
					const existing = plans.get(journeyKey);

					// La spec l'interdit — « a trip MUST NOT be assigned to more than one TripModifications
					// object » —, mais des producteurs publient une entité par déviation. Elles décrivent
					// alors ensemble la desserte de la course : n'en retenir qu'une, comme le faisait
					// l'affectation directe, revenait à ignorer silencieusement toutes les autres.
					if (existing !== undefined) {
						existing.modificationsIds.push(entity.id);
						existing.modifications.push(...resolvedModifications);
						existing.revision = `${existing.revision}&${revision}`;

						// Chaque entité publie le tracé de la course telle qu'elle seule la dévie : celui-ci
						// emprunte l'itinéraire d'origine là où une autre entité l'abandonne. Deux tracés
						// concurrents ne décrivent donc ni l'un ni l'autre la desserte fusionnée, et y
						// reprojeter les arrêts donnerait des distances aberrantes. La course s'en tient
						// alors à son tracé théorique, comme pour une déviation qui n'en publie aucun.
						if (shape !== undefined && existing.shape !== undefined && existing.shape.id !== shape.id) {
							conflictingShapeKeys.add(journeyKey);
						}
						if (!conflictingShapeKeys.has(journeyKey)) existing.shape ??= shape;
						else existing.shape = undefined;
						continue;
					}

					plans.set(journeyKey, {
						modificationsIds: [entity.id],
						tripId,
						date,
						shape,
						// Copiées : les modifications d'une autre entité viendront s'y ajouter.
						modifications: [...resolvedModifications],
						revision,
					});
				}
			}
		}
	}

	return plans;
}
