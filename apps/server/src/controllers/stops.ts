import type {
	StopAreaMode,
	StopCallDirection,
	StopDeparture,
	StopPoint,
	VehicleJourneyCall,
} from "@bus-tracker/contracts";
import * as z from "zod";

import { resolveLineRefs } from "../core/services/line-ref-service.js";
import { findStopAlerts } from "../core/services/service-alert-service.js";
import {
	findStopArea,
	findStopAreaOfStopPoint,
	findStopAreasWithin,
	type StopArea,
} from "../core/services/stop-area-service.js";
import { requestStopDepartures, type StopDeparturesResult } from "../core/services/stop-departures-service.js";
import { journeyStore } from "../core/store/journey-store.js";
import { hono } from "../server.js";
import { useCache } from "../utils/use-cache.js";
import { createParamValidator, createQueryValidator } from "../utils/validator-helpers.js";

/** Plafond de stations servies en une fois : au-delà, l'emprise est trop large pour être lisible. */
const MARKERS_LIMIT = 1_500;

/** Portée du tableau de passages, alignée sur celle du processeur. */
const DEPARTURES_HORIZON_MS = 2 * 60 * 60 * 1000;

const DEPARTURES_LIMIT = 15;

/**
 * Au-delà, la position d'un véhicule est jugée figée — le véhicule s'est délocalisé : elle ne dit
 * plus ni où il en est de sa course, ni s'il stationne à l'arrêt.
 */
const STALE_POSITION_MS = 5 * 60 * 1000;

type StopMarker = {
	ref: string;
	name: string;
	latitude: number;
	longitude: number;
	lineRefs: string[];
	mode: StopAreaMode;
	stopPoints?: StopPoint[];
};

/** L'inventaire ne bouge qu'au rythme des ressources GTFS : une minute de cache est sans risque. */
const markersCache = useCache<StopMarker[]>(60_000);

const getStopMarkersQuery = z.object({
	swLat: z.coerce.number().min(-90).max(90),
	swLon: z.coerce.number().min(-180).max(180),
	neLat: z.coerce.number().min(-90).max(90),
	neLon: z.coerce.number().min(-180).max(180),
	networkId: z
		.union([z.coerce.number(), z.array(z.coerce.number())])
		.optional()
		.transform((values) => (typeof values === "number" ? [values] : values)),
	// Les quais ne servent qu'aux zooms les plus forts : inutile de les transporter en deçà.
	withStopPoints: z
		.enum(["true", "false"])
		.default("false")
		.transform((value) => value === "true"),
});

hono.get("/stops/markers", createQueryValidator(getStopMarkersQuery), async (c) => {
	const { swLat, swLon, neLat, neLon, networkId, withStopPoints } = c.req.valid("query");

	// L'emprise est arrondie pour que deux cadrages voisins partagent la même entrée de cache.
	const cacheKey = [swLat, swLon, neLat, neLon]
		.map((bound) => bound.toFixed(3))
		.concat(networkId?.join(",") ?? "", String(withStopPoints))
		.join("|");

	let items = markersCache.get(cacheKey);
	if (items === undefined) {
		const stopAreas = await findStopAreasWithin(
			{ swLat, swLon, neLat, neLon },
			{ limit: MARKERS_LIMIT, networkIds: networkId },
		);

		items = stopAreas.map(({ ref, name, latitude, longitude, lineRefs, mode, stopPoints }) => ({
			ref,
			name,
			latitude,
			longitude,
			lineRefs,
			// Fiche publiée avant l'apparition du mode : un bus, le temps qu'elle soit republiée.
			mode: mode ?? "BUS",
			...(withStopPoints ? { stopPoints: stopPoints ?? [] } : {}),
		}));
		markersCache.set(cacheKey, items);
	}

	return c.json({ items, at: Temporal.Now.instant() });
});

type ResolvedDeparture = Omit<StopDeparture, "lineRef"> & {
	/** Absente d'un passage qui ne vient que du suivi : la ligne y est déjà résolue. */
	lineRef?: string;
	/**
	 * Seule l'identité de la ligne voyage avec le passage : son numéro, ses couleurs et son
	 * pictogramme sont connus du client par `/networks/:id`, qu'il garde en cache.
	 */
	lineId?: number;
	/**
	 * Réseau de la ligne : il n'est pas forcément parmi ceux de la station, et le client doit savoir
	 * quel réseau demander pour la retrouver.
	 */
	lineNetworkId?: number;
	/** Vrai lorsque la course est effectivement suivie par l'application à cet instant. */
	tracked: boolean;
	/** Vrai lorsque le véhicule stationne en ce moment à l'arrêt. */
	atStop: boolean;
};

/**
 * Clé de rapprochement entre un passage théorique et la course qui l'assure. L'identifiant de
 * publication ne suffit pas : une course suivie en GPS est publiée sous une clé de véhicule, que le
 * processeur ne peut pas deviner. Sa course théorique, elle, est la même de part et d'autre.
 */
function journeyKeyOf(departure: { journeyRef?: string; serviceDate?: string }) {
	if (departure.journeyRef === undefined) return;
	return `${departure.journeyRef}|${departure.serviceDate ?? ""}`;
}

/**
 * Heures d'un passage dans le sens du tableau. L'arrivée n'est publiée à part que lorsqu'elle diffère
 * du départ : sinon, c'est l'heure de la desserte.
 */
function callTimesOf(call: VehicleJourneyCall, direction: StopCallDirection) {
	if (direction === "arrivals" && call.aimedArrivalTime !== undefined) {
		return { aimedTime: call.aimedArrivalTime, expectedTime: call.expectedArrivalTime };
	}
	return { aimedTime: call.aimedTime, expectedTime: call.expectedTime };
}

/**
 * Complète la réponse du provider par les courses réellement suivies. Elle prend le relais lorsque
 * le provider ne répond pas, et couvre à elle seule ce que l'horaire théorique ignore : les courses
 * supplémentaires, les dessertes ajoutées par une déviation, et les véhicules suivis en GPS dont
 * aucune course théorique ne porte la trace.
 */
function mergeTrackedJourneys(
	stopArea: StopArea,
	stopRefs: Set<string>,
	{ departures, excludedJourneys, passedCallDetection }: StopDeparturesResult,
	nowMs: number,
	direction: StopCallDirection,
) {
	const untilMs = nowMs + DEPARTURES_HORIZON_MS;

	const merged: ResolvedDeparture[] = departures.map((departure) => ({ ...departure, tracked: false, atStop: false }));

	const byJourneyId = new Map(
		merged.flatMap((departure) => (departure.journeyId !== undefined ? [[departure.journeyId, departure]] : [])),
	);
	const byJourneyKey = new Map(
		merged.flatMap((departure) => {
			const key = journeyKeyOf(departure);
			return key !== undefined ? [[key, departure] as const] : [];
		}),
	);

	// Courses que la configuration de la source a écartées du tableau : elles ne doivent pas y revenir
	// par le suivi.
	const excludedJourneyIds = new Set(
		excludedJourneys.flatMap(({ journeyId }) => (journeyId !== undefined ? [journeyId] : [])),
	);
	const excludedJourneyKeys = new Set(
		excludedJourneys.flatMap((excluded) => {
			const key = journeyKeyOf(excluded);
			return key !== undefined ? [key] : [];
		}),
	);

	// Passages que le véhicule associé a déjà dépassés, d'après sa progression plutôt que l'heure.
	const passed = new Set<ResolvedDeparture>();

	for (const journey of journeyStore.values()) {
		if (!stopArea.networkIds.includes(journey.networkId)) continue;

		const journeyKey = journeyKeyOf(journey);
		if (excludedJourneyIds.has(journey.id) || (journeyKey !== undefined && excludedJourneyKeys.has(journeyKey))) {
			continue;
		}

		// Pour un véhicule suivi en GPS, le processeur ne publie que les dessertes à partir de son
		// arrêt courant (séquence, à défaut identifiant d'arrêt) : la liste publiée *est* sa
		// progression. Une desserte qui y figure n'est pas encore passée, quelle que soit l'heure — tant
		// que la position est fraîche : figée, elle retient la course sur des arrêts déjà desservis, et
		// le passage est alors jugé sur l'horaire.
		const freshPosition = nowMs - Date.parse(journey.position.recordedAt) <= STALE_POSITION_MS;
		const followsVehicle = passedCallDetection === "VEHICLE" && journey.position.type === "GPS" && freshPosition;

		const known = byJourneyId.get(journey.id) ?? (journeyKey !== undefined ? byJourneyKey.get(journeyKey) : undefined);

		// Les dessertes publiées commencent à l'arrêt en cours : le véhicule stationne à la station
		// lorsqu'il est à l'arrêt et que la première desserte encore assurée en fait partie.
		const currentCall = journey.calls?.find((call) => call.callStatus !== "SKIPPED");
		const lastCall = journey.calls?.at(-1);
		// Terminus effectif : une déviation ou le temps réel peuvent avoir retiré les derniers arrêts.
		const terminusCall = journey.calls?.findLast((call) => call.callStatus !== "SKIPPED");
		// Course en temps réel : au moins une de ses dessertes publiées en porte un horaire.
		const realtime = journey.calls?.some((call) => call.expectedTime !== undefined) ? true : undefined;

		let matched = false;
		for (const call of journey.calls ?? []) {
			if (!stopRefs.has(call.stopRef)) continue;
			// Comme dans le processeur : ni le terminus, théorique ou effectif, où la course s'achève, ni
			// un arrêt interdit à la montée ne sont des départs. Les dessertes publiées partant de l'arrêt
			// courant, le terminus de départ n'y figure plus une fois la course partie : à l'arrivée, seul
			// l'arrêt interdit à la descente est écarté, le provider écartant l'origine des passages connus.
			if (direction === "arrivals") {
				if (call.flags?.includes("NO_DROP_OFF")) continue;
			} else if (call === lastCall || call === terminusCall || call.flags?.includes("NO_PICKUP")) {
				continue;
			}

			const atStop = freshPosition && journey.position.atStop && call === currentCall;
			const { aimedTime, expectedTime } = callTimesOf(call, direction);

			// Un véhicule à quai reste affiché même si son heure de départ est dépassée : il est là. Il
			// en va de même, si la source le demande, de tout véhicule qui n'a pas encore atteint l'arrêt.
			const effectiveMs = Date.parse(expectedTime ?? aimedTime);
			if (Number.isNaN(effectiveMs) || effectiveMs > untilMs) continue;
			if (effectiveMs < nowMs && !atStop && !followsVehicle) continue;

			matched = true;

			if (known !== undefined) {
				known.tracked = true;
				known.atStop = atStop;
				known.journeyId = journey.id;
				// La course suivie connaît sa ligne, même quand la référence du processeur n'a rien donné.
				if (journey.lineId !== undefined) {
					known.lineId = journey.lineId;
					known.lineNetworkId = journey.networkId;
				}
				// Le store tient l'état le plus récent de la course : ses heures priment sur celles que
				// le processeur a calculées pour répondre.
				known.expectedTime = expectedTime ?? known.expectedTime;
				known.callStatus = call.callStatus;
				// Les dessertes publiées partent de l'arrêt courant : le processeur, qui voit la course
				// entière, a pu y trouver du temps réel que celles-ci n'ont plus.
				known.realtime = known.realtime ?? realtime;
				// Les dessertes publiées vont jusqu'au terminus : la course suivie sait où elle s'achève.
				if (direction === "arrivals") known.terminus = call === terminusCall;
				known.platformName = call.platformName ?? known.platformName;
				// Calculée avec le véhicule effectivement affecté, elle est la plus juste des deux.
				known.destination = journey.destination ?? known.destination;
				// Code mission et accessibilité peuvent dépendre du véhicule affecté : ceux de la course
				// suivie priment, ceux du processeur à défaut.
				known.missionCode = journey.missionCode ?? known.missionCode;
				known.wheelchairAccessible = journey.wheelchairAccessible ?? known.wheelchairAccessible;
				break;
			}

			const departure: ResolvedDeparture = {
				tracked: true,
				atStop,
				stopRef: call.stopRef,
				stopName: call.stopName,
				platformName: call.platformName,
				lineId: journey.lineId,
				lineNetworkId: journey.lineId !== undefined ? journey.networkId : undefined,
				destination: journey.destination,
				missionCode: journey.missionCode,
				wheelchairAccessible: journey.wheelchairAccessible,
				aimedTime,
				expectedTime,
				callStatus: call.callStatus,
				realtime,
				terminus: direction === "arrivals" ? call === terminusCall : undefined,
				journeyId: journey.id,
				journeyRef: journey.journeyRef,
				serviceDate: journey.serviceDate,
			};
			merged.push(departure);
			byJourneyId.set(journey.id, departure);
			if (journeyKey !== undefined) byJourneyKey.set(journeyKey, departure);
			break;
		}

		// Le véhicule a déjà dépassé la station, même si l'heure prévue n'est pas encore atteinte (il
		// est en avance sur le temps réel annoncé) : le passage n'est plus à venir.
		if (followsVehicle && !matched && known !== undefined) {
			passed.add(known);
		}
	}

	// Le provider garde un départ tardif de terminus tant que sa course est publiée : il n'est à venir
	// que si le véhicule suivi y attend encore.
	return merged.filter(
		(departure) =>
			!passed.has(departure) &&
			(departure.tracked ||
				departure.origin !== true ||
				Date.parse(departure.expectedTime ?? departure.aimedTime) >= nowMs),
	);
}

async function resolveLineIds(departures: ResolvedDeparture[]) {
	const lines = await resolveLineRefs(
		departures.flatMap((departure) =>
			departure.lineId === undefined && departure.lineRef !== undefined ? [departure.lineRef] : [],
		),
	);

	for (const departure of departures) {
		if (departure.lineId !== undefined || departure.lineRef === undefined) continue;
		const line = lines.get(departure.lineRef);
		departure.lineId = line?.id;
		departure.lineNetworkId = line?.networkId;
	}
}

const getStopDeparturesParams = z.object({
	ref: z.string(),
});

const getStopDeparturesQuery = z.object({
	direction: z.enum(["departures", "arrivals"]).default("departures"),
});

/**
 * Le client sonde le tableau toutes les 5 s : le cache, plus court, ne fait que mutualiser les
 * demandes simultanées de plusieurs visiteurs sur une même station sans rendre de réponse périmée.
 */
const departuresCache = useCache<unknown>(4_000);

/** La station elle-même ne change qu'avec la ressource GTFS. */
const stopAreasCache = useCache<StopArea | null>(300_000);

/**
 * Oublie stations, marqueurs et tableaux en cache : appelé dès qu'un provider republie l'inventaire
 * d'une source, pour ne pas servir quelques minutes encore une station que sa ressource a supprimée.
 * Le tout est vidé plutôt que la seule source concernée : ces caches sont courts et bon marché à
 * reconstituer, les trier par source ne vaudrait pas la complexité.
 */
export function invalidateStopAreaCaches() {
	markersCache.clear();
	stopAreasCache.clear();
	departuresCache.clear();
}

/**
 * `ref` désigne une station, ou un de ses quais : le tableau est alors celui de la station,
 * restreint à ce quai. Le client n'a ainsi qu'une référence à porter, quelle que soit la sélection.
 */
const isStopPointRef = (ref: string) => ref.includes(":StopPoint:");

/** Station désignée par `ref`, et le quai sur lequel se restreindre si `ref` en désigne un. */
async function resolveStopArea(ref: string) {
	const stopPointRef = isStopPointRef(ref) ? ref : undefined;

	let stopArea = stopAreasCache.get(ref);
	if (stopArea === undefined) {
		stopArea = (await (stopPointRef !== undefined ? findStopAreaOfStopPoint(ref) : findStopArea(ref))) ?? null;
		stopAreasCache.set(ref, stopArea);
	}

	return { stopArea, stopPointRef };
}

hono.get(
	"/stops/:ref/departures",
	createParamValidator(getStopDeparturesParams),
	createQueryValidator(getStopDeparturesQuery),
	async (c) => {
		const { ref } = c.req.valid("param");
		const { direction } = c.req.valid("query");

		const cacheKey = `${ref}|${direction}`;
		const cached = departuresCache.get(cacheKey);
		if (cached !== undefined) return c.json(cached);

		const { stopArea, stopPointRef } = await resolveStopArea(ref);
		if (stopArea === null) {
			return c.json({ error: `No stop area was found for ref "${ref}".` }, 404);
		}
		if (direction === "arrivals" && stopArea.arrivals !== true) {
			return c.json({ error: `Stop area "${stopArea.ref}" does not offer arrivals.` }, 400);
		}

		const nowMs = Date.now();
		const departures = mergeTrackedJourneys(
			stopArea,
			new Set(stopPointRef !== undefined ? [stopPointRef] : stopArea.stopRefs),
			await requestStopDepartures({
				providerId: stopArea.providerId,
				sourceId: stopArea.sourceId,
				stopAreaRef: stopArea.ref,
				stopRef: stopPointRef,
				direction,
			}),
			nowMs,
			direction,
		);
		await resolveLineIds(departures);

		departures.sort((a, b) => Date.parse(a.expectedTime ?? a.aimedTime) - Date.parse(b.expectedTime ?? b.aimedTime));

		const payload = {
			// La position permet au client de garder la station sélectionnée visible à tout niveau de zoom.
			stop: {
				ref: stopArea.ref,
				name: stopArea.name,
				latitude: stopArea.latitude,
				longitude: stopArea.longitude,
				mode: stopArea.mode ?? "BUS",
				// Le tableau propose aussi les arrivées : la source l'a voulu pour cette station.
				arrivals: stopArea.arrivals === true,
				networkId: stopArea.networkId,
				// Tous les réseaux de la station : le client en tire numéros et couleurs des lignes.
				networkIds: stopArea.networkIds,
				stopPoints: stopArea.stopPoints ?? [],
			},
			// Quai sur lequel le tableau est restreint, s'il l'est.
			stopPointRef,
			// Les références internes n'ont servi qu'au rapprochement : le client n'en a pas l'usage.
			// Un passage dont la ligne reste inconnue n'aurait qu'un « ? » à montrer : il est écarté, avant la
			// limite pour que le tableau reste plein.
			departures: departures
				.filter(({ lineId }) => lineId !== undefined)
				.slice(0, DEPARTURES_LIMIT)
				.map(({ lineRef, journeyRef, serviceDate, ...departure }) => departure),
			at: Temporal.Now.instant(),
		};

		departuresCache.set(cacheKey, payload);
		return c.json(payload);
	},
);

hono.get("/stops/:ref/alerts", createParamValidator(getStopDeparturesParams), async (c) => {
	const { ref } = c.req.valid("param");

	const { stopArea, stopPointRef } = await resolveStopArea(ref);
	if (stopArea === null) {
		return c.json({ error: `No stop area was found for ref "${ref}".` }, 404);
	}

	// Un quai choisi ne perd pas l'info trafic de sa station : celle-ci le vise aussi.
	const items = await findStopAlerts(
		stopArea,
		new Set(stopPointRef !== undefined ? [stopPointRef] : stopArea.stopRefs),
	);
	return c.json({ items, at: Temporal.Now.instant() });
});
