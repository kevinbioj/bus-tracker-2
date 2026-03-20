import { join } from "node:path";

import { Shape } from "../../model/shape.js";
import { type CsvRecord, readCsv } from "../../utils/csv-reader.js";
import { fileExists } from "../../utils/file-exists.js";

import type { ImportGtfsOptions } from "../import-gtfs.js";

type ShapeRecord = CsvRecord<"shape_id" | "shape_pt_lat" | "shape_pt_lon" | "shape_pt_sequence", "shape_dist_traveled">;

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
	const R = 6371000;
	const φ1 = (lat1 * Math.PI) / 180;
	const φ2 = (lat2 * Math.PI) / 180;
	const Δφ = ((lat2 - lat1) * Math.PI) / 180;
	const Δλ = ((lon2 - lon1) * Math.PI) / 180;

	const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return R * c;
}

// Structure plus compacte pour l'import temporaire
type RawShapeData = {
	lats: number[];
	lons: number[];
	seqs: number[];
	dists: (number | undefined)[];
};

export async function importShapes(gtfsDirectory: string, options: ImportGtfsOptions) {
	const rawShapes = new Map<string, RawShapeData>();
	if (options.shapesStrategy === "IGNORE") return new Map<string, Shape>();

	const shapesFile = join(gtfsDirectory, "shapes.txt");
	if (await fileExists(shapesFile)) {
		await readCsv<ShapeRecord>(shapesFile, (shapeRecord) => {
			let data = rawShapes.get(shapeRecord.shape_id);
			if (data === undefined) {
				data = { lats: [], lons: [], seqs: [], dists: [] };
				rawShapes.set(shapeRecord.shape_id, data);
			}

			data.lats.push(+shapeRecord.shape_pt_lat);
			data.lons.push(+shapeRecord.shape_pt_lon);
			data.seqs.push(+shapeRecord.shape_pt_sequence);
			data.dists.push(shapeRecord.shape_dist_traveled !== undefined ? +shapeRecord.shape_dist_traveled : undefined);
		});
	}

	const shapes = new Map<string, Shape>();

	const shapeIds = Array.from(rawShapes.keys());
	for (const id of shapeIds) {
		const data = rawShapes.get(id)!;
		rawShapes.delete(id);

		const indices = Array.from({ length: data.seqs.length }, (_, i) => i);
		indices.sort((a, b) => data.seqs[a]! - data.seqs[b]!);

		const typedPoints = new Float64Array(indices.length * 3);
		for (let i = 0; i < indices.length; i++) {
			const idx = indices[i]!;
			typedPoints[i * 3] = data.lats[idx]!;
			typedPoints[i * 3 + 1] = data.lons[idx]!;
			typedPoints[i * 3 + 2] = data.dists[idx]!;
		}

		shapes.set(id, new Shape(id, typedPoints));
	}

	return shapes;
}
