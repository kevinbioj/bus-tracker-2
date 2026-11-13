import { Buffer } from "node:buffer";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32 } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";

import { extractGtfsArchive } from "./extract-gtfs-archive.js";

function createStoredZip(files: Record<string, string>) {
	const localParts: Buffer[] = [];
	const centralParts: Buffer[] = [];
	let offset = 0;
	for (const [name, content] of Object.entries(files)) {
		const fileName = Buffer.from(name, "utf8");
		const data = Buffer.from(content, "utf8");
		const checksum = crc32(data);

		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(20, 4);
		local.writeUInt16LE(0x0800, 6);
		local.writeUInt16LE(0, 8);
		local.writeUInt16LE(0, 10);
		local.writeUInt16LE(0x21, 12);
		local.writeUInt32LE(checksum, 14);
		local.writeUInt32LE(data.length, 18);
		local.writeUInt32LE(data.length, 22);
		local.writeUInt16LE(fileName.length, 26);
		local.writeUInt16LE(0, 28);
		localParts.push(local, fileName, data);

		const central = Buffer.alloc(46);
		central.writeUInt32LE(0x02014b50, 0);
		central.writeUInt16LE(20, 4);
		central.writeUInt16LE(20, 6);
		central.writeUInt16LE(0x0800, 8);
		central.writeUInt16LE(0, 10);
		central.writeUInt16LE(0, 12);
		central.writeUInt16LE(0x21, 14);
		central.writeUInt32LE(checksum, 16);
		central.writeUInt32LE(data.length, 20);
		central.writeUInt32LE(data.length, 24);
		central.writeUInt16LE(fileName.length, 28);
		central.writeUInt32LE(offset, 42);
		centralParts.push(central, fileName);

		offset += local.length + fileName.length + data.length;
	}
	const centralDirectory = Buffer.concat(centralParts);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(centralParts.length / 2, 8);
	end.writeUInt16LE(centralParts.length / 2, 10);
	end.writeUInt32LE(centralDirectory.length, 12);
	end.writeUInt32LE(offset, 16);
	return Buffer.concat([...localParts, centralDirectory, end]);
}

const directories: string[] = [];

const createDirectory = async () => {
	const directory = await mkdtemp(join(tmpdir(), "gtfs-archive-"));
	directories.push(directory);
	return directory;
};

const writeArchive = async (content: Buffer | string) => {
	const archivePath = join(await createDirectory(), "archive.zip");
	await writeFile(archivePath, content);
	return archivePath;
};

afterEach(async () => {
	await Promise.all(directories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

describe("extractGtfsArchive", () => {
	it("extrait les fichiers GTFS à la racine de l'archive", async () => {
		const stops = "stop_id,stop_name\na,A\n";
		const trips = "route_id,service_id,trip_id\nline,service,t1\n";
		const archivePath = await writeArchive(createStoredZip({ "stops.txt": stops, "trips.txt": trips }));
		const outputDirectory = await createDirectory();

		await expect(extractGtfsArchive(archivePath, outputDirectory)).resolves.toEqual(["stops.txt", "trips.txt"]);
		await expect(readFile(join(outputDirectory, "stops.txt"), "utf8")).resolves.toBe(stops);
		await expect(readFile(join(outputDirectory, "trips.txt"), "utf8")).resolves.toBe(trips);
	});

	it("ignore les fichiers que l'importeur ne lit pas", async () => {
		const archivePath = await writeArchive(
			createStoredZip({ "transfers.txt": "from_stop_id,to_stop_id\n", "feed_info.txt": "feed_publisher_name\n" }),
		);
		const outputDirectory = await createDirectory();

		await expect(extractGtfsArchive(archivePath, outputDirectory)).resolves.toEqual([]);
		await expect(readdir(outputDirectory)).resolves.toEqual([]);
	});

	it("ignore les fichiers rangés dans un sous-dossier", async () => {
		const archivePath = await writeArchive(createStoredZip({ "data/stops.txt": "stop_id,stop_name\na,A\n" }));
		const outputDirectory = await createDirectory();

		await expect(extractGtfsArchive(archivePath, outputDirectory)).resolves.toEqual([]);
		await expect(readdir(outputDirectory)).resolves.toEqual([]);
	});

	it("rejette une archive invalide", async () => {
		const archivePath = await writeArchive("not a zip");
		const outputDirectory = await createDirectory();

		await expect(extractGtfsArchive(archivePath, outputDirectory)).rejects.toThrow();
	});
});
