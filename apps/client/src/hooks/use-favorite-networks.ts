import { useLocalStorage } from "usehooks-ts";

export function useFavoriteNetworkIds() {
	const [favoriteNetworkIds, setFavoriteNetworkIds] = useLocalStorage("favorite-networks", new Set<number>(), {
		deserializer: (value) => new Set(JSON.parse(value)),
		serializer: (value) => JSON.stringify(Array.from(value.values())),
	});

	const toggleFavoriteNetworkId = (networkId: number) => {
		setFavoriteNetworkIds((previous) => {
			const updated = new Set(previous);
			if (!updated.delete(networkId)) updated.add(networkId);
			return updated;
		});
	};

	return [favoriteNetworkIds, toggleFavoriteNetworkId] as const;
}
