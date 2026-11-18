import { setImmediate } from "node:timers/promises";

const PAUSE_INTERVAL_MS = 50;

export class DeadlineExceededError extends Error {
	constructor() {
		super("Deadline exceeded.");
		this.name = "DeadlineExceededError";
	}
}

export type Deadline = {
	remainingMs(): number;
	due(): boolean;
	pause(): Promise<void>;
};

export function createDeadline(at: number): Deadline {
	let lastPauseAt = Date.now();

	return {
		remainingMs: () => at - Date.now(),
		due: () => {
			const now = Date.now();
			return now >= at || now - lastPauseAt >= PAUSE_INTERVAL_MS;
		},
		pause: async () => {
			if (Date.now() >= at) throw new DeadlineExceededError();
			await setImmediate();
			lastPauseAt = Date.now();
			if (lastPauseAt >= at) throw new DeadlineExceededError();
		},
	};
}
