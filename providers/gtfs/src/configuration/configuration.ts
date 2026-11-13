import type { SourceOptions } from "../model/source.js";

export type Configuration = {
	id: string;
	computeDelayMs: number;
	computeConcurrency?: number;
	redisOptions: Parameters<typeof import("redis").createClient>[0];
	sources: ({ id: string } & SourceOptions)[];
};
