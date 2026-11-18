import { validator } from "hono/validator";
import { type core, type ZodObject, z } from "zod";

export const MAX_NETWORK_IDS = 10;

const MAX_DATABASE_ID = 2_147_483_647;

export const idSchema = z.coerce.number().int().min(0).max(MAX_DATABASE_ID);

export const jsonIdSchema = z.number().int().min(0).max(MAX_DATABASE_ID);

/** Un identifiant ou une liste d'identifiants, toujours rendus en liste. */
export const idListSchema = (max: number) =>
	z
		.union([idSchema, z.array(idSchema).max(max)])
		.optional()
		.transform((values) => (typeof values === "number" ? [values] : values));

export const boundsQueryShape = {
	swLat: z.coerce.number().min(-90).max(90),
	swLon: z.coerce.number().min(-180).max(180),
	neLat: z.coerce.number().min(-90).max(90),
	neLon: z.coerce.number().min(-180).max(180),
};

export const BOUNDS_ERROR = { message: "South-west bounds must not exceed north-east bounds." };

export const isOrderedBounds = (bounds: { swLat: number; swLon: number; neLat: number; neLon: number }) =>
	bounds.swLat <= bounds.neLat && bounds.swLon <= bounds.neLon;

const createValidator =
	<Target extends "json" | "param" | "query">(target: Target, code: string, invalid: string) =>
	<Shape extends core.$ZodShape, Config extends core.$ZodObjectConfig>(schema: ZodObject<Shape, Config>) =>
		validator(target, (values, c) => {
			const parsed = schema.safeParse(values);
			if (!parsed.success) {
				c.status(400);
				return c.json({
					status: 400,
					code,
					message: `${invalid}, please check "issues" for more information.`,
					issues: parsed.error.issues,
				});
			}
			return parsed.data;
		});

export const createJsonValidator = createValidator("json", "INVALID_JSON_PAYLOAD", "JSON payload is invalid");
export const createParamValidator = createValidator("param", "INVALID_PATH_PARAMETERS", "Path parameters are invalid");
export const createQueryValidator = createValidator(
	"query",
	"INVALID_QUERY_PARAMETERS",
	"Query parameters are invalid",
);
