import { describe, expect, it } from "vitest";

import { pickText, stripHtml } from "./alert.js";
import { minutesBetween, toLocalTime } from "./time.js";

describe("pickText", () => {
	it("prefers French, then untagged, then the first translation", () => {
		expect(
			pickText([
				{ text: "Hello", language: "en" },
				{ text: "Bonjour", language: "fr-FR" },
			]),
		).toBe("Bonjour");
		expect(pickText([{ text: "Hello", language: "en" }, { text: "Salut" }])).toBe("Salut");
		expect(pickText([{ text: "Hallo", language: "de" }])).toBe("Hallo");
		expect(pickText(undefined)).toBeUndefined();
	});
});

describe("stripHtml", () => {
	it("turns markup into plain text with line breaks", () => {
		expect(stripHtml("<p>Ligne <b>T1</b>&nbsp;déviée</p><p>Arrêt <i>Gare</i> fermé &amp; déplacé</p>")).toBe(
			"Ligne T1 déviée\nArrêt Gare fermé & déplacé",
		);
		expect(stripHtml("a<br>b<br/>c")).toBe("a\nb\nc");
		expect(stripHtml(undefined)).toBeUndefined();
	});
});

describe("time", () => {
	it("formats instants in the network timezone, to the minute", () => {
		expect(toLocalTime("2026-11-18T08:15:42Z", "Europe/Paris")).toBe("2026-11-18T09:15+01:00");
		expect(toLocalTime("2026-07-01T08:15:00Z", "Europe/Paris")).toBe("2026-07-01T10:15+02:00");
	});

	it("measures signed minute differences", () => {
		expect(minutesBetween("2026-11-18T08:00:00Z", "2026-11-18T08:04:40Z")).toBe(5);
		expect(minutesBetween("2026-11-18T08:04:00Z", "2026-11-18T08:00:00Z")).toBe(-4);
	});
});
