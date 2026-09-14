import { captureException } from "@bus-tracker/monitoring";
import { createClient } from "redis";

export type CreateRedisClientOptions = {
	name?: string;
	onReconnect?: () => void;
};

const MAX_RECONNECT_DELAY_MS = 5_000;

export function createRedisClient({ name, onReconnect }: CreateRedisClientOptions = {}) {
	const label = name === undefined ? "Redis" : `Redis <${name}>`;
	const reconnectStrategy = (retries: number) =>
		Math.min(2 ** retries * 100, MAX_RECONNECT_DELAY_MS) + Math.floor(Math.random() * 200);

	const client = createClient({
		url: process.env.REDIS_SOCK ? undefined : (process.env.REDIS_URL ?? "redis://127.0.0.1:6379"),
		username: process.env.REDIS_USERNAME,
		password: process.env.REDIS_PASSWORD,
		socket: process.env.REDIS_SOCK
			? { path: process.env.REDIS_SOCK, tls: process.env.REDIS_TLS === "true", reconnectStrategy }
			: { reconnectStrategy },
		disableOfflineQueue: true,
	});

	let unavailableSince: number | undefined;
	let hasBeenReady = false;

	client.on("error", (error) => {
		if (!client.isReady) {
			if (unavailableSince !== undefined) return;
			unavailableSince = Date.now();
			console.error(`✘ ${label} is unavailable, retrying connection in the background.`, error);
		} else {
			console.error(`✘ ${label} client error.`, error);
		}
		captureException(error);
	});

	client.on("ready", () => {
		if (unavailableSince !== undefined) {
			console.log(`✓ ${label} connection established after ${Date.now() - unavailableSince}ms of unavailability.`);
			unavailableSince = undefined;
		}

		if (hasBeenReady) onReconnect?.();
		hasBeenReady = true;
	});

	return client;
}
