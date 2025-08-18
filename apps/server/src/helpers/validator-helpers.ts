import { validator } from "hono/validator";
import type { ZodObject, core } from "zod";

export const createQueryValidator = <Shape extends core.$ZodShape, Config extends core.$ZodObjectConfig>(
	schema: ZodObject<Shape, Config>,
) =>
	validator("query", (values, c) => {
		const parsed = schema.safeParse(values);
		if (!parsed.success) {
			c.status(400);
			return c.json({
				code: 400,
				message: 'Query parameters are invalid, please check "issues" for more information.',
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
				code: 400,
				message: 'Path parameters are invalid, please check "issues" for more information.',
				issues: parsed.error.issues,
			});
		}
		return parsed.data;
	});

export const createJsonValidator = <Shape extends core.$ZodShape, Config extends core.$ZodObjectConfig>(
	schema: ZodObject<Shape, Config>,
) =>
	validator("json", (values, c) => {
		const parsed = schema.safeParse(values);
		if (!parsed.success) {
			c.status(400);
			return c.json({
				code: 400,
				message: 'JSON payload is invalid, please check "issues" for more information.',
				issues: parsed.error.issues,
			});
		}
		return parsed.data;
	});
