import { Link } from "@tanstack/react-router";
import { MapIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import * as m from "~/paraglide/messages";

type ViewOnMapButtonProps = {
	/** Filtre à appliquer à la carte : une ligne précise ou un réseau entier. */
	search: { "line-id": number } | { "network-id": number };
};

export function ViewOnMapButton({ search }: Readonly<ViewOnMapButtonProps>) {
	return (
		<Button
			size="sm"
			variant="outline"
			className="border-[0.5px] h-5 ml-2 my-0 py-0 px-2"
			title={m.view_on_map()}
			nativeButton={false}
			render={
				<Link to="/" search={search}>
					<MapIcon className="size-3.5" />
					{m.view_on_map()}
				</Link>
			}
		/>
	);
}
