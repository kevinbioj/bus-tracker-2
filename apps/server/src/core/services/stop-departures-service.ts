import { randomUUID } from "node:crypto";
import {
	type PassedCallDetection,
	STOP_DEPARTURES_REPLY_CHANNEL,
	type StopDeparture,
	type StopDeparturesReply,
	stopDeparturesReplySchema,
	stopDeparturesRequestChannel,
} from "@bus-tracker/contracts";
import { createRedisClient } from "@bus-tracker/redis";
import { ArkErrors } from "arktype";

/**
 * Délai au-delà duquel on cesse d'attendre un provider. Il calcule la réponse en mémoire : au-delà,
 * c'est qu'il est arrêté, saturé, ou qu'il ne connaît plus la station. Le repli sur les courses
 * suivies prend alors le relais, mieux vaut une réponse partielle qu'une attente.
 */
const REPLY_TIMEOUT_MS = 2_000;

export type StopDeparturesResult = {
	departures: StopDeparture[];
	passedCallDetection: PassedCallDetection;
};

/** Réponse de repli : rien du processeur, et le jugement le plus prudent, à l'heure. */
const EMPTY_RESULT: StopDeparturesResult = { departures: [], passedCallDetection: "SCHEDULE" };

type PendingRequest = {
	resolve: (result: StopDeparturesResult) => void;
	timeout: NodeJS.Timeout;
};

const pendingRequests = new Map<string, PendingRequest>();

let publisher: ReturnType<typeof createRedisClient> | undefined;

function settle(reply: StopDeparturesReply) {
	const pending = pendingRequests.get(reply.requestId);
	if (pending === undefined) return;

	pendingRequests.delete(reply.requestId);
	clearTimeout(pending.timeout);
	pending.resolve({ departures: reply.departures, passedCallDetection: reply.passedCallDetection ?? "SCHEDULE" });
}

/**
 * Ouvre le canal de réponse. Un seul abonnement permanent sert toutes les demandes : chaque réponse
 * porte l'identifiant de la sienne, s'abonner et se désabonner à chaque clic coûterait bien plus.
 */
export async function startStopDeparturesService(redis: ReturnType<typeof createRedisClient>) {
	publisher = redis;

	const subscriber = createRedisClient({ name: "stop departures subscriber" });
	await subscriber.connect();
	await subscriber.subscribe(STOP_DEPARTURES_REPLY_CHANNEL, (message) => {
		try {
			const reply = stopDeparturesReplySchema(JSON.parse(message));
			if (reply instanceof ArkErrors) {
				console.warn("⚠ Rejected a malformed stop departures reply:", reply.toString());
				return;
			}
			settle(reply);
		} catch (error) {
			console.error("✘ Failed to handle a stop departures reply:", error);
		}
	});

	console.log("► Subscribed to the stop departures reply channel.");
}

/**
 * Demande au provider détenteur les prochains passages d'une station. Renvoie une liste vide plutôt
 * qu'une erreur lorsque Redis est indisponible ou que personne ne répond : l'appelant complète de
 * toute façon avec les courses qu'il suit lui-même.
 */
export async function requestStopDepartures({
	providerId,
	sourceId,
	stopAreaRef,
	stopRef,
}: {
	providerId: string;
	sourceId: string;
	stopAreaRef: string;
	/** Restreint le tableau à un quai de la station. */
	stopRef?: string;
}): Promise<StopDeparturesResult> {
	if (publisher === undefined || !publisher.isReady) return EMPTY_RESULT;

	const requestId = randomUUID();

	const result = new Promise<StopDeparturesResult>((resolve) => {
		const timeout = setTimeout(() => {
			pendingRequests.delete(requestId);
			resolve(EMPTY_RESULT);
		}, REPLY_TIMEOUT_MS);
		// Le minuteur ne doit pas retenir le processus : une demande en vol n'est pas une raison de
		// retarder un arrêt.
		timeout.unref?.();
		pendingRequests.set(requestId, { resolve, timeout });
	});

	try {
		await publisher.publish(
			stopDeparturesRequestChannel(providerId),
			JSON.stringify({ requestId, stopAreaRef, sourceId, stopRef }),
		);
	} catch (error) {
		console.error("✘ Failed to publish a stop departures request:", error);
		const pending = pendingRequests.get(requestId);
		if (pending !== undefined) {
			pendingRequests.delete(requestId);
			clearTimeout(pending.timeout);
			pending.resolve(EMPTY_RESULT);
		}
	}

	return result;
}
