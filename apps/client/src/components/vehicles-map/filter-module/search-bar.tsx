import { SearchIcon } from "lucide-react";

import { Input } from "~/components/ui/input";

type FilterModuleSearchBarProperties = {
	placeholder: string;
	query: string;
	onQueryChange: (search: string) => unknown;
};

export function FilterModuleSearchBar({ placeholder, query, onQueryChange }: FilterModuleSearchBarProperties) {
	return (
		<div className="mt-2 relative shrink-0 drop-shadow-sm">
			<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
			<Input
				className="pl-9 focus-visible:ring-0"
				placeholder={placeholder}
				value={query}
				onChange={(e) => onQueryChange(e.target.value)}
			/>
		</div>
	);
}
