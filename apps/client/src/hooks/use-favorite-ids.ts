import { useCallback } from "react";
import { useLocalStorage } from "usehooks-ts";

/** Identifiants marqués en favori, gardés dans le navigateur sous la clé donnée. */
export function useFavoriteIds(storageKey: "favorite-lines" | "favorite-networks") {
	const [favoriteIds, setFavoriteIds] = useLocalStorage(storageKey, new Set<number>(), {
		deserializer: (value) => new Set(JSON.parse(value)),
		serializer: (value) => JSON.stringify(Array.from(value.values())),
	});

	const toggleFavoriteId = useCallback(
		(id: number) => {
			setFavoriteIds((previous) => {
				const updated = new Set(previous);
				if (!updated.delete(id)) updated.add(id);
				return updated;
			});
		},
		[setFavoriteIds],
	);

	return [favoriteIds, toggleFavoriteId] as const;
}

export const useFavoriteNetworkIds = () => useFavoriteIds("favorite-networks");
