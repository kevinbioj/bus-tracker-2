import * as z from "zod";

export const paginationSchema = z.object({
	limit: z.coerce
		.number()
		.int("Limit must be an integer")
		.min(10, "Limit must be within [10; 10000]")
		.max(10000, "Limit must be within [10; 100000]")
		.default(10000),
	page: z.coerce.number().int("Page must be an integer").min(0, "Page must be a positive integer").default(0),
});
