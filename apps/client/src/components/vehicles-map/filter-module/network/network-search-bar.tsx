import { SearchIcon } from "lucide-react";

import { Input } from "~/components/ui/input";

type NetworkSearchBarProperties = {
	query: string;
	onQueryChange: (search: string) => unknown;
};

export function NetworkSearchBar({ query, onQueryChange }: NetworkSearchBarProperties) {
	return (
		<div className="mx-3 relative shrink-0 drop-shadow-sm">
			<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
			<Input
				className="pl-9 focus-visible:ring-0"
				placeholder="Rechercher un réseau ou une ville..."
				value={query}
				onChange={(e) => onQueryChange(e.target.value)}
			/>
		</div>
	);
}
