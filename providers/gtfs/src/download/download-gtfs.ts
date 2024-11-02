import { Buffer } from "node:buffer";
import decompress from "decompress";

export async function downloadGtfs(staticResourceHref: string, outputDirectory: string) {
	const response = await fetch(staticResourceHref, {
		signal: AbortSignal.timeout(30_000),
	});

	if (!response.ok) {
		throw new Error(`Download from '${staticResourceHref}' failed (${response.status}).`);
	}

	const arrayBuffer = await response.arrayBuffer();
	const buffer = Buffer.from(arrayBuffer);

	try {
		await decompress(buffer, outputDirectory);
	} catch (cause) {
		throw new Error(`Failed to extract resource into '${outputDirectory}'.`, {
			cause,
		});
	}
}
