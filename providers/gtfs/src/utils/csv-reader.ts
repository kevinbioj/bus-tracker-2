import { createReadStream } from "node:fs";
import { basename } from "node:path";
import Papa from "papaparse";

export type CsvRecord<RequiredKeys extends string = never, OptionalKeys extends string = never> = {
	[key in RequiredKeys]: string;
} & { [key in OptionalKeys]?: string };

type ReadCsvOptions = {
	delimiter?: string;
	encoding?: BufferEncoding;
	maxRows?: number;
};

const MAX_ROWS_BY_FILE: Record<string, number> = {
	"agency.txt": 10_000,
	"calendar.txt": 100_000,
	"calendar_dates.txt": 2_000_000,
	"routes.txt": 50_000,
	"shapes.txt": 50_000_000,
	"stop_times.txt": 40_000_000,
	"stops.txt": 500_000,
	"trips.txt": 2_000_000,
};
const DEFAULT_MAX_ROWS = 2_000_000;

async function readFirstBytes(path: string, size: number) {
	const chunks = [];
	for await (const chunk of createReadStream(path, {
		start: 0,
		end: size - 1,
	})) {
		chunks.push(chunk);
	}
	return Buffer.concat(chunks);
}

export async function readCsv<T extends CsvRecord<string>>(
	path: string,
	onRecord: (record: T) => void,
	{
		delimiter = ",",
		encoding = "utf-8",
		maxRows = MAX_ROWS_BY_FILE[basename(path)] ?? DEFAULT_MAX_ROWS,
	}: ReadCsvOptions = {},
) {
	const firstBytes = await readFirstBytes(path, 3);
	const hasBom = firstBytes.toString().codePointAt(0) === 0xfeff;
	const readStream = createReadStream(path, {
		encoding,
		start: hasBom ? 3 : 0,
	});
	return new Promise<void>((resolve, reject) => {
		let rowCount = 0;
		Papa.parse<T>(readStream, {
			complete: () => resolve(),
			delimiter,
			encoding,
			error: (error) => reject(error),
			header: true,
			skipEmptyLines: true,
			step: (results, parser) => {
				rowCount += 1;
				if (rowCount > maxRows) {
					reject(new Error(`'${basename(path)}' has more than ${maxRows} rows.`));
					parser.abort();
					readStream.destroy();
					return;
				}
				onRecord(results.data);
			},
		});
	});
}
