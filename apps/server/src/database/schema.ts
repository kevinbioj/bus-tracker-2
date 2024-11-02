import type { InferSelectModel } from "drizzle-orm";
import {
	char,
	customType,
	date,
	index,
	integer,
	json,
	pgTable,
	serial,
	smallint,
	text,
	varchar,
} from "drizzle-orm/pg-core";
import { Temporal } from "temporal-polyfill";

export const timestamp = customType<{
	data: Temporal.Instant;
	driverData: string;
	config: { precision?: number };
}>({
	dataType(config) {
		const precision = typeof config?.precision !== "undefined" ? ` (${config.precision})` : "";
		return `timestamp${precision}`;
	},
	fromDriver(value) {
		return Temporal.Instant.from(`${value.replace(" ", "T")}Z`);
	},
	toDriver(value) {
		return value.toString();
	},
});

export const networks = pgTable("network", {
	id: serial("id").primaryKey(),
	ref: varchar("ref").notNull().unique(),
	name: varchar("name").notNull(),
	authority: varchar("authority"),
	logoHref: varchar("logo_href"),
	color: char("color", { length: 6 }),
	textColor: char("text_color", { length: 6 }),
});

export type Network = InferSelectModel<typeof networks>;

export const operators = pgTable("operator", {
	id: serial("id").primaryKey(),
	networkId: integer("network_id")
		.notNull()
		.references(() => networks.id),
	ref: varchar("ref").notNull().unique(),
	name: varchar("name").notNull(),
	logoHref: varchar("logo_href"),
});

export type Operator = InferSelectModel<typeof operators>;

export const lines = pgTable("line", {
	id: serial("id").primaryKey(),
	networkId: integer("network_id")
		.notNull()
		.references(() => networks.id),
	ref: varchar("ref").notNull(),
	number: varchar("number").notNull(),
	cartridgeHref: varchar("cartridge_href"),
	color: char("color", { length: 6 }),
	textColor: char("text_color", { length: 6 }),
	archivedAt: timestamp("archived_at"),
});

export type Line = InferSelectModel<typeof lines>;

export const girouettes = pgTable("girouette", {
	id: serial("id").primaryKey(),
	networkId: integer("network_id")
		.notNull()
		.references(() => networks.id),
	lineId: integer("line_id").references(() => lines.id),
	directionId: smallint("direction_id"),
	destinations: varchar("destinations").array(),
	data: json("data").notNull(),
});

export type Girouette = InferSelectModel<typeof girouettes>;

export const vehicles = pgTable(
	"vehicle",
	{
		id: serial("id").primaryKey(),
		networkId: integer("network_id")
			.notNull()
			.references(() => networks.id),
		operatorId: integer("operator_id").references(() => operators.id),
		ref: varchar("ref").notNull(),
		number: varchar("number").notNull(),
		designation: varchar("designation"),
		tcId: integer("tc_id"),
		lastSeenAt: timestamp("last_seen_at", { precision: 0 }),
		archivedAt: timestamp("archived_at", { precision: 0 }),
	},
	(table) => ({
		networkIndex: index("vehicle_network_index").on(table.operatorId),
	}),
);

export type Vehicle = InferSelectModel<typeof vehicles>;

export const lineActivities = pgTable(
	"line_activity",
	{
		id: serial("id").primaryKey(),
		vehicleId: integer("vehicle_id")
			.notNull()
			.references(() => vehicles.id),
		lineId: integer("line_id")
			.notNull()
			.references(() => lines.id),
		serviceDate: date("service_date", { mode: "string" }).notNull(),
		startedAt: timestamp("started_at", { precision: 0 }).notNull(),
		updatedAt: timestamp("updated_at", { precision: 0 }).notNull(),
	},
	(table) => ({
		vehicleIndex: index("line_activity_vehicle_index").on(table.vehicleId),
	}),
);

export type LineActivity = InferSelectModel<typeof lineActivities>;

// export const currentVehicleActivities = pgView("current_vehicle_activity").as((qb) =>
// 	qb
// 		.select({ vehicleId: vehicles.id, lineId: lineActivities.lineId, since: lineActivities.startedAt })
// 		.from(lineActivities)
// 		// .where(lt(sql`EXTRACT(EPOCH from (CURRENT_TIMESTAMP - ${lineActivities.updatedAt}))`, 600_000))
// 		.rightJoin(vehicles, eq(vehicles.id, lineActivities.vehicleId)),
// );

export const mercatoActivity = pgTable(
	"mercato_activity",
	{
		id: serial("id").primaryKey(),
		vehicleId: integer("vehicle_id")
			.notNull()
			.references(() => vehicles.id),
		fromNetworkId: integer("from_network_id")
			.notNull()
			.references(() => networks.id),
		toNetworkId: integer("to_network_id")
			.notNull()
			.references(() => networks.id),
		comment: text("comment"),
		recordedAt: timestamp("recorded_at", { precision: 0 }).notNull(),
	},
	(table) => ({
		vehicleIndex: index("mercato_activity_vehicle_index").on(table.vehicleId),
	}),
);

export type MercatoActivity = InferSelectModel<typeof mercatoActivity>;
