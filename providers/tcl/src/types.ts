export type TclGtfsRt = {
	entity: Array<{
		vehicle?: {
			timestamp: number;
			vehicle: {
				id: string;
			};
		};
	}>;
};
