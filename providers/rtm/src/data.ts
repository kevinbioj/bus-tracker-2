import { Temporal } from "temporal-polyfill";

export type Line = {
	LineNumber: string;
	LineName: string;
	LineId: string;
	Color: string;
	Mode: "Metro" | "Tramway" | "Bus" | "Ferry";
};

const linesEndpoint = atob("aHR0cHM6Ly9jYXJ0ZS1pbnRlcmFjdGl2ZS5ydG0uZnIvY29udGVudC9MaW5lcy5qc29u");

export async function getLines() {
	const params = new URLSearchParams();
	params.append("d", Date.now().toString());

	const response = await fetch(`${linesEndpoint}?${params.toString()}`);
	if (!response.ok) throw new Error(`Failed to fetch lines from API (HTTP ${response.status})`);

	return ((await response.json()) as { data: Line[] }).data;
}

export type Vehicle = {
	Id: string;
	Line: string;
	Direction: "1" | "2";
	Latitude: number;
	Longitude: number;
};

const vehiclesEndpoint = atob("aHR0cHM6Ly9jYXJ0ZS1pbnRlcmFjdGl2ZS5ydG0uZnIvV1Mvc2lyaS9WZWhpY2xlcw==");

export async function getVehicles(lines: string[]) {
	const response = await fetch(`${vehiclesEndpoint}?lines=${lines.join(";")}&d=${Date.now()}`);
	if (!response.ok) throw new Error(`Failed to fetch vehicles from API (HTTP ${response.status})`);

	const vehicles = (await response.json()) as Vehicle[];
	return {
		recordedAt: Temporal.Instant.fromEpochMilliseconds(
			new Date(response.headers.get("Date")!).getTime(),
		).toZonedDateTimeISO("Europe/Paris"),
		vehicles,
	};
}
