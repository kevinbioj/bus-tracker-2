import { inArray } from "drizzle-orm";

import { database } from "../database/database.js";
import { type LineEntity, linesTable } from "../database/schema.js";

import type { CachedValue } from "./cache.js";

const cache = new Map<number, CachedValue<LineEntity>>();

export async function fetchLines(ids: number[]) {
	const cachedLines = ids.reduce((map, id) => {
		const cachedLine = cache.get(id);
		if (typeof cachedLine === "undefined" || Date.now() - cachedLine.lastUpdated > 60_000) {
			return map;
		}

		map.set(id, cachedLine.data);
		return map;
	}, new Map<number, LineEntity>());

	const missingLineIds = ids.filter((id) => !cachedLines.has(id));
	if (missingLineIds.length > 0) {
		const missingLines = await database.select().from(linesTable).where(inArray(linesTable.id, missingLineIds));

		for (const missingLine of missingLines) {
			cache.set(missingLine.id, {
				data: missingLine,
				lastUpdated: Date.now(),
			});

			cachedLines.set(missingLine.id, missingLine);
		}
	}

	return cachedLines;
}
