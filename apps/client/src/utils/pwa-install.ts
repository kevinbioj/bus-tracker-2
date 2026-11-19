import { useSyncExternalStore } from "react";

type BeforeInstallPromptEvent = Event & {
	prompt: () => Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallMethod = "native" | "ios" | "android-manual";

let deferredPrompt: BeforeInstallPromptEvent | undefined;
let installed = false;
const listeners = new Set<() => void>();

const notify = () => {
	for (const listener of listeners) listener();
};

if (typeof window !== "undefined") {
	window.addEventListener("beforeinstallprompt", (event) => {
		event.preventDefault();
		deferredPrompt = event as BeforeInstallPromptEvent;
		notify();
	});

	window.addEventListener("appinstalled", () => {
		deferredPrompt = undefined;
		installed = true;
		notify();
	});
}

export function isStandalone() {
	return (
		window.matchMedia("(display-mode: fullscreen), (display-mode: standalone)").matches ||
		(navigator as Navigator & { standalone?: boolean }).standalone === true
	);
}

function isIos() {
	return (
		/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
	);
}

function isAndroid() {
	return /Android/i.test(navigator.userAgent);
}

export function getInstallMethod(): InstallMethod | null {
	if (installed || isStandalone()) return null;
	if (deferredPrompt !== undefined) return "native";
	if (isIos()) return "ios";
	if (isAndroid()) return "android-manual";
	return null;
}

export async function promptInstall() {
	const event = deferredPrompt;
	if (event === undefined) return undefined;

	deferredPrompt = undefined;
	await event.prompt();
	const { outcome } = await event.userChoice;
	notify();
	return outcome;
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function useInstallMethod() {
	return useSyncExternalStore(subscribe, getInstallMethod, () => null);
}
