import { Link } from "@tanstack/react-router";
import { MapIcon } from "lucide-react";

import * as m from "~/paraglide/messages";
import { DataPageAction } from "~/routes/_app/data/-components/data-page-header";

type ViewOnMapButtonProps = {
	/** Filtre à appliquer à la carte : une ligne précise ou un réseau entier. */
	search: { "line-id": number } | { "network-id": number };
};

export function ViewOnMapButton({ search }: Readonly<ViewOnMapButtonProps>) {
	return <DataPageAction icon={MapIcon} label={m.view_on_map()} link={<Link search={search} to="/" />} />;
}
