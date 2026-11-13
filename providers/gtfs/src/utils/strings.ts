import { Buffer } from "node:buffer";

const SLICED_STRING_MIN_LENGTH = 13;

export function copyString(value: string) {
	if (value.length < SLICED_STRING_MIN_LENGTH) return value;
	return Buffer.from(value, "utf8").toString("utf8");
}

export function createInterner() {
	const pool = new Map<string, string>();
	return (value: string) => {
		let interned = pool.get(value);
		if (interned === undefined) {
			interned = copyString(value);
			pool.set(interned, interned);
		}
		return interned;
	};
}
