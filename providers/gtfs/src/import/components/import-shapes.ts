import { join } from "node:path";

import { Shape } from "../../model/shape.js";
import { type CsvRecord, readCsv } from "../../utils/csv-reader.js";
import { fileExists } from "../../utils/file-exists.js";

import type { ImportGtfsOptions } from "../import-gtfs.js";

type ShapeRecord = CsvRecord<"shape_id" | "shape_pt_lat" | "shape_pt_lon" | "shape_pt_sequence", "shape_dist_traveled">;

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
	const R = 6371000; // Rayon de la Terre en mètres
	const φ1 = (lat1 * Math.PI) / 180;
	const φ2 = (lat2 * Math.PI) / 180;
	const Δφ = ((lat2 - lat1) * Math.PI) / 180;
	const Δλ = ((lon2 - lon1) * Math.PI) / 180;

	const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return R * c;
}

export async function importShapes(gtfsDirectory: string, options: ImportGtfsOptions) {
	const shapes = new Map<string, Shape>();
	if (options.shapesStrategy === "IGNORE") return shapes;

	const shapesFile = join(gtfsDirectory, "shapes.txt");
	if (await fileExists(shapesFile)) {
		await readCsv<ShapeRecord>(shapesFile, (shapeRecord) => {
			let shape = shapes.get(shapeRecord.shape_id);
			if (shape === undefined) {
				shape = new Shape(shapeRecord.shape_id, []);
				shapes.set(shapeRecord.shape_id, shape);
			}

			shape.points.push({
				sequence: +shapeRecord.shape_pt_sequence,
				latitude: +shapeRecord.shape_pt_lat,
				longitude: +shapeRecord.shape_pt_lon,
				distanceTraveled: shapeRecord.shape_dist_traveled !== undefined ? +shapeRecord.shape_dist_traveled : -1,
			});
		});
	}

	for (const shape of shapes.values()) {
		shape.points.sort((a, b) => a.sequence - b.sequence);

		if (shape.points.some((point) => point.distanceTraveled === -1)) {
			let cumulativeDistance = 0;
			shape.points[0]!.distanceTraveled = 0;
			for (let i = 1; i < shape.points.length; i++) {
				const p1 = shape.points[i - 1]!;
				const p2 = shape.points[i]!;
				cumulativeDistance += getDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
				p2.distanceTraveled = cumulativeDistance;
			}
		}
	}

	return shapes;
}
