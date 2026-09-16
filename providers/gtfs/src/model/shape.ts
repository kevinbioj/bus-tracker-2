import type { VehicleJourneyPath } from "@bus-tracker/contracts";

import { getDirection } from "../utils/get-direction.js";
import { getDistance } from "../utils/get-distance.js";

const pathCache = new WeakMap<Shape, VehicleJourneyPath>();

export class Shape {
	constructor(
		readonly id: string,
		private readonly points: Float64Array,
		readonly recalculatedDistances = false,
	) {}

	get length() {
		return this.points.length / 3;
	}

	getPointLatitude(index: number) {
		return this.points[index * 3]!;
	}

	getPointLongitude(index: number) {
		return this.points[index * 3 + 1]!;
	}

	getPointDistanceTraveled(index: number) {
		return this.points[index * 3 + 2];
	}

	getPoint(index: number): [number, number] {
		return [this.getPointLatitude(index), this.getPointLongitude(index)];
	}

	/** Indice du point du tracé le plus proche de la position donnée. */
	findClosestPointIndex(lat: number, lon: number) {
		let closestDist = Infinity;
		let closestIndex = 0;

		for (let i = 0; i < this.length; i++) {
			const pointLat = this.getPointLatitude(i);
			const pointLon = this.getPointLongitude(i);
			const dist = getDistance(lat, lon, pointLat, pointLon);

			if (dist < closestDist) {
				closestDist = dist;
				closestIndex = i;
			}
		}

		return closestIndex;
	}

	findClosestPointDistance(lat: number, lon: number) {
		return this.getPointDistanceTraveled(this.findClosestPointIndex(lat, lon)) || 0;
	}

	findPointIndex(distanceTraveled: number) {
		let low = 0;
		let high = this.length - 1;

		while (low <= high) {
			const mid = (low + high) >>> 1;
			const midDist = this.getPointDistanceTraveled(mid);
			if (midDist === undefined) {
				return undefined;
			}

			if (midDist < distanceTraveled) {
				low = mid + 1;
			} else if (midDist > distanceTraveled) {
				high = mid - 1;
			} else {
				return mid;
			}
		}

		return Math.max(0, high);
	}

	/**
	 * Projette une distance curviligne sur le tracé : interpolation linéaire entre les deux
	 * points de shape qui l'encadrent, et cap du segment ainsi obtenu.
	 */
	interpolateAt(distanceTraveled: number): { latitude: number; longitude: number; bearing: number } | undefined {
		const pointIndex = this.findPointIndex(distanceTraveled);
		if (pointIndex === undefined) return;

		const nextPointIndex = Math.min(pointIndex + 1, this.length - 1);

		const currentDistance = this.getPointDistanceTraveled(pointIndex);
		const nextDistance = this.getPointDistanceTraveled(nextPointIndex);
		if (currentDistance === undefined || nextDistance === undefined) return;

		const currentLatitude = this.getPointLatitude(pointIndex);
		const currentLongitude = this.getPointLongitude(pointIndex);
		const nextLatitude = this.getPointLatitude(nextPointIndex);
		const nextLongitude = this.getPointLongitude(nextPointIndex);

		const pointRatio =
			nextDistance === currentDistance ? 0 : (distanceTraveled - currentDistance) / (nextDistance - currentDistance);

		return {
			latitude: currentLatitude + (nextLatitude - currentLatitude) * pointRatio,
			longitude: currentLongitude + (nextLongitude - currentLongitude) * pointRatio,
			bearing: getDirection(currentLongitude, currentLatitude, nextLongitude, nextLatitude),
		};
	}

	/**
	 * Projette une position sur le tracé : le point du tracé le plus proche d'elle, cherché sur les
	 * segments et non parmi les seuls sommets, et sa distance en mètres.
	 *
	 * Retourne undefined pour un tracé vide.
	 */
	projectPosition(latitude: number, longitude: number) {
		if (this.length === 0) return;
		if (this.length === 1) {
			const pointLatitude = this.getPointLatitude(0);
			const pointLongitude = this.getPointLongitude(0);
			return {
				latitude: pointLatitude,
				longitude: pointLongitude,
				distance: getDistance(latitude, longitude, pointLatitude, pointLongitude),
			};
		}

		// Projection équirectangulaire locale : la longitude est corrigée par cos(lat) pour que les
		// écarts restent comparables sur les deux axes autour de la position mesurée.
		const cosLat = Math.cos((latitude * Math.PI) / 180);
		const px = longitude * cosLat;
		const py = latitude;

		// Le segment le plus proche est choisi sur les écarts planaires, qui suffisent à les classer à
		// cette échelle ; la distance n'est mesurée qu'une fois, sur le vainqueur. Cette méthode est
		// appelée pour chaque point d'un tracé entier : un haversine par segment coûterait cent fois plus.
		let closestOffsetSquared = Number.POSITIVE_INFINITY;
		let closestLatitude = latitude;
		let closestLongitude = longitude;

		for (let i = 0; i < this.length - 1; i++) {
			const aLat = this.getPointLatitude(i);
			const aLon = this.getPointLongitude(i);
			const bLat = this.getPointLatitude(i + 1);
			const bLon = this.getPointLongitude(i + 1);

			const ax = aLon * cosLat;
			const ay = aLat;
			const dx = bLon * cosLat - ax;
			const dy = bLat - ay;
			const segmentLengthSquared = dx * dx + dy * dy;

			let t = segmentLengthSquared === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / segmentLengthSquared;
			t = Math.max(0, Math.min(1, t));

			const offsetX = px - (ax + t * dx);
			const offsetY = py - (ay + t * dy);
			const offsetSquared = offsetX * offsetX + offsetY * offsetY;

			if (offsetSquared < closestOffsetSquared) {
				closestOffsetSquared = offsetSquared;
				closestLatitude = aLat + t * (bLat - aLat);
				closestLongitude = aLon + t * (bLon - aLon);
			}
		}

		return {
			latitude: closestLatitude,
			longitude: closestLongitude,
			distance: getDistance(latitude, longitude, closestLatitude, closestLongitude),
		};
	}

	/** Distance en mètres entre la position donnée et le tracé. */
	distanceToPosition(latitude: number, longitude: number) {
		return this.projectPosition(latitude, longitude)?.distance ?? Number.POSITIVE_INFINITY;
	}

	/**
	 * Extrait la portion de tracé comprise entre deux positions, chacune ramenée au point du tracé
	 * qui lui est le plus proche.
	 *
	 * Le découpage est purement géométrique : `shape_dist_traveled` est absent de nombreux GTFS, et
	 * les distances curvilignes n'y sont alors pas exploitables.
	 *
	 * Retourne un tableau vide si les deux positions se projettent sur le même point, ou dans
	 * l'ordre inverse de celui du tracé.
	 */
	sliceBetweenPositions(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
		const fromIndex = this.findClosestPointIndex(from.latitude, from.longitude);
		const toIndex = this.findClosestPointIndex(to.latitude, to.longitude);
		if (toIndex <= fromIndex) return [];

		const points: [number, number][] = [];
		for (let i = fromIndex; i <= toIndex; i++) {
			points.push(this.getPoint(i));
		}
		return points;
	}

	/** Les points du tracé, dans l'ordre, sans leurs distances curvilignes. */
	getPoints(): [number, number][] {
		const points: [number, number][] = new Array(this.length);
		for (let i = 0; i < this.length; i++) {
			points[i] = this.getPoint(i);
		}
		return points;
	}

	asPath(): VehicleJourneyPath {
		const cached = pathCache.get(this);
		if (cached) return cached;

		const p: [number, number, number | undefined][] = [];
		for (let i = 0; i < this.length; i++) {
			const longitude = this.getPointLongitude(i);
			const latitude = this.getPointLatitude(i);
			const distanceTraveled = this.getPointDistanceTraveled(i);
			p.push([
				Math.round(latitude * 1000000) / 1000000,
				Math.round(longitude * 1000000) / 1000000,
				distanceTraveled ? Math.round(distanceTraveled * 10) / 10 : undefined,
			]);
		}

		const result = { p };
		pathCache.set(this, result);
		return result;
	}
}
