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
	) {}
}
