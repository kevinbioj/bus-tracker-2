const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Calculates the Haversine distance between two points in meters.
 */
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
	const R = 6371e3; // metres
	const φ1 = toRad(lat1);
	const φ2 = toRad(lat2);
	const Δφ = toRad(lat2 - lat1);
	const Δλ = toRad(lon2 - lon1);

	const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return R * c;
}
