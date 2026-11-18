import { setTimeout } from "node:timers/promises";
import { describe, expect, it } from "vitest";

import { createDeadline, DeadlineExceededError } from "./deadline.js";

describe("createDeadline", () => {
	it("rend la main sans lever tant que l'échéance n'est pas atteinte", async () => {
		const deadline = createDeadline(Date.now() + 10_000);
		let resumedOther = false;
		const other = (async () => {
			resumedOther = true;
		})();

		await deadline.pause();

		await other;
		expect(resumedOther).toBe(true);
		expect(deadline.remainingMs()).toBeGreaterThan(0);
	});

	it("n'est à échéance qu'après l'intervalle de pause", async () => {
		const deadline = createDeadline(Number.POSITIVE_INFINITY);
		expect(deadline.due()).toBe(false);

		await setTimeout(60);

		expect(deadline.due()).toBe(true);
		await deadline.pause();
		expect(deadline.due()).toBe(false);
	});

	it("lève une fois l'échéance passée", async () => {
		const deadline = createDeadline(Date.now() - 1);

		expect(deadline.due()).toBe(true);
		await expect(deadline.pause()).rejects.toBeInstanceOf(DeadlineExceededError);
	});
});
