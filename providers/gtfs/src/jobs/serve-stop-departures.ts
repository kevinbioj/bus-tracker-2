import {
	STOP_DEPARTURES_REPLY_CHANNEL,
	type StopDeparturesReply,
	type StopDeparturesRequest,
	stopDeparturesRequestChannel,
} from "@bus-tracker/contracts";
import { captureException } from "@bus-tracker/monitoring";
import { createRedisClient } from "@bus-tracker/redis";

import type { Source } from "../model/source.js";

import { computeStopDepartures } from "./compute-stop-departures.js";

/** Seule la publication est requise : évite d'exposer la variance des types du client Redis. */
type RedisPublisher = { publish: (channel: string, message: string) => Promise<unknown> };

const STOP_AREA_INFIX = ":StopArea:";

/**
 * Retrouve la source qui détient une station et l'identifiant de celle-ci. La référence publiée est
 * de la forme `${networkRef}:StopArea:${areaId}` ; son réseau ne désigne pas la source — une source
 * peut en alimenter plusieurs — c'est la demande qui la nomme. À défaut, la première source qui
 * connaît la station répond.
 */
function locateStopArea(sources: Source[], stopAreaRef: string, sourceId?: string) {
	const infixIndex = stopAreaRef.indexOf(STOP_AREA_INFIX);
	if (infixIndex === -1) return;

	const areaId = stopAreaRef.slice(infixIndex + STOP_AREA_INFIX.length);
	const knows = (source: Source) => source.gtfs?.stopAreas.has(areaId) === true || source.realtimeStopAreas.has(areaId);

	const source =
		sourceId !== undefined
			? sources.find((candidate) => candidate.id === sourceId && knows(candidate))
			: sources.find(knows);

	return source !== undefined ? { source, areaId } : undefined;
}

/**
 * Répond aux demandes de prochains passages du serveur. Le tableau de passages d'une station n'est
 * consulté que lorsqu'un usager clique dessus : le calculer à la demande ne coûte rien au repos, là
 * où publier en continu celui de chaque station encombrerait Redis pour rien.
 */
export async function serveStopDepartures(redis: RedisPublisher, providerId: string, sources: Source[]) {
	const subscriber = createRedisClient({ name: "stop departures" });

	const onRequest = async (message: string) => {
		const request = JSON.parse(message) as Partial<StopDeparturesRequest>;
		if (
			typeof request.requestId !== "string" ||
			typeof request.stopAreaRef !== "string" ||
			(request.stopRef !== undefined && typeof request.stopRef !== "string") ||
			(request.sourceId !== undefined && typeof request.sourceId !== "string")
		) {
			console.warn("⚠ Rejected a malformed stop departures request:", message);
			return;
		}

		const located = locateStopArea(sources, request.stopAreaRef, request.sourceId);
		// Une station inconnue n'est pas une erreur : la demande est diffusée au provider qui l'a
		// annoncée, mais sa ressource GTFS a pu changer depuis.
		if (located === undefined) return;

		const { departures, excludedJourneys } = computeStopDepartures(
			located.source,
			located.areaId,
			Temporal.Now.instant(),
			{ stopRef: request.stopRef },
		);

		const reply: StopDeparturesReply = {
			requestId: request.requestId,
			stopAreaRef: request.stopAreaRef,
			departures,
			excludedJourneys: excludedJourneys.length > 0 ? excludedJourneys : undefined,
			passedCallDetection: located.source.options.passedCallDetection ?? "SCHEDULE",
		};

		await redis.publish(STOP_DEPARTURES_REPLY_CHANNEL, JSON.stringify(reply));
	};

	await subscriber.connect();
	await subscriber.subscribe(stopDeparturesRequestChannel(providerId), (message) => {
		onRequest(message).catch((cause) => {
			console.error(new Error("Failed to answer a stop departures request.", { cause }));
			captureException(cause);
		});
	});

	console.log("%s ► Serving stop departures requests.", Temporal.Now.instant());
}
