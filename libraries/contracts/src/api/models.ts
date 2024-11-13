import { z } from "zod";

export const network = z.object({
	id: z.number(),
	ref: z.string(),
	name: z.string(),
	authority: z.string().nullable(),
	logoHref: z.string().url().nullable(),
	color: z.string().length(6).nullable(),
	textColor: z.string().length(6).nullable(),
});

export type Network = z.infer<typeof network>;

export const girouette = z.object({
	id: z.number(),
	networkId: z.number(),
	lineId: z.number().nullable(),
	directionId: z.number().nullable(),
	destinations: z.array(z.string()),
	data: z.string(),
});

export type Girouette = z.infer<typeof girouette>;
