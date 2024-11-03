import type { Source } from "../model/source.js";

export function padSourceId(source: Source | string) {
	return (typeof source === "string" ? source : source.id).padStart(16, " ");
}
