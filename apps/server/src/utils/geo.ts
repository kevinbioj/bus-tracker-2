const EARTH_RADIUS_M = 6_371_000;
const toRadians = Math.PI / 180;

export type Coordinates = { latitude: number; longitude: number };

export function distanceMeters(from: Coordinates, to: Coordinates) {
	const dLat = (to.latitude - from.latitude) * toRadians;
	const dLon = (to.longitude - from.longitude) * toRadians;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(from.latitude * toRadians) * Math.cos(to.latitude * toRadians) * Math.sin(dLon / 2) ** 2;
	return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function boundsAround({ latitude, longitude }: Coordinates, radiusMeters: number) {
	const latitudeDelta = radiusMeters / EARTH_RADIUS_M / toRadians;
	const longitudeDelta = latitudeDelta / Math.max(Math.cos(latitude * toRadians), 0.01);
	return {
		swLat: Math.max(latitude - latitudeDelta, -90),
		swLon: Math.max(longitude - longitudeDelta, -180),
		neLat: Math.min(latitude + latitudeDelta, 90),
		neLon: Math.min(longitude + longitudeDelta, 180),
	};
}
