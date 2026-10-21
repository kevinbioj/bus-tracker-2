import {
	REALTIME_PROTOCOL_VERSION,
	type RealtimeClientMessage,
	type RealtimeServerMessage,
	type RealtimeUpdateMessage,
} from "@bus-tracker/contracts";
import { useEffect, useSyncExternalStore } from "react";

import type { Line } from "./lines";
import type { ServiceAlert } from "./service-alerts";
import type { StopDepartures, StopMarker } from "./stops";
import type { DisposeableVehicleJourney } from "./vehicle-journeys";

export type RealtimeStatus = "closed" | "connecting" | "open" | "unavailable" | "incompatible";

type RealtimePayloads = {
	journey: DisposeableVehicleJourney;
	alert: ServiceAlert;
	line: Line;
	stopMarker: StopMarker;
	stopDepartures: StopDepartures;
};

export type RealtimeMessage = RealtimeUpdateMessage<RealtimePayloads>;

const HIDDEN_GRACE_MS = 30_000;
const RELEASE_GRACE_MS = 5_000;
const FAILED_ATTEMPTS_BEFORE_FALLBACK = 3;
const MIN_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

let status: RealtimeStatus = "closed";
let socket: WebSocket | null = null;
let consumers = 0;
let reconnectAttempts = 0;
let failedAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let hiddenTimer: ReturnType<typeof setTimeout> | undefined;
let releaseTimer: ReturnType<typeof setTimeout> | undefined;

const statusListeners = new Set<() => void>();
const messageListeners = new Set<(message: RealtimeMessage) => void>();

function setStatus(nextStatus: RealtimeStatus) {
	if (status === nextStatus) return;
	status = nextStatus;
	for (const listener of statusListeners) listener();
}

function realtimeUrl() {
	const prefix = (import.meta.env.VITE_APP_API_URL ?? "/api").replace(/\/$/, "");
	const url = new URL(`${prefix}/ws`, window.location.href);
	url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
	return url;
}

function shouldConnect() {
	return consumers > 0 && document.visibilityState === "visible" && status !== "incompatible";
}

function connect() {
	if (socket !== null || !shouldConnect()) return;

	clearTimeout(reconnectTimer);
	reconnectTimer = undefined;
	if (status !== "unavailable") setStatus("connecting");

	const ws = new WebSocket(realtimeUrl());
	socket = ws;
	let opened = false;

	ws.onmessage = (event) => {
		if (socket !== ws || typeof event.data !== "string") return;

		const message = JSON.parse(event.data) as RealtimeServerMessage<RealtimePayloads>;
		if (message.type === "hello") {
			if (message.version !== REALTIME_PROTOCOL_VERSION) {
				setStatus("incompatible");
				ws.close(1000);
				return;
			}
			opened = true;
			reconnectAttempts = 0;
			failedAttempts = 0;
			setStatus("open");
			return;
		}

		for (const listener of messageListeners) listener(message);
	};

	ws.onclose = () => {
		if (socket !== ws) return;
		socket = null;
		if (status === "incompatible") return;
		if (!opened) failedAttempts += 1;
		setStatus(failedAttempts >= FAILED_ATTEMPTS_BEFORE_FALLBACK ? "unavailable" : "closed");
		scheduleReconnect();
	};
}

function scheduleReconnect() {
	if (reconnectTimer !== undefined || !shouldConnect()) return;

	const delay = Math.min(MAX_RECONNECT_DELAY_MS, MIN_RECONNECT_DELAY_MS * 2 ** reconnectAttempts);
	reconnectAttempts += 1;
	reconnectTimer = setTimeout(
		() => {
			reconnectTimer = undefined;
			connect();
		},
		delay * (0.5 + Math.random()),
	);
}

function disconnect() {
	clearTimeout(reconnectTimer);
	reconnectTimer = undefined;

	const ws = socket;
	socket = null;
	ws?.close(1000);

	if (status !== "incompatible" && status !== "unavailable") setStatus("closed");
}

if (typeof document !== "undefined") {
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") {
			clearTimeout(hiddenTimer);
			hiddenTimer = setTimeout(disconnect, HIDDEN_GRACE_MS);
			return;
		}

		clearTimeout(hiddenTimer);
		hiddenTimer = undefined;
		connect();
	});
}

export function sendRealtimeMessage(message: RealtimeClientMessage) {
	if (socket === null || status !== "open") return false;
	socket.send(JSON.stringify(message));
	return true;
}

export function subscribeRealtimeMessages(listener: (message: RealtimeMessage) => void) {
	messageListeners.add(listener);
	return () => {
		messageListeners.delete(listener);
	};
}

function subscribeStatus(listener: () => void) {
	statusListeners.add(listener);
	return () => {
		statusListeners.delete(listener);
	};
}

export function useRealtimeStatus() {
	return useSyncExternalStore(subscribeStatus, () => status);
}

export function isRealtimeAvailable(currentStatus: RealtimeStatus = status) {
	return currentStatus !== "unavailable" && currentStatus !== "incompatible";
}

export function useRealtimeAvailable() {
	return isRealtimeAvailable(useRealtimeStatus());
}

export function useRealtimeConnection() {
	useEffect(() => {
		consumers += 1;
		clearTimeout(releaseTimer);
		releaseTimer = undefined;
		connect();

		return () => {
			consumers -= 1;
			if (consumers > 0) return;
			releaseTimer = setTimeout(() => {
				releaseTimer = undefined;
				if (consumers === 0) disconnect();
			}, RELEASE_GRACE_MS);
		};
	}, []);

	return useRealtimeStatus();
}
