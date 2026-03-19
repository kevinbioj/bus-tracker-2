import { getTableColumns, type InferSelectModel } from "drizzle-orm";
import type { PgTableWithColumns, TableConfig } from "drizzle-orm/pg-core";

export function mapRowsToEntity<T extends TableConfig>(table: PgTableWithColumns<T>, rows: Record<string, unknown>[]) {
	const columns = getTableColumns(table);

	return rows.map((row) => {
		const mapped: Record<string, unknown> = {};

		for (const [key, col] of Object.entries(columns)) {
			const rawValue = row[col.name];
			mapped[key] = rawValue === null ? null : col.mapFromDriverValue(rawValue);
		}

		return mapped as InferSelectModel<typeof table>;
	});
}
