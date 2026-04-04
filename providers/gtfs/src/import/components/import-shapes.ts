import { join } from "node:path";

import { Shape } from "../../model/shape.js";
import { type CsvRecord, readCsv } from "../../utils/csv-reader.js";
import { fileExists } from "../../utils/file-exists.js";
import { getDistance } from "../../utils/get-distance.js";

import type { ImportGtfsOptions } from "../import-gtfs.js";

type ShapeRecord = CsvRecord<"shape_id" | "shape_pt_lat" | "shape_pt_lon" | "shape_pt_sequence", "shape_dist_traveled">;

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
		let currentDist = 0;

		const computeDistances = options.computeShapeDistTraveled && data.dists.some((dist) => dist === undefined);

		for (let i = 0; i < indices.length; i++) {
			const idx = indices[i]!;
			const lat = data.lats[idx]!;
			const lon = data.lons[idx]!;

			if (computeDistances) {
				if (i > 0) {
					const prevIdx = indices[i - 1]!;
					currentDist += getDistance(data.lats[prevIdx]!, data.lons[prevIdx]!, lat, lon);
				}
				data.dists[idx] = currentDist;
			}

			typedPoints[i * 3] = lat;
			typedPoints[i * 3 + 1] = lon;
			typedPoints[i * 3 + 2] = data.dists[idx]!;
		}

		shapes.set(id, new Shape(id, typedPoints, computeDistances));
	}

	return shapes;
}
