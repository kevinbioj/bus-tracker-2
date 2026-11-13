import { Buffer } from "node:buffer";
import { open } from "node:fs/promises";

const EOCD_SIGNATURE = 0x06054b50;
const EOCD_MIN_LENGTH = 22;
const MAX_COMMENT_LENGTH = 0xffff;

/**
 * Removes stray bytes appended after the end of central directory record.
 *
 * Some GTFS producers pad their archive with trailing bytes, which yauzl rejects
 * while most other tools ignore them.
 */
export function trimZipTrailingBytes(buffer: Buffer) {
	const searchEnd = buffer.length - EOCD_MIN_LENGTH;
	const searchStart = Math.max(0, searchEnd - MAX_COMMENT_LENGTH);

	for (let offset = searchEnd; offset >= searchStart; offset--) {
		if (buffer.readUInt32LE(offset) !== EOCD_SIGNATURE) continue;

		const commentLength = buffer.readUInt16LE(offset + 20);
		const expectedLength = offset + EOCD_MIN_LENGTH + commentLength;

		return expectedLength < buffer.length ? buffer.subarray(0, expectedLength) : buffer;
	}

	return buffer;
}

export async function trimZipFileTrailingBytes(path: string) {
	const handle = await open(path, "r+");
	try {
		const { size } = await handle.stat();
		const tailLength = Math.min(size, EOCD_MIN_LENGTH + MAX_COMMENT_LENGTH);
		const tail = Buffer.alloc(tailLength);
		await handle.read(tail, 0, tailLength, size - tailLength);
		const trailingBytes = tail.length - trimZipTrailingBytes(tail).length;
		if (trailingBytes > 0) await handle.truncate(size - trailingBytes);
	} finally {
		await handle.close();
	}
}
