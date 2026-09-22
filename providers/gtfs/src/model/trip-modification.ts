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
	/** Identifiants des `FeedEntity` porteuses, cibles de `modified_trip.modifications_id`. */
	modificationsIds: string[];
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
 * Ordonne les modifications le long de la course.
 *
 * Le flux ne garantit pas cet ordre : les modifications d'une même course peuvent provenir de
 * plusieurs entités `TripModifications`, fusionnées dans l'ordre du flux. Or leur application
 * progresse d'un arrêt au suivant sans jamais revenir en arrière : mal ordonnées, toutes celles qui
 * précèdent la dernière sont perdues.
 *
 * @returns undefined si un sélecteur de début ne désigne aucun arrêt.
 */
function orderModifications(scheduledCalls: JourneyCall[], plan: TripModificationPlan) {
	if (plan.modifications.length < 2) return plan.modifications;

	const ordered: { modification: ResolvedModification; startIndex: number }[] = [];

	for (const modification of plan.modifications) {
		const startIndex = findStopIndex(scheduledCalls, modification.startStopSelector, 0);
		if (startIndex === undefined) return;
		ordered.push({ modification, startIndex });
	}

	// Tri stable : une déviation déjà ordonnée — le cas courant — garde l'ordre du producteur, et
	// avec lui la résolution des sélecteurs par identifiant sur les lignes qui repassent par un arrêt.
	ordered.sort((a, b) => a.startIndex - b.startIndex);

	return ordered.map(({ modification }) => modification);
}

/** Portion de la desserte théorique abandonnée par une modification, bornée dans `scheduledCalls`. */
export type CancelledCallRange = {
	/** Arrêt encore desservi qui précède la modification, ou le premier arrêt retiré s'il ouvre la course. */
	fromIndex: number;
	/** Premier arrêt desservi qui suit la modification, ou le dernier arrêt retiré s'il clôt la course. Inclusif. */
	toIndex: number;
	/** Vrai si la course quitte son itinéraire en `fromIndex` — faux si la modification ouvre la course. */
	joinsAtStart: boolean;
	/** Vrai si la course retrouve son itinéraire en `toIndex` — faux si la modification va jusqu'au terminus. */
	joinsAtEnd: boolean;
};

/**
 * Portions de la desserte théorique que la déviation fait abandonner à la course : l'arrêt encore
 * desservi qui précède chaque modification, et le premier qui la suit. C'est entre ces deux arrêts
 * que le véhicule quitte puis retrouve son itinéraire.
 *
 * Retourne un tableau vide lorsque la déviation n'ôte aucun arrêt, ou lorsqu'un de ses sélecteurs
 * ne désigne rien — auquel cas {@link buildModifiedCalls} l'écarte également.
 */
export function computeCancelledCallRanges(scheduledCalls: JourneyCall[], plan: TripModificationPlan) {
	const ranges: CancelledCallRange[] = [];
	let cursor = 0;

	const modifications = orderModifications(scheduledCalls, plan);
	if (modifications === undefined) return [];

	// Bornes des portions retirées, avant regroupement : deux modifications que le producteur aurait
	// dû fusionner (« spans may not be contiguous; in this case the two modifications MUST be merged
	// into one ») laissent entre elles un arrêt retiré, non un arrêt desservi.
	const spans: [start: number, end: number][] = [];

	for (const modification of modifications) {
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

		const previousSpan = spans.at(-1);
		// Portions qui se touchent : le véhicule ne revient pas à son itinéraire entre les deux, elles
		// ne lui font abandonner qu'une seule portion de tracé.
		if (previousSpan !== undefined && previousSpan[1] + 1 === startIndex) previousSpan[1] = endIndex;
		else spans.push([startIndex, endIndex]);
	}

	// Aux extrémités de la course, l'arrêt retiré lui-même sert de borne, faute de voisin desservi :
	// la course n'y rejoint alors rien, puisqu'elle ne reprend jamais son itinéraire d'origine.
	for (const [startIndex, endIndex] of spans) {
		ranges.push({
			fromIndex: Math.max(0, startIndex - 1),
			toIndex: Math.min(scheduledCalls.length - 1, endIndex + 1),
			joinsAtStart: startIndex > 0,
			joinsAtEnd: endIndex < scheduledCalls.length - 1,
		});
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

	const modifications = orderModifications(scheduledCalls, plan);
	if (modifications === undefined) return;

	for (const modification of modifications) {
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

		// Arrêt de référence des temps de parcours : « a reference stop in the original trip », soit le
		// dernier arrêt du GTFS statique encore desservi — jamais un arrêt de déviation, même lorsque
		// deux modifications se suivent sans arrêt desservi entre elles —, ou le premier arrêt de la
		// course lorsque c'est lui que la modification affecte (spec).
		const previousCall = calls.findLast((call) => call.modification === undefined);
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
		// Renumérotation de 1 à n, arrêts retirés compris : `stopOrder` reste unique côté client.
		if (renumber) calls[index]!.sequence = index + 1;
	}

	// Un tracé de remplacement a ses propres distances curvilignes : celles héritées de
	// `shape_dist_traveled` ne s'y rapportent plus, tous les arrêts sont reprojetés — dans l'ordre de
	// desserte, qui seul départage les passages d'un tracé repassant près d'un même arrêt.
	if (shape !== undefined) {
		const servedCalls = calls.filter((call) => call.modification !== "REMOVED");
		const distances = shape.projectStopsInOrder(servedCalls.map((call) => call.stop));
		for (let index = 0; index < servedCalls.length; index++) {
			servedCalls[index]!.distanceTraveled = distances[index];
		}
	}

	return calls;
}
