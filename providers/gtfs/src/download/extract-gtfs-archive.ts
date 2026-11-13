import { createWriteStream } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import yauzl from "yauzl";

export const GTFS_FILE_NAMES = new Set([
	"agency.txt",
	"calendar.txt",
	"calendar_dates.txt",
	"routes.txt",
	"stops.txt",
	"trips.txt",
	"stop_times.txt",
	"shapes.txt",
]);

export async function extractGtfsArchive(archivePath: string, outputDirectory: string) {
	const zipfile = await yauzl.openPromise(archivePath, { autoClose: false });
	const extracted: string[] = [];
	try {
		for await (const entry of zipfile.eachEntry()) {
			if (!GTFS_FILE_NAMES.has(entry.fileName)) continue;
			const readStream = await zipfile.openReadStreamPromise(entry);
			await pipeline(readStream, createWriteStream(join(outputDirectory, entry.fileName)));
			extracted.push(entry.fileName);
		}
	} finally {
		zipfile.close();
	}
	return extracted;
}
