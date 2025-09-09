import { vehicleJourneyLineTypes } from "@bus-tracker/contracts";
import { type InferSelectModel, sql } from "drizzle-orm";
import {
	boolean,
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

export const regionsTable = pgTable("region", {
	id: serial("id").primaryKey(),
	name: varchar("name").notNull(),
	sortOrder: integer("sort_order").notNull().unique(),
});

export type RegionEntity = InferSelectModel<typeof regionsTable>;

export const networksTable = pgTable("network", {
	id: serial("id").primaryKey(),
	ref: varchar("ref").notNull().unique(),
	name: varchar("name").notNull(),
	authority: varchar("authority"),
	timezone: varchar("timezone").notNull().default("Europe/Paris"),
	logoHref: varchar("logo_href"),
	darkModeLogoHref: varchar("dark_mode_logo_href"),
	color: char("color", { length: 6 }),
	textColor: char("text_color", { length: 6 }),
	hasVehiclesFeature: boolean("has_vehicles_feature").notNull().default(false),
	regionId: integer("region_id").references(() => regionsTable.id),
});

export type NetworkEntity = InferSelectModel<typeof networksTable>;

export const operatorsTable = pgTable("operator", {
	id: serial("id").primaryKey(),
	networkId: integer("network_id")
		.notNull()
		.references(() => networksTable.id),
	ref: varchar("ref").notNull().unique(),
	name: varchar("name").notNull(),
	logoHref: varchar("logo_href"),
	sortOrder: integer("sort_order").notNull().default(0),
});

export type OperatorEntity = InferSelectModel<typeof operatorsTable>;

export const linesTable = pgTable(
	"line",
	{
		id: serial("id").primaryKey(),
		networkId: integer("network_id")
			.notNull()
			.references(() => networksTable.id),
		references: varchar("ref").array(),
		number: varchar("number").notNull(),
		girouetteNumber: varchar("girouette_number"),
		cartridgeHref: varchar("cartridge_href"),
		color: char("color", { length: 6 }),
		textColor: char("text_color", { length: 6 }),
		sortOrder: integer("sort_order"),
		archivedAt: timestamp("archived_at"),
	},
	(table) => [index("network_idx").on(table.networkId)],
);

export type LineEntity = InferSelectModel<typeof linesTable>;

export const girouettesTable = pgTable("girouette", {
	id: serial("id").primaryKey(),
	networkId: integer("network_id")
		.notNull()
		.references(() => networksTable.id),
	lineId: integer("line_id").references(() => linesTable.id),
	directionId: smallint("direction_id"),
	destinations: varchar("destinations").array(),
	data: json("data").notNull(),
	enabled: boolean("enabled").notNull().default(true),
});

export type GirouetteEntity = InferSelectModel<typeof girouettesTable>;

export const vehiclesTable = pgTable(
	"vehicle",
	{
		id: serial("id").primaryKey(),
		networkId: integer("network_id")
			.notNull()
			.references(() => networksTable.id),
		operatorId: integer("operator_id").references(() => operatorsTable.id),
		ref: varchar("ref").notNull(),
		type: varchar("type", {
			enum: vehicleJourneyLineTypes,
			length: 32,
		}).default("UNKNOWN"),
		number: varchar("number").notNull(),
		designation: varchar("designation"),
		tcId: integer("tc_id"),
		lastSeenAt: timestamp("last_seen_at", { precision: 0 }),
		archivedAt: timestamp("archived_at", { precision: 0 }),
	},
	(table) => [
		index("vehicle_network_index").on(table.networkId),
		index("vehicle_network_ref_index").on(table.networkId, table.ref),
	],
);

export type VehicleEntity = InferSelectModel<typeof vehiclesTable>;

export const lineActivitiesTable = pgTable(
	"line_activity",
	{
		id: serial("id").primaryKey(),
		vehicleId: integer("vehicle_id")
			.notNull()
			.references(() => vehiclesTable.id),
		lineId: integer("line_id")
			.notNull()
			.references(() => linesTable.id),
		serviceDate: date("service_date", { mode: "string" }).notNull(),
		startedAt: timestamp("started_at", { precision: 0 }).notNull(),
		updatedAt: timestamp("updated_at", { precision: 0 }).notNull(),
	},
	(table) => [
		index("line_activity_line_indeex").on(table.lineId),
		index("line_activity_vehicle_index").on(table.vehicleId),
		index("line_activity_vehicle_service_date_index").on(table.vehicleId, table.serviceDate),
	],
);

export type LineActivityEntity = InferSelectModel<typeof lineActivitiesTable>;

export const announcementsTable = pgTable("announcement", {
	id: serial("id").primaryKey(),
	title: varchar("title").notNull(),
	content: text("content"),
	type: varchar({ enum: ["INFO", "OUTAGE"] })
		.notNull()
		.default("INFO"),
	publishedAt: timestamp("published_at"),
	updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
	createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export type AnnouncementEntity = InferSelectModel<typeof announcementsTable>;

export const editorsTable = pgTable("editor", {
	id: serial("id").primaryKey(),
	username: varchar().notNull(),
	token: varchar().unique().notNull(),
	enabled: boolean().default(true),
	allowedNetworks: json("allowed_networks").notNull().default([]),
	lastSeenAt: timestamp("last_seen_at"),
	createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export type EditorEntity = InferSelectModel<typeof editorsTable>;

export const editionLogsTable = pgTable("edition_log", {
	id: serial("id").primaryKey(),
	editorId: integer("editor_id")
		.notNull()
		.references(() => editorsTable.id),
	networkId: integer("network_id")
		.notNull()
		.references(() => networksTable.id),
	lineId: integer("line_id").references(() => linesTable.id),
	vehicleId: integer("vehicle_id").references(() => vehiclesTable.id),
	updatedFields: json("updated_fields").notNull(),
	recordedAt: timestamp("recorded_at").notNull().default(sql`now()`),
});

export type EditionLogEntity = InferSelectModel<typeof editionLogsTable>;
