import type { SourceOptions } from "../model/source.js";

export type Configuration = {
	id: string;
	computeDelayMs: number;
	computeConcurrency?: number;
	sources: ({ id: string } & SourceOptions)[];
};
