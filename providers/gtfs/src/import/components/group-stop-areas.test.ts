import { describe, expect, it } from "vitest";

import type { StationRecord } from "../../model/stop.js";
import { Stop } from "../../model/stop.js";

import { groupStopAreas, normalizeStopName } from "./group-stop-areas.js";

const station = (id: string, name: string, latitude: number, longitude: number): StationRecord => ({
	id,
	name,
	latitude,
	longitude,
});

const stop = (id: string, name: string, latitude: number, longitude: number, parentStationId?: string) =>
	new Stop(id, name, latitude, longitude, undefined, undefined, parentStationId);

describe("normalizeStopName", () => {
	it("efface la casse, les accents et la ponctuation", () => {
		expect(normalizeStopName("Théâtre des Arts")).toBe("theatre des arts");
		expect(normalizeStopName("THEATRE  DES-ARTS !")).toBe("theatre des arts");
	});
});

describe("groupStopAreas", () => {
	it("rattache les quais à leur station parente", () => {
		const stations = new Map([["gare", station("gare", "Gare Centrale", 49.44, 1.09)]]);
		const stops = [
			stop("quai-a", "Gare Quai A", 49.44, 1.09, "gare"),
			stop("quai-b", "Gare Quai B", 49.442, 1.09, "gare"),
		];

		const { stopAreas, stopAreaByStopId } = groupStopAreas(stops, stations);

		expect(stopAreas.size).toBe(1);
		expect(stopAreas.get("gare")!.name).toBe("Gare Centrale");
		expect(stopAreas.get("gare")!.latitude).toBeCloseTo(49.441, 6);
		expect(stopAreaByStopId.get("quai-a")).toBe("gare");
		expect(stopAreaByStopId.get("quai-b")).toBe("gare");
	});

	it("rapproche les homonymes proches dépourvus de station parente", () => {
		// Deux arrêts face à face sur un même boulevard : ~30 m les séparent.
		const stops = [stop("aller", "Théâtre des Arts", 49.4401, 1.09), stop("retour", "THEATRE DES ARTS", 49.4404, 1.09)];

		const { stopAreas, stopAreaByStopId } = groupStopAreas(stops, new Map());

		expect(stopAreas.size).toBe(1);
		expect(stopAreaByStopId.get("aller")).toBe(stopAreaByStopId.get("retour"));
		expect(stopAreas.get("aller")!.stops).toHaveLength(2);
	});

	it("sépare les homonymes éloignés", () => {
		// Deux « Mairie » distantes de plusieurs kilomètres : deux lieux distincts.
		const stops = [stop("mairie-1", "Mairie", 49.44, 1.09), stop("mairie-2", "Mairie", 49.48, 1.09)];

		const { stopAreas, stopAreaByStopId } = groupStopAreas(stops, new Map());

		expect(stopAreas.size).toBe(2);
		expect(stopAreaByStopId.get("mairie-1")).not.toBe(stopAreaByStopId.get("mairie-2"));
	});

	it("laisse un arrêt isolé former sa propre station", () => {
		const stops = [stop("zone-industrielle", "Zone Industrielle", 49.44, 1.09)];

		const { stopAreas } = groupStopAreas(stops, new Map());

		expect(stopAreas.get("zone-industrielle")!.name).toBe("Zone Industrielle");
	});

	it("retombe sur le rapprochement par nom lorsque la station parente n'est pas déclarée", () => {
		const stops = [
			stop("quai-a", "Mairie", 49.44, 1.09, "inconnue"),
			stop("quai-b", "Mairie", 49.4402, 1.09, "inconnue"),
		];

		const { stopAreas } = groupStopAreas(stops, new Map());

		expect(stopAreas.size).toBe(1);
		expect(stopAreas.has("inconnue")).toBe(false);
	});

	it("produit des identifiants de station stables, quel que soit l'ordre des arrêts", () => {
		const stops = [stop("b", "Mairie", 49.44, 1.09), stop("a", "Mairie", 49.4401, 1.09)];

		const { stopAreas } = groupStopAreas(stops, new Map());
		const { stopAreas: reversed } = groupStopAreas([...stops].reverse(), new Map());

		expect([...stopAreas.keys()]).toEqual(["a"]);
		expect([...reversed.keys()]).toEqual(["a"]);
	});
});
