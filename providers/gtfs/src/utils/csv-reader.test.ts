import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readCsv } from "./csv-reader.js";

describe("readCsv", () => {
	let directory: string;

	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), "bt-csv-reader-"));
	});

	afterEach(async () => {
		await rm(directory, { recursive: true, force: true });
	});

	const writeRows = async (rowCount: number) => {
		const path = join(directory, "stops.txt");
		const rows = Array.from({ length: rowCount }, (_, index) => `stop-${index}`);
		await writeFile(path, ["stop_id", ...rows].join("\n"));
		return path;
	};

	it("lit toutes les lignes jusqu'au plafond", async () => {
		const path = await writeRows(10);
		const ids: string[] = [];

		await readCsv<{ stop_id: string }>(path, (record) => ids.push(record.stop_id), { maxRows: 10 });

		expect(ids).toHaveLength(10);
	});

	it("rejette un fichier qui dépasse le plafond, sans lire au-delà", async () => {
		const path = await writeRows(1_000);
		let readRows = 0;

		await expect(
			readCsv<{ stop_id: string }>(
				path,
				() => {
					readRows += 1;
				},
				{ maxRows: 10 },
			),
		).rejects.toThrow("'stops.txt' has more than 10 rows.");
		expect(readRows).toBe(10);
	});
});
