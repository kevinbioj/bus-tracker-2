import { describe, expect, it } from "vitest";

import { matchesSearchText, normalizeSearchText } from "./search-text.js";

describe("normalizeSearchText", () => {
	it("drops accents, case and punctuation", () => {
		expect(normalizeSearchText("  SYTRAL – Métropole de Lyon ")).toBe("sytral metropole de lyon");
	});
});

describe("matchesSearchText", () => {
	const astuce = ["Réseau Astuce", "Rouen", "Normandie", "ASTUCE"];
	const tcl = ["TCL", "SYTRAL – Métropole de Lyon", "Auvergne-Rhône-Alpes", "TCL"];

	it("matches a substring of any field", () => {
		expect(matchesSearchText(astuce, "rouen")).toBe(true);
		expect(matchesSearchText(tcl, "metropole de lyon")).toBe(true);
	});

	it("matches words in any order, spread across fields, by prefix", () => {
		expect(matchesSearchText(tcl, "lyon métropole")).toBe(true);
		expect(matchesSearchText(astuce, "astuce normandie")).toBe(true);
		expect(matchesSearchText(astuce, "astuce bretagne")).toBe(false);
	});

	it("ignores null fields and accepts empty queries", () => {
		expect(matchesSearchText([null, undefined, "Twisto"], "twist")).toBe(true);
		expect(matchesSearchText(astuce, " – ")).toBe(true);
	});
});
