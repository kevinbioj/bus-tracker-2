import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { USER_AGENT } from "../constants.js";
import type { Source } from "../model/source.js";
import { getAuthHeaders } from "../utils/auth.js";
import { trimZipFileTrailingBytes } from "../utils/trim-zip-trailing-bytes.js";
import { extractGtfsArchive } from "./extract-gtfs-archive.js";

export async function downloadGtfs(source: Source, outputDirectory: string) {
	const response = await fetch(source.options.staticResourceHref, {
		headers: {
			"User-Agent": USER_AGENT,
			...getAuthHeaders(source.options.staticAuth ?? source.options.auth),
		},
		signal: AbortSignal.timeout(30_000),
	});

	if (!response.ok || response.body === null) {
		throw new Error(`Download from '${source.options.staticResourceHref}' failed (${response.status}).`);
	}

	const archivePath = join(outputDirectory, "resource.zip");
	await pipeline(Readable.fromWeb(response.body), createWriteStream(archivePath));

	try {
		await trimZipFileTrailingBytes(archivePath);
		await extractGtfsArchive(archivePath, outputDirectory);
	} catch (cause) {
		throw new Error(`Failed to extract resource into '${outputDirectory}'.`, {
			cause,
		});
	} finally {
		await rm(archivePath, { force: true });
	}
}
