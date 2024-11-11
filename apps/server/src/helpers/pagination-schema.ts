import * as z from "zod";

export const paginationSchema = z.object({
	limit: z.coerce
		.number()
		.int("Limit must be an integer")
		.min(10, "Limit must be within [10; 100]")
		.max(1000, "Limit must be within [10; 1000]")
		.default(1000),
	page: z.coerce.number().int("Page must be an integer").min(0, "Page must be a positive integer").default(0),
});
