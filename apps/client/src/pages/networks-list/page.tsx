import { NetworksListHeaderBlock } from "~/pages/networks-list/header-block";
import { NetworksListVirtualList } from "~/pages/networks-list/virtual-list";

export function NetworksListPage() {
	return (
		<>
			<title>Données des réseaux - Bus-Tracker</title>
			<main>
				<NetworksListHeaderBlock className="sticky top-15" />
				<NetworksListVirtualList />
			</main>
		</>
	);
}
