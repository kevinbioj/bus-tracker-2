export class Stop {
	constructor(
		readonly id: string,
		readonly name: string,
		readonly latitude: number,
		readonly longitude: number,
		readonly platformCode?: string,
		/**
		 * Fuseau horaire local de l'arrêt, uniquement lorsqu'il diffère de celui de l'agence :
		 * `undefined` signifie « identique à celui de l'agence ». Mutable car résolu en
		 * plusieurs temps à l'import (héritage de la station parente, puis élagage).
		 *
		 * Ne sert **qu'à la restitution** : les heures de `stop_times.txt` sont toujours
		 * exprimées dans le fuseau de l'agence (spec GTFS), et c'est ce fuseau-ci qui permet de
		 * réécrire l'instant obtenu en heure locale de l'arrêt.
		 */
		public timeZone?: string,
		/**
		 * Identifiant *brut* de la station parente déclarée par `parent_station`, avant application
		 * de `mapStopId` — c'est sous cette forme que `stops.txt` la référence. Sert au regroupement
		 * des quais en stations ({@link ../import/components/group-stop-areas.js}).
		 */
		readonly parentStationId?: string,
	) {}
}

/**
 * Station déclarée par `stops.txt` (`location_type = 1`). Elle n'est pas un arrêt desservi — aucune
 * desserte ne la référence — mais elle nomme et positionne le regroupement de ses quais.
 */
export type StationRecord = {
	id: string;
	name: string;
	latitude: number;
	longitude: number;
	/**
	 * Quais déclarés de la station (`location_type` 0), desservis ou non : un quai qu'aucune course
	 * théorique ne dessert peut encore être désigné par le temps réel (`assigned_stop_id`).
	 */
	platforms?: Stop[];
};
