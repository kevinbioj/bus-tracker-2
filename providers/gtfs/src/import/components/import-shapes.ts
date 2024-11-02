import { join } from "node:path";

import { Shape } from "../../model/shape.js";
import { type CsvRecord, readCsv } from "../../utils/csv-reader.js";
import { fileExists } from "../../utils/file-exists.js";

import type { ImportGtfsOptions } from "../import-gtfs.js";

type ShapeRecord = CsvRecord<"shape_id" | "shape_pt_lat" | "shape_pt_lon" | "shape_pt_sequence", "shape_dist_traveled">;

export async function importShapes(gtfsDirectory: string, options: ImportGtfsOptions) {
	const shapes = new Map<string, Shape>();
	if (options.shapesStrategy === "IGNORE") return shapes;

	const shapesFile = join(gtfsDirectory, "shapes.txt");
	if (await fileExists(shapesFile)) {
		await readCsv<ShapeRecord>(shapesFile, (shapeRecord) => {
			if (typeof shapeRecord.shape_dist_traveled === "undefined") {
				return;
			}

			let shape = shapes.get(shapeRecord.shape_id);
			if (typeof shape === "undefined") {
				shape = new Shape(shapeRecord.shape_id, []);
				shapes.set(shapeRecord.shape_id, shape);
			}

			shape.points.push({
				sequence: +shapeRecord.shape_pt_sequence,
				latitude: +shapeRecord.shape_pt_lat,
				longitude: +shapeRecord.shape_pt_lon,
				distanceTraveled: +shapeRecord.shape_dist_traveled,
			});
		});
	}

	for (const shape of shapes.values()) {
		shape.points.sort((a, b) => a.sequence - b.sequence);
	}

	return shapes;
}
