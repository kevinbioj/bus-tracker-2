import { SearchIcon, XIcon } from "lucide-react";

import { Input } from "~/components/ui/input";
import * as m from "~/paraglide/messages";

type FilterModuleSearchBarProperties = {
	placeholder: string;
	query: string;
	onQueryChange: (search: string) => unknown;
};

export function FilterModuleSearchBar({ placeholder, query, onQueryChange }: FilterModuleSearchBarProperties) {
	return (
		<div className="relative shrink-0">
			<SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				aria-label={placeholder}
				className="h-9 pr-9 pl-9"
				placeholder={placeholder}
				value={query}
				onChange={(e) => onQueryChange(e.target.value)}
			/>
			{query.length > 0 && (
				<button
					aria-label={m.map_search_clear()}
					className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-branding/50"
					onClick={() => onQueryChange("")}
					type="button"
				>
					<XIcon className="size-4" />
				</button>
			)}
		</div>
	);
}
