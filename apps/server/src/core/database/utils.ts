import { getTableColumns, type InferSelectModel } from "drizzle-orm";
import type { PgTableWithColumns, TableConfig } from "drizzle-orm/pg-core";
import type { RowList } from "postgres";

export function mapRowsToEntity<T extends TableConfig>(
	table: PgTableWithColumns<T>,
	rows: RowList<Record<string, unknown>[]>,
) {
	const columns = getTableColumns(table);

	return rows.map((row) => {
		const mapped: Record<string, unknown> = {};

		for (const [key, col] of Object.entries(columns)) {
			const rawValue = row[col.name];
			mapped[key] = rawValue !== null ? col.mapFromDriverValue(rawValue) : null;
		}

		return mapped as InferSelectModel<typeof table>;
	});
}
