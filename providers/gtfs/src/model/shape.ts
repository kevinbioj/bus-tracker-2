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

	findClosestPointDistance(lat: number, lon: number) {
		let closestDist = Infinity;
		let closestPointDist = 0;

		for (let i = 0; i < this.length; i++) {
			const pointLat = this.getPointLatitude(i);
			const pointLon = this.getPointLongitude(i);
			const dist = getDistance(lat, lon, pointLat, pointLon);

			if (dist < closestDist) {
				closestDist = dist;
				closestPointDist = this.getPointDistanceTraveled(i) || 0;
			}
		}

		return closestPointDist;
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
