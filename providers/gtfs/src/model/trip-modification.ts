import type { StopSelector } from "./gtfs-rt.js";
import type { JourneyCall } from "./journey.js";
import type { Shape } from "./shape.js";
import type { Stop } from "./stop.js";

/** Un arrêt de déviation, dont l'arrêt et le temps de parcours sont déjà résolus. */
export type ResolvedReplacementStop = {
	stop: Stop;
	/** Écart avec l'heure d'arrivée à l'arrêt de référence, en millisecondes. */
	travelTimeToStopMs: number;
};

export type ResolvedModification = {
	startStopSelector?: StopSelector;
	/** Inclusif. Absent : la modification n'insère que des arrêts, sans en retirer aucun. */
	endStopSelector?: StopSelector;
	propagatedModificationDelayMs: number;
	replacementStops: ResolvedReplacementStop[];
};

/**
 * Déviation applicable à une course d'une date donnée. Les arrêts et le tracé y sont déjà résolus :
 * {@link buildModifiedCalls} est ainsi une fonction pure, appelable depuis le calcul paresseux des
 * arrêts d'une course sans lui donner accès au GTFS.
 */
export type TripModificationPlan = {
	/** Identifiant de la `FeedEntity` porteuse, cible de `modified_trip.modifications_id`. */
	modificationsId: string;
	tripId: string;
	date: Temporal.PlainDate;
	shape?: Shape;
	modifications: ResolvedModification[];
	/** Empreinte du contenu : un changement impose de recalculer les arrêts de la course. */
	revision: string;
};

/**
 * Localise l'arrêt désigné par un sélecteur parmi les arrêts théoriques, à partir de `from`.
 * Les sélecteurs portent sur la numérotation d'origine du GTFS statique, jamais sur celle,
 * renumérotée, de la course modifiée.
 */
function findStopIndex(calls: JourneyCall[], selector: StopSelector | undefined, from: number) {
	if (selector === undefined) return;

	for (let index = Math.max(0, from); index < calls.length; index++) {
		const call = calls[index]!;
		if (selector.stopSequence !== undefined) {
			if (call.sequence === selector.stopSequence) return index;
		} else if (selector.stopId !== undefined && call.stop.id === selector.stopId) {
			return index;
		}
	}

	return;
}

/**
 * Portions de la desserte théorique que la déviation fait abandonner à la course, exprimées en
 * couples d'indices `[début, fin]` dans `scheduledCalls` : l'arrêt encore desservi qui précède
 * chaque modification, et le premier qui la suit. C'est entre ces deux arrêts que le véhicule
 * quitte puis retrouve son itinéraire.
 *
 * Retourne un tableau vide lorsque la déviation n'ôte aucun arrêt, ou lorsqu'un de ses sélecteurs
 * ne désigne rien — auquel cas {@link buildModifiedCalls} l'écarte également.
 */
export function computeCancelledCallRanges(scheduledCalls: JourneyCall[], plan: TripModificationPlan) {
	const ranges: [number, number][] = [];
	let cursor = 0;

	for (const modification of plan.modifications) {
		const startIndex = findStopIndex(scheduledCalls, modification.startStopSelector, cursor);
		if (startIndex === undefined) return [];

		if (modification.endStopSelector === undefined) {
			// La modification n'insère que des arrêts : l'itinéraire d'origine reste entièrement desservi.
			cursor = startIndex;
			continue;
		}

		const endIndex = findStopIndex(scheduledCalls, modification.endStopSelector, startIndex);
		if (endIndex === undefined) return [];
		cursor = endIndex + 1;

		// Aux extrémités de la course, l'arrêt retiré lui-même sert de borne, faute de voisin desservi.
		ranges.push([Math.max(0, startIndex - 1), Math.min(scheduledCalls.length - 1, endIndex + 1)]);
	}

	return ranges;
}

/** Décale les heures théoriques d'un arrêt du retard propagé accumulé jusqu'ici. */
function shiftCall(call: JourneyCall, delayMs: number): JourneyCall {
	if (delayMs === 0) return call;

	return {
		...call,
		aimedArrivalTime: call.aimedArrivalTime + delayMs,
		aimedDepartureTime: call.aimedDepartureTime + delayMs,
	};
}

/**
 * Applique une déviation aux arrêts théoriques d'une course.
 *
 * Les arrêts retirés sont conservés dans la liste, marqués supprimés : l'usager doit voir quels
 * arrêts la déviation lui fait perdre, comme pour un `SKIPPED` ordinaire. Les arrêts de
 * remplacement les suivent, marqués desserte supplémentaire. La numérotation finale est refaite de
 * 1 à n, ce qu'exige la spec et ce sur quoi s'alignent les `stop_time_update` d'un TripUpdate
 * rattaché à la course modifiée.
 *
 * @returns undefined si un sélecteur ne désigne aucun arrêt : la course reste alors théorique,
 * mieux vaut un horaire non dévié qu'un horaire tronqué au mauvais endroit.
 */
export function buildModifiedCalls(scheduledCalls: JourneyCall[], plan: TripModificationPlan) {
	if (scheduledCalls.length === 0) return;

	const calls: JourneyCall[] = [];
	let cursor = 0;
	let delayMs = 0;

	for (const modification of plan.modifications) {
		const startIndex = findStopIndex(scheduledCalls, modification.startStopSelector, cursor);
		if (startIndex === undefined) return;

		const endIndex =
			modification.endStopSelector !== undefined
				? findStopIndex(scheduledCalls, modification.endStopSelector, startIndex)
				: undefined;
		if (modification.endStopSelector !== undefined && endIndex === undefined) return;

		// Les arrêts que la modification ne touche pas sont repris tels quels.
		for (let index = cursor; index < startIndex; index++) {
			calls.push(shiftCall(scheduledCalls[index]!, delayMs));
		}

		// Arrêt de référence des temps de parcours : celui qui précède la modification, ou le premier
		// arrêt de la course lorsque c'est lui qu'elle affecte (spec).
		const previousCall = calls.findLast((call) => call.modification !== "REMOVED");
		const referenceCall = previousCall ?? shiftCall(scheduledCalls[startIndex]!, delayMs);

		if (endIndex !== undefined) {
			for (let index = startIndex; index <= endIndex; index++) {
				calls.push({ ...shiftCall(scheduledCalls[index]!, delayMs), status: "SKIPPED", modification: "REMOVED" });
			}
			cursor = endIndex + 1;
		} else {
			cursor = startIndex;
		}

		for (const { stop, travelTimeToStopMs } of modification.replacementStops) {
			const timeMs = referenceCall.aimedArrivalTime + travelTimeToStopMs;
			calls.push({
				aimedArrivalTime: timeMs,
				expectedArrivalTime: timeMs,
				aimedDepartureTime: timeMs,
				expectedDepartureTime: timeMs,
				stop,
				sequence: 0,
				platform: stop.platformCode,
				status: "UNSCHEDULED",
				modification: "ADDED",
				flags: [],
			});
		}

		// Les retards propagés de modifications successives se cumulent au fil de la course.
		delayMs += modification.propagatedModificationDelayMs;
	}

	for (let index = cursor; index < scheduledCalls.length; index++) {
		calls.push(shiftCall(scheduledCalls[index]!, delayMs));
	}

	// Aucun arrêt desservi : la déviation viderait la course, l'horaire théorique reste préférable.
	if (!calls.some((call) => call.modification !== "REMOVED")) return;

	const shape = plan.shape;
	// La renumérotation n'a lieu que si la desserte a changé : une déviation qui ne fait qu'emprunter
	// un autre tracé laisse les séquences du GTFS statique, seules références des `stop_time_update`.
	const renumber = calls.some((call) => call.modification !== undefined);

	for (let index = 0; index < calls.length; index++) {
		const call = calls[index]!;
		// Renumérotation de 1 à n, arrêts retirés compris : `stopOrder` reste unique côté client.
		if (renumber) call.sequence = index + 1;

		// Un tracé de remplacement a ses propres distances curvilignes : celles héritées de
		// `shape_dist_traveled` ne s'y rapportent plus, tous les arrêts sont reprojetés.
		if (shape !== undefined && call.modification !== "REMOVED") {
			call.distanceTraveled = shape.findClosestPointDistance(call.stop.latitude, call.stop.longitude);
		}
	}

	return calls;
}
