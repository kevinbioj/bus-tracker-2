import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { USER_AGENT } from "../constants.js";
import type { Source } from "../model/source.js";
import { getAuthHeaders } from "../utils/auth.js";
import { readFreshness } from "../utils/fetch-freshness.js";
import { trimZipFileTrailingBytes } from "../utils/trim-zip-trailing-bytes.js";
import { extractGtfsArchive } from "./extract-gtfs-archive.js";

export async function downloadGtfsArchive(source: Source, archivePath: string) {
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

	const hash = createHash("sha256");
	await pipeline(
		Readable.fromWeb(response.body),
		async function* (chunks: AsyncIterable<Uint8Array>) {
			for await (const chunk of chunks) {
				hash.update(chunk);
				yield chunk;
			}
		},
		createWriteStream(archivePath),
	);

	return { ...readFreshness(response.headers), hash: hash.digest("base64") };
}

export async function extractGtfs(archivePath: string, outputDirectory: string) {
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
