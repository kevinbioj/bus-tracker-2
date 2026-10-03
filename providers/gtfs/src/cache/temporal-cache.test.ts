import { describe, expect, it } from "vitest";

import { createZonedDateTimeFromSecs, getEpochMsFromSecs } from "./temporal-cache.js";

/** Heures balayées : toutes les 7 minutes sur deux jours et demi, modulus compris. */
const SECS = Array.from({ length: Math.floor((60 * 3600) / 420) }, (_, index) => index * 420);

describe("getEpochMsFromSecs", () => {
	const cases = [
		// Jour ordinaire.
		["Europe/Paris", "2026-06-01"],
		// Passage à l'heure d'été (02:00 → 03:00) et à l'heure d'hiver (03:00 → 02:00), y compris
		// pour une course partie la veille au soir.
		["Europe/Paris", "2026-03-29"],
		["Europe/Paris", "2026-03-28"],
		["Europe/Paris", "2026-10-25"],
		["Europe/Paris", "2026-10-24"],
		["America/New_York", "2026-03-08"],
		["America/New_York", "2026-11-01"],
		// Changement d'heure à minuit : le minuit local n'existe pas, ou existe deux fois.
		["America/Santiago", "2026-09-06"],
		["America/Santiago", "2026-04-05"],
		["UTC", "2026-06-01"],
	] as const;

	for (const [timeZone, date] of cases) {
		it(`rend le même instant que le calcul Temporal complet (${timeZone}, ${date})`, () => {
			const date0 = Temporal.PlainDate.from(date);
			for (const secs of SECS) {
				expect(getEpochMsFromSecs(date0, secs, timeZone), `${secs}s`).toBe(
					createZonedDateTimeFromSecs(date0, secs, timeZone).epochMilliseconds,
				);
			}
		});
	}
});
