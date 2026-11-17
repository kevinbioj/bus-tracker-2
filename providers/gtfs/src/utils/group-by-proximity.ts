import { getDistance } from "./get-distance.js";

const METERS_PER_DEGREE_LATITUDE = 111_320;

type Coordinates = { latitude: number; longitude: number };

export function isValidCoordinates({ latitude, longitude }: Coordinates) {
	return (
		Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 85 && Math.abs(longitude) <= 180
	);
}

type Cell = {
	members: number[];
	minLatitude: number;
	maxLatitude: number;
	minLongitude: number;
	maxLongitude: number;
};

/**
 * Regroupe les éléments dont les positions sont à moins de `thresholdMeters` les unes des autres.
 * Les groupes sont les composantes connexes de cette relation : si A est proche de B et B de C, les
 * trois forment un seul groupe, même si A et C sont plus éloignés que le seuil.
 *
 * Chaque élément appartient à exactement un groupe ; un élément isolé forme un groupe à lui seul,
 * de même qu'un élément aux coordonnées invalides. Au sein d'un groupe, les éléments conservent leur
 * ordre d'entrée.
 */
export function groupByProximity<T>(items: T[], getPosition: (item: T) => Coordinates, thresholdMeters: number): T[][] {
	const positions = items.map(getPosition);

	// La diagonale d'une cellule reste sous le seuil : deux éléments d'une même cellule sont proches
	// sans calcul de distance, et une foule d'éléments au même point se regroupe en temps linéaire.
	const cellMeters = thresholdMeters / 1.5;
	const reach = Math.ceil(thresholdMeters / cellMeters);
	const rowOf = (latitude: number) => Math.floor((latitude * METERS_PER_DEGREE_LATITUDE) / cellMeters);
	// Chaque rangée a sa propre échelle de longitude, prise en son milieu : les colonnes d'une rangée
	// mesurent bien `cellMeters` d'est en ouest, à toute latitude.
	const columnOf = (longitude: number, row: number) => {
		const rowLatitude = ((row + 0.5) * cellMeters) / METERS_PER_DEGREE_LATITUDE;
		const metersPerDegreeLongitude = METERS_PER_DEGREE_LATITUDE * Math.cos((rowLatitude * Math.PI) / 180);
		return Math.floor((longitude * metersPerDegreeLongitude) / cellMeters);
	};

	const cells = new Map<string, Cell>();
	positions.forEach((position, index) => {
		if (!isValidCoordinates(position)) return;
		const { latitude, longitude } = position;
		const row = rowOf(latitude);
		const key = `${row}:${columnOf(longitude, row)}`;
		const cell = cells.get(key);
		if (cell === undefined) {
			cells.set(key, {
				members: [index],
				minLatitude: latitude,
				maxLatitude: latitude,
				minLongitude: longitude,
				maxLongitude: longitude,
			});
		} else {
			cell.members.push(index);
			cell.minLatitude = Math.min(cell.minLatitude, latitude);
			cell.maxLatitude = Math.max(cell.maxLatitude, latitude);
			cell.minLongitude = Math.min(cell.minLongitude, longitude);
			cell.maxLongitude = Math.max(cell.maxLongitude, longitude);
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

	for (const { members } of cells.values()) {
		for (let index = 1; index < members.length; index++) union(members[0]!, members[index]!);
	}

	// Distance minimale entre les emprises de deux cellules : au-delà du seuil, aucune paire de leurs
	// éléments ne peut être proche, et la comparaison deux à deux est évitée.
	const boundsDistance = (a: Cell, b: Cell) => {
		const latitude = Math.max(a.minLatitude, Math.min(b.minLatitude, a.maxLatitude));
		const otherLatitude = Math.max(b.minLatitude, Math.min(latitude, b.maxLatitude));
		const longitude = Math.max(a.minLongitude, Math.min(b.minLongitude, a.maxLongitude));
		const otherLongitude = Math.max(b.minLongitude, Math.min(longitude, b.maxLongitude));
		return getDistance(latitude, longitude, otherLatitude, otherLongitude);
	};

	for (const [key, cell] of cells) {
		const separator = key.indexOf(":");
		const row = Number(key.slice(0, separator));
		const longitude = positions[cell.members[0]!]!.longitude;

		for (let neighborRow = row - reach; neighborRow <= row + reach; neighborRow++) {
			const column = columnOf(longitude, neighborRow);
			for (let neighborColumn = column - reach - 1; neighborColumn <= column + reach + 1; neighborColumn++) {
				const neighborKey = `${neighborRow}:${neighborColumn}`;
				if (neighborKey === key) continue;
				const neighbor = cells.get(neighborKey);
				if (neighbor === undefined) continue;
				if (find(cell.members[0]!) === find(neighbor.members[0]!)) continue;
				if (boundsDistance(cell, neighbor) > thresholdMeters) continue;

				search: for (const index of cell.members) {
					const { latitude, longitude } = positions[index]!;
					for (const otherIndex of neighbor.members) {
						const other = positions[otherIndex]!;
						if (getDistance(latitude, longitude, other.latitude, other.longitude) > thresholdMeters) continue;
						union(index, otherIndex);
						break search;
					}
				}
			}
		}
	}

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
