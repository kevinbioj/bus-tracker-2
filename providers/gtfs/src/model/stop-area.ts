import type { Stop } from "./stop.js";

/**
 * Regroupement des quais d'un même lieu, seule granularité d'arrêt présentée sur la carte. Il naît
 * d'une `parent_station` lorsque le GTFS en déclare une, et d'un rapprochement par nom et proximité
 * sinon — beaucoup de jeux français se contentent d'un arrêt par sens, sans station parente.
 */
export class StopArea {
	constructor(
		readonly id: string,
		readonly name: string,
		readonly latitude: number,
		readonly longitude: number,
		readonly stops: Stop[],
	) {}
}
