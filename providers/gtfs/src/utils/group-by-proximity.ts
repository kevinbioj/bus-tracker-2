import { getDistance } from "./get-distance.js";

const METERS_PER_DEGREE_LATITUDE = 111_320;

type Coordinates = { latitude: number; longitude: number };

/**
 * Regroupe les éléments dont les positions sont à moins de `thresholdMeters` les unes des autres.
 * Les groupes sont les composantes connexes de cette relation : si A est proche de B et B de C, les
 * trois forment un seul groupe, même si A et C sont plus éloignés que le seuil.
 *
 * Chaque élément appartient à exactement un groupe ; un élément isolé forme un groupe à lui seul.
 * Au sein d'un groupe, les éléments conservent leur ordre d'entrée.
 */
export function groupByProximity<T>(items: T[], getPosition: (item: T) => Coordinates, thresholdMeters: number): T[][] {
	const positions = items.map(getPosition);

	// Indexation par cellule de la taille du seuil : deux points proches tombent forcément dans la
	// même cellule ou dans une cellule voisine, ce qui borne les comparaisons au voisinage immédiat.
	const cellSizeDegrees = thresholdMeters / METERS_PER_DEGREE_LATITUDE;
	const cells = new Map<string, number[]>();
	const getCellKey = (latitude: number, longitude: number) =>
		`${Math.floor(latitude / cellSizeDegrees)}:${Math.floor(longitude / cellSizeDegrees)}`;

	positions.forEach(({ latitude, longitude }, index) => {
		const key = getCellKey(latitude, longitude);
		const cell = cells.get(key);
		if (cell === undefined) {
			cells.set(key, [index]);
		} else {
			cell.push(index);
		}
	});

	const parents = items.map((_, index) => index);
	const find = (index: number): number => {
		let root = index;
		while (parents[root] !== root) root = parents[root]!;
		let current = index;
		while (parents[current] !== root) {
			const next = parents[current]!;
			parents[current] = root;
			current = next;
		}
		return root;
	};
	const union = (a: number, b: number) => {
		const rootA = find(a);
		const rootB = find(b);
		if (rootA !== rootB) parents[Math.max(rootA, rootB)] = Math.min(rootA, rootB);
	};

	positions.forEach(({ latitude, longitude }, index) => {
		const cellLatitude = Math.floor(latitude / cellSizeDegrees);
		const cellLongitude = Math.floor(longitude / cellSizeDegrees);

		for (let dLat = -1; dLat <= 1; dLat++) {
			for (let dLon = -1; dLon <= 1; dLon++) {
				const cell = cells.get(`${cellLatitude + dLat}:${cellLongitude + dLon}`);
				if (cell === undefined) continue;

				for (const otherIndex of cell) {
					if (otherIndex <= index) continue;
					const other = positions[otherIndex]!;
					if (getDistance(latitude, longitude, other.latitude, other.longitude) > thresholdMeters) continue;
					union(index, otherIndex);
				}
			}
		}
	});

	const groups = new Map<number, T[]>();
	items.forEach((item, index) => {
		const root = find(index);
		const group = groups.get(root);
		if (group === undefined) {
			groups.set(root, [item]);
		} else {
			group.push(item);
		}
	});

	return Array.from(groups.values());
}
