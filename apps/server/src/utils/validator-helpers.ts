import { validator } from "hono/validator";
import type { core, ZodObject } from "zod";

export const MAX_NETWORK_IDS = 10;

export const BOUNDS_ERROR = { message: "South-west bounds must not exceed north-east bounds." };

export const isOrderedBounds = (bounds: { swLat: number; swLon: number; neLat: number; neLon: number }) =>
	bounds.swLat <= bounds.neLat && bounds.swLon <= bounds.neLon;

export const createJsonValidator = <Shape extends core.$ZodShape, Config extends core.$ZodObjectConfig>(
	schema: ZodObject<Shape, Config>,
) =>
	validator("json", (values, c) => {
		const parsed = schema.safeParse(values);
		if (!parsed.success) {
			c.status(400);
			return c.json({
				status: 400,
				code: "INVALID_JSON_PAYLOAD",
				message: 'JSON payload is invalid, please check "issues" for more information.',
				issues: parsed.error.issues,
			});
		}
		return parsed.data;
	});

export const createParamValidator = <Shape extends core.$ZodShape, Config extends core.$ZodObjectConfig>(
	schema: ZodObject<Shape, Config>,
) =>
	validator("param", (values, c) => {
		const parsed = schema.safeParse(values);
		if (!parsed.success) {
			c.status(400);
			return c.json({
				status: 400,
				code: "INVALID_PATH_PARAMETERS",
				message: 'Path parameters are invalid, please check "issues" for more information.',
				issues: parsed.error.issues,
			});
		}
		return parsed.data;
	});

export const createQueryValidator = <Shape extends core.$ZodShape, Config extends core.$ZodObjectConfig>(
	schema: ZodObject<Shape, Config>,
) =>
	validator("query", (values, c) => {
		const parsed = schema.safeParse(values);
		if (!parsed.success) {
			c.status(400);
			return c.json({
				status: 400,
				code: "INVALID_QUERY_PARAMETERS",
				message: 'Query parameters are invalid, please check "issues" for more information.',
				issues: parsed.error.issues,
			});
		}
		return parsed.data;
	});
