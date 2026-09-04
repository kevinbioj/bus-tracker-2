import { Buffer } from "node:buffer";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32 } from "node:zlib";

import decompress from "@xhmikosr/decompress";
import { afterEach, describe, expect, it } from "vitest";

import { trimZipTrailingBytes } from "./trim-zip-trailing-bytes.js";

/** Builds a minimal single-entry zip archive using the "stored" method. */
function createZip(fileName: string, contents: string, comment = "") {
	const name = Buffer.from(fileName);
	const data = Buffer.from(contents);
	const checksum = crc32(data);

	const localHeader = Buffer.alloc(30);
	localHeader.writeUInt32LE(0x04034b50, 0);
	localHeader.writeUInt16LE(20, 4);
	localHeader.writeUInt32LE(checksum, 14);
	localHeader.writeUInt32LE(data.length, 18);
	localHeader.writeUInt32LE(data.length, 22);
	localHeader.writeUInt16LE(name.length, 26);

	const centralHeader = Buffer.alloc(46);
	centralHeader.writeUInt32LE(0x02014b50, 0);
	centralHeader.writeUInt16LE(20, 4);
	centralHeader.writeUInt16LE(20, 6);
	centralHeader.writeUInt32LE(checksum, 16);
	centralHeader.writeUInt32LE(data.length, 20);
	centralHeader.writeUInt32LE(data.length, 24);
	centralHeader.writeUInt16LE(name.length, 28);
	centralHeader.writeUInt32LE(0, 42);

	const centralDirectory = Buffer.concat([centralHeader, name]);
	const centralDirectoryOffset = localHeader.length + name.length + data.length;

	const endOfCentralDirectory = Buffer.alloc(22);
	endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
	endOfCentralDirectory.writeUInt16LE(1, 8);
	endOfCentralDirectory.writeUInt16LE(1, 10);
	endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
	endOfCentralDirectory.writeUInt32LE(centralDirectoryOffset, 16);
	endOfCentralDirectory.writeUInt16LE(comment.length, 20);

	return Buffer.concat([localHeader, name, data, centralDirectory, endOfCentralDirectory, Buffer.from(comment)]);
}

const directories: string[] = [];

const extractInto = async (buffer: Buffer) => {
	const directory = await mkdtemp(join(tmpdir(), "trim-zip-"));
	directories.push(directory);
	await decompress(buffer, directory);
	return directory;
};

afterEach(async () => {
	await Promise.all(directories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

describe("trimZipTrailingBytes", () => {
	it("removes stray bytes appended after the end of central directory", () => {
		const zip = createZip("agency.txt", "agency_id,agency_name\n1,Palm Bus\n");
		const padded = Buffer.concat([zip, Buffer.from([0x00])]);

		expect(trimZipTrailingBytes(padded)).toStrictEqual(zip);
	});

	it("leaves a well-formed archive untouched", () => {
		const zip = createZip("agency.txt", "agency_id,agency_name\n1,Palm Bus\n");

		expect(trimZipTrailingBytes(zip)).toStrictEqual(zip);
	});

	it("preserves a declared archive comment", () => {
		const zip = createZip("agency.txt", "agency_id,agency_name\n1,Palm Bus\n", "produced by palm bus");

		expect(trimZipTrailingBytes(zip)).toStrictEqual(zip);
	});

	it("leaves a buffer without an end of central directory untouched", () => {
		const notAZip = Buffer.from("agency_id,agency_name\n1,Palm Bus\n");

		expect(trimZipTrailingBytes(notAZip)).toStrictEqual(notAZip);
	});

	it("makes a padded archive extractable again", async () => {
		const contents = "agency_id,agency_name\n1,Palm Bus\n";
		const padded = Buffer.concat([createZip("agency.txt", contents), Buffer.from([0x00])]);

		await expect(extractInto(padded)).rejects.toThrow(/comment length/i);

		const directory = await extractInto(trimZipTrailingBytes(padded));
		await expect(readFile(join(directory, "agency.txt"), "utf8")).resolves.toBe(contents);
	});
});
