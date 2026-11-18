import { eq, inArray } from "drizzle-orm";

import { database } from "../../core/database/database.js";
import { type LineEntity, linesTable } from "../../core/database/schema.js";
import { resolveLineRefs } from "../../core/services/line-ref-service.js";
import { ToolFailure } from "../define-tool.js";

export type LineLabel = Pick<LineEntity, "id" | "number" | "type" | "networkId">;

export async function loadLineLabels(lineIds: Iterable<number>) {
	const ids = [...new Set(lineIds)];
	if (ids.length === 0) return new Map<number, LineLabel>();

	const rows = await database
		.select({ id: linesTable.id, number: linesTable.number, type: linesTable.type, networkId: linesTable.networkId })
		.from(linesTable)
		.where(inArray(linesTable.id, ids));
	return new Map(rows.map((line) => [line.id, line]));
}

export async function lineNumbersOfRefs(lineRefs: string[]) {
	const resolved = await resolveLineRefs(lineRefs);
	const labels = await loadLineLabels([...resolved.values()].map((line) => line.id));
	return new Map(
		[...resolved].flatMap(([lineRef, { id }]) => {
			const label = labels.get(id);
			return label !== undefined ? [[lineRef, label] as const] : [];
		}),
	);
}

export async function getLine(lineId: number) {
	const [line] = await database.select().from(linesTable).where(eq(linesTable.id, lineId));
	if (line === undefined)
		throw new ToolFailure(`No line found with id ${lineId}. Use search_lines or get_network_lines.`);
	return line;
}

export const compareLineNumbers = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
