import type { SourceOptions } from "../model/source.js";

export type Configuration = {
	id: string;
	computeDelayMs: number;
	computeConcurrency?: number;
	computeTimeoutMs?: number;
	sources: ({ id: string } & SourceOptions)[];
};
