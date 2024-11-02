import { validator } from "hono/validator";
import type { ZodTypeDef } from "zod";

export const createQueryValidator = <O, D extends ZodTypeDef, I>(schema: Zod.Schema<O, D, I>) =>
	validator("query", (values, c) => {
		const parsed = schema.safeParse(values);
		if (!parsed.success) {
			return c.json({
				code: 400,
				message: 'Query parameters are invalid, please check "issues" for more information.',
				issues: parsed.error.issues,
			});
		}
		return parsed.data;
	});

export const createParamValidator = <O, D extends ZodTypeDef, I>(schema: Zod.Schema<O, D, I>) =>
	validator("param", (values, c) => {
		const parsed = schema.safeParse(values);
		if (!parsed.success) {
			return c.json({
				code: 400,
				message: 'Path parameters are invalid, please check "issues" for more information.',
				issues: parsed.error.issues,
			});
		}
		return parsed.data;
	});
