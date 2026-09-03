import type { Buffer } from "node:buffer";

const EOCD_SIGNATURE = 0x06054b50;
const EOCD_MIN_LENGTH = 22;
const MAX_COMMENT_LENGTH = 0xffff;

/**
 * Removes stray bytes appended after the end of central directory record.
 *
 * Some GTFS producers pad their archive with trailing bytes, which yauzl (used
 * under the hood by decompress) rejects while most other tools ignore them.
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
