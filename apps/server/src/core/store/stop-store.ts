export type Stop = {
	name: string;
	latitude?: number;
	longitude?: number;
};

export const stopStore = new Map<string, Stop>();
