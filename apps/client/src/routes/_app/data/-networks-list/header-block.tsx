import { SearchIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { Input } from "~/components/ui/input";
import * as m from "~/paraglide/messages";
import { useNetworksListSearchQuery } from "~/routes/_app/data/-networks-list/use-search-query";
import { cn } from "~/utils/cn";

export function NetworksListHeaderBlock({ className, ...props }: ComponentProps<"div">) {
	const [searchQuery, setSearchQuery] = useNetworksListSearchQuery();

	return (
		<div className={cn("bg-background z-1", className)} {...props}>
			<div className="max-w-(--breakpoint-xl) mx-auto p-3">
				<div className="mb-2">
					<h1 className="font-bold text-2xl">{m.networks_list_title()}</h1>
					<p className="text-muted-foreground">{m.networks_list_description()}</p>
				</div>
				<div className="relative">
					<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
					<Input
						className="pl-9"
						placeholder={m.networks_list_search_placeholder()}
						value={searchQuery ?? ""}
						onChange={(e) => setSearchQuery(e.target.value || null)}
					/>
				</div>
			</div>
		</div>
	);
}
