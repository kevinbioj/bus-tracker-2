import { setImmediate } from "node:timers/promises";
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

/** Demandes distinctes en attente au-delà desquelles les nouvelles sont ignorées : le serveur se replie alors sur ses courses suivies. */
const MAX_PENDING_REQUESTS = 100;

/** Échéance d'une demande d'un serveur qui n'en transmet pas encore : son propre délai d'attente. */
const DEFAULT_REQUEST_TTL_MS = 2_000;

type ValidRequest = StopDeparturesRequest & { requestId: string; stopAreaRef: string };

type PendingRequest = { request: ValidRequest; requestIds: string[]; expiresAt: number };

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

	// Les demandes identiques reçues pendant un calcul sont servies par une seule réponse calculée, et
	// le calcul de chacune rend la main à la boucle : une rafale ne monopolise pas le processus.
	const pending = new Map<string, PendingRequest>();
	let isDraining = false;
	let droppedCount = 0;

	const answer = async ({ request, requestIds, expiresAt }: PendingRequest) => {
		if (expiresAt <= Date.now()) return;

		const located = locateStopArea(sources, request.stopAreaRef, request.sourceId);
		// Une station inconnue n'est pas une erreur : la demande est diffusée au provider qui l'a
		// annoncée, mais sa ressource GTFS a pu changer depuis.
		if (located === undefined) return;

		const { departures, excludedJourneys } = computeStopDepartures(
			located.source,
			located.areaId,
			Temporal.Now.instant(),
			{ stopRef: request.stopRef, lineRefs: request.lineRefs, direction: request.direction },
		);

		for (const requestId of requestIds) {
			const reply: StopDeparturesReply = {
				requestId,
				stopAreaRef: request.stopAreaRef,
				departures,
				excludedJourneys: excludedJourneys.length > 0 ? excludedJourneys : undefined,
				passedCallDetection: located.source.options.passedCallDetection ?? "SCHEDULE",
			};
			await redis.publish(STOP_DEPARTURES_REPLY_CHANNEL, JSON.stringify(reply));
		}
	};

	const drain = async () => {
		isDraining = true;
		try {
			while (pending.size > 0) {
				await setImmediate();
				const [key, entry] = pending.entries().next().value!;
				pending.delete(key);
				try {
					await answer(entry);
				} catch (cause) {
					console.error(new Error("Failed to answer a stop departures request.", { cause }));
					captureException(cause);
				}
			}
		} finally {
			isDraining = false;
		}
		if (droppedCount > 0) {
			console.warn("⚠ Dropped %d stop departures requests: too many pending.", droppedCount);
			droppedCount = 0;
		}
	};

	const onRequest = (message: string) => {
		let request: Partial<StopDeparturesRequest>;
		try {
			request = JSON.parse(message);
		} catch {
			console.warn("⚠ Rejected a malformed stop departures request:", message);
			return;
		}
		if (
			typeof request.requestId !== "string" ||
			typeof request.stopAreaRef !== "string" ||
			(request.stopRef !== undefined && typeof request.stopRef !== "string") ||
			(request.sourceId !== undefined && typeof request.sourceId !== "string") ||
			(request.lineRefs !== undefined &&
				(!Array.isArray(request.lineRefs) || request.lineRefs.some((lineRef) => typeof lineRef !== "string"))) ||
			(request.direction !== undefined && request.direction !== "departures" && request.direction !== "arrivals") ||
			(request.expiresAt !== undefined && typeof request.expiresAt !== "number")
		) {
			console.warn("⚠ Rejected a malformed stop departures request:", message);
			return;
		}

		const validRequest = request as ValidRequest;
		const key = JSON.stringify([
			validRequest.stopAreaRef,
			validRequest.sourceId,
			validRequest.stopRef,
			validRequest.lineRefs,
			validRequest.direction,
		]);
		const expiresAt = validRequest.expiresAt ?? Date.now() + DEFAULT_REQUEST_TTL_MS;

		const existing = pending.get(key);
		if (existing !== undefined) {
			existing.requestIds.push(validRequest.requestId);
			existing.expiresAt = Math.max(existing.expiresAt, expiresAt);
		} else if (pending.size >= MAX_PENDING_REQUESTS) {
			droppedCount += 1;
			return;
		} else {
			pending.set(key, { request: validRequest, requestIds: [validRequest.requestId], expiresAt });
		}

		if (!isDraining) void drain();
	};

	await subscriber.connect();
	await subscriber.subscribe(stopDeparturesRequestChannel(providerId), onRequest);

	console.log("%s ► Serving stop departures requests.", Temporal.Now.instant());
}
