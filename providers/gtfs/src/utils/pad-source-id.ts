import type { Source } from "../model/source.js";

export function padSourceId(source: Source) {
	return source.id.padStart(16, " ");
}
