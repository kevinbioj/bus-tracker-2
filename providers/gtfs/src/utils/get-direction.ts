const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

export function getDirection(lon1: number, lat1: number, lon2: number, lat2: number) {
	const φ1 = toRad(lat1);
	const φ2 = toRad(lat2);
	const Δλ = toRad(lon2 - lon1);

	const x = Math.sin(Δλ) * Math.cos(φ2);
	const y = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

	const θ = Math.atan2(x, y);
	return (toDeg(θ) + 360) % 360;
}
