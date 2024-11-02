export type ShapePoint = {
	sequence: number;
	latitude: number;
	longitude: number;
	distanceTraveled: number;
};

export class Shape {
	constructor(
		readonly id: string,
		readonly points: ShapePoint[],
	) {}
}
