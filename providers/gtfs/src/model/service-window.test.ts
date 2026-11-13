import { describe, expect, it } from "vitest";

import { Service } from "./service.js";
import { createServiceWindow, createServiceWindowFilter, isServiceWindowExpiring } from "./service-window.js";

const date = (value: string) => Temporal.PlainDate.from(value);
const onlyOn = (id: string, value: string) => new Service(id, undefined, undefined, undefined, [], [date(value)]);

describe("createServiceWindow", () => {
	it("couvre la veille et les sept jours suivants", () => {
		const window = createServiceWindow(date("2026-06-10"));

		expect(window.from.toString()).toBe("2026-06-09");
		expect(window.to.toString()).toBe("2026-06-17");
	});
});

describe("createServiceWindowFilter", () => {
	const runsInWindow = createServiceWindowFilter(createServiceWindow(date("2026-06-10")));

	it("accepte un service qui ne circule que le dernier jour de la fenêtre", () => {
		expect(runsInWindow(onlyOn("last", "2026-06-17"))).toBe(true);
	});

	it("refuse un service qui ne circule qu'avant ou après la fenêtre", () => {
		expect(runsInWindow(onlyOn("after", "2026-06-18"))).toBe(false);
		expect(runsInWindow(onlyOn("before", "2026-06-08"))).toBe(false);
	});

	it("accepte un service du lundi au vendredi valable toute l'année", () => {
		const weekdays = new Service(
			"weekdays",
			[true, true, true, true, true, false, false],
			date("2026-01-01"),
			date("2026-12-31"),
		);

		expect(runsInWindow(weekdays)).toBe(true);
	});
});

describe("isServiceWindowExpiring", () => {
	const window = createServiceWindow(date("2026-06-10"));

	it("ne demande pas de réimport tant qu'il reste deux jours de marge", () => {
		expect(isServiceWindowExpiring(window, date("2026-06-15"))).toBe(false);
	});

	it("demande un réimport quand la marge est entamée", () => {
		expect(isServiceWindowExpiring(window, date("2026-06-16"))).toBe(true);
	});
});
