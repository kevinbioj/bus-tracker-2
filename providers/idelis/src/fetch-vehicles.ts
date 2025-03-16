export type IdelisVehicle = {
	vehicle: string;
	ResponseTimestamp: string;
	ligne: {
		direction: 0 | 1;
		id: string;
		shape: { id: string; name: string; type: "stop" }[];
		arrivee: string;
	};
	latitude: string;
	longitude: string;
	RecordedAtTime: string;
	Delay: string;
	journey: IdelisJourneyCall[];
};

export type IdelisJourneyCall = {
	stop: string;
	DepartureTime: string;
	ArrivalTime: string;
};

export type IdelisResponse = {
	vehicules: { [k: string]: IdelisVehicle };
};

export async function fetchVehicles(lineId: string) {
	const headers = new Headers();
	headers.append("Referer", atob("aHR0cHM6Ly9pZGVsaXZlLmlkZWxpcy5mci8/dG9rZW49ZW1wdHk="));

	const response = await fetch(
		`${atob("aHR0cHM6Ly9pZGVsaXZlLmlkZWxpcy5mci9zaXJpL1ZlaGljbGVNb25pdG9yaW5nLw==")}?ligne=${lineId}`,
		{
			headers,
		},
	);
	if (!response.ok) throw new Error("Failed to fetch data from Idelis API");

	const payload = (await response.json()) as IdelisResponse;
	return Object.values(payload.vehicules);
}
