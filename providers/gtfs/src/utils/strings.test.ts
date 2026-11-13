import { describe, expect, it } from "vitest";

import { copyString, createInterner } from "./strings.js";

describe("copyString", () => {
	it.each([
		"",
		"abc",
		"douze carac.",
		"treize carac.",
		"Gare Saint-Lazare",
		"Hôtel de Ville – Église",
		"Ligne 🚌 vers 🏙️",
	])("renvoie une chaîne égale à %j", (value) => {
		expect(copyString(value)).toBe(value);
	});
});

describe("createInterner", () => {
	it("renvoie la même instance pour deux valeurs égales construites séparément", () => {
		const intern = createInterner();
		const first = intern(["Gare", "Saint-Lazare"].join(" "));
		const second = intern(`Gare ${"Saint-Lazare"}`);

		expect(first).toBe("Gare Saint-Lazare");
		expect(Object.is(first, second)).toBe(true);
	});

	it("renvoie des instances différentes pour des valeurs différentes", () => {
		const intern = createInterner();

		expect(intern("Gare Saint-Lazare")).not.toBe(intern("Gare Montparnasse"));
	});
});
