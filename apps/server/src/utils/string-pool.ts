/**
 * Réserve de chaînes partagées. Le clone structuré qui transporte les courses du worker en recrée une
 * copie par course et par lot : `stopRef`, `stopName` ou la destination d'un même arrêt existent
 * alors en autant d'exemplaires que de courses qui le desservent. Les faire pointer sur une seule
 * instance laisse les copies au ramasse-miettes.
 *
 * La réserve est renouvelée passé `maxSize` entrées, pour ne pas retenir indéfiniment les chaînes
 * d'arrêts que plus aucune course ne dessert : les courses en mémoire gardent les leurs, et la
 * nouvelle réserve se reconstitue au lot suivant.
 */
export function createStringPool(maxSize = 500_000) {
	let pool = new Map<string, string>();

	return {
		intern<T extends string | undefined>(value: T): T {
			if (value === undefined) return value;
			const interned = pool.get(value);
			if (interned !== undefined) return interned as T;
			if (pool.size >= maxSize) pool = new Map();
			pool.set(value, value);
			return value;
		},
		get size() {
			return pool.size;
		},
	};
}
