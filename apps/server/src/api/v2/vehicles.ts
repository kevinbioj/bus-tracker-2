import { vehicleJourneyLineTypes } from "@bus-tracker/contracts";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import { database } from "../../core/database/database.js";
import {
	networksTable,
	operatorsTable,
	vehicleArchiveReasons,
	vehiclesTable,
	type NetworkEntity,
	type OperatorEntity,
	type VehicleEntity,
} from "../../core/database/schema.js";

import { authMiddleware } from "../auth-middleware.js";
import { byIdParamValidator } from "../common-validators.js";
import { computeVehicleActiveness, type VehicleActiveness } from "../compute-vehicle-activeness.js";
import { createJsonValidator } from "../validator-helpers.js";

import { networkEntityToNetworkDto } from "./networks.js";
import { Temporal } from "temporal-polyfill";

const vehiclesApp = new Hono();

const vehicleEntityToVehicleDto = (
	vehicle: VehicleEntity,
	network: NetworkEntity,
	operator: OperatorEntity | null,
	activity?: VehicleActiveness,
) => ({
	id: vehicle.id,
	ref: vehicle.ref,
	number: vehicle.number,
	designation: vehicle.designation,
	links: { tcInfos: vehicle.tcId ? `https://tc-infos.fr/vehicule/${vehicle.tcId}` : null },
	network: networkEntityToNetworkDto(network),
	operator: operator !== null ? { id: operator.id, name: operator.name } : null,
	activity,
	archivedAt: vehicle.archivedAt,
	archivedFor: vehicle.archivedAt ? vehicle.archivedFor : null,
});

vehiclesApp.get("/:id", byIdParamValidator, async (c) => {
	const { id } = c.req.valid("param");

	const [result] = await database
		.select()
		.from(vehiclesTable)
		.innerJoin(networksTable, eq(networksTable.id, vehiclesTable.networkId))
		.leftJoin(operatorsTable, eq(operatorsTable.id, vehiclesTable.operatorId))
		.where(eq(vehiclesTable.id, id));

	if (typeof result === "undefined") {
		return c.json({ status: 404, code: "VEHICLE_NOT_FOUND", message: `No vehicle found with id '${id}'.` }, 404);
	}

	const { vehicle, network, operator } = result;
	const activity = await computeVehicleActiveness(vehicle);

	return c.json(vehicleEntityToVehicleDto(vehicle, network, operator, activity), 200);
});

vehiclesApp.put(
	"/:id",
	authMiddleware({ role: "ADMIN" }),
	byIdParamValidator,
	createJsonValidator(
		z.object({
			ref: z.string().regex(/^[^:\s]+:[^:\s]*:Vehicle:[^:\s]+$/, {
				error: 'Reference must match pattern "<NETWORK>:[OPERATOR]:Vehicle:<NUMBER>".',
			}),
			number: z.string(),
			designation: z.string().nullable(),
			tcId: z.number().nullable(),
			type: z.enum(vehicleJourneyLineTypes, { error: `Type must be one of ${vehicleJourneyLineTypes.join(", ")}.` }),
			operatorId: z.number().nullable(),
		}),
	),
	async (c) => {
		const author = c.get("user")!;

		const { id } = c.req.valid("param");
		const fields = c.req.valid("json");

		const [vehicle] = await database.select().from(vehiclesTable).where(eq(vehiclesTable.id, id));

		if (typeof vehicle === "undefined") {
			return c.json({ status: 404, code: "VEHICLE_NOT_FOUND", message: `No vehicle found with id '${id}'.` }, 404);
		}

		if (fields.ref !== vehicle.ref && author.role !== "ADMIN") {
			return c.json({ status: 400, code: "INVALID_FIELD", message: `You are not allowed to edit field "ref".` }, 400);
		}

		if (fields.operatorId !== null) {
			const [operator] = await database
				.select({ id: operatorsTable.id })
				.from(operatorsTable)
				.where(and(eq(operatorsTable.networkId, vehicle.networkId), eq(operatorsTable.id, fields.operatorId)));

			if (typeof operator === "undefined") {
				return c.json({
					status: 400,
					code: "UNKNOWN_OPERATOR",
					message: `No operator found with id '${fields.operatorId}'.`,
				});
			}
		}

		await database.update(vehiclesTable).set(fields);

		const [updatedResult] = await database
			.select()
			.from(vehiclesTable)
			.innerJoin(networksTable, eq(networksTable.id, vehiclesTable.networkId))
			.leftJoin(operatorsTable, eq(operatorsTable.id, vehiclesTable.operatorId))
			.where(eq(vehiclesTable.id, id));

		const activity = await computeVehicleActiveness(updatedResult!.vehicle);
		return c.json(
			vehicleEntityToVehicleDto(updatedResult!.vehicle, updatedResult!.network, updatedResult!.operator, activity),
			200,
		);
	},
);

vehiclesApp.post(
	"/:id/archive",
	authMiddleware({ role: "ADMIN" }),
	byIdParamValidator,
	createJsonValidator(
		z.object({
			archivedAt: z.iso
				.datetime({ error: "archivedAt must be a valid ISO timestamp" })
				.optional()
				.transform((value) => (value ? Temporal.Instant.from(value) : Temporal.Now.instant())),
			archivedFor: z.enum(vehicleArchiveReasons, {
				error: `archivedFor must be one of ${vehicleArchiveReasons.join(", ")}.`,
			}),
		}),
	),
	async (c) => {
		const { id } = c.req.valid("param");
		const fields = c.req.valid("json");

		const [vehicle] = await database.select().from(vehiclesTable).where(eq(vehiclesTable.id, id));

		if (typeof vehicle === "undefined") {
			return c.json({ status: 404, code: "VEHICLE_NOT_FOUND", message: `No vehicle found with id '${id}'.` }, 404);
		}

		await database.update(vehiclesTable).set({
			...fields,
			ref: "",
		});

		const [updatedResult] = await database
			.select()
			.from(vehiclesTable)
			.innerJoin(networksTable, eq(networksTable.id, vehiclesTable.networkId))
			.leftJoin(operatorsTable, eq(operatorsTable.id, vehiclesTable.operatorId))
			.where(eq(vehiclesTable.id, id));

		const activity = await computeVehicleActiveness(updatedResult!.vehicle);
		return c.json(
			vehicleEntityToVehicleDto(updatedResult!.vehicle, updatedResult!.network, updatedResult!.operator, activity),
			200,
		);
	},
);

export default vehiclesApp;
