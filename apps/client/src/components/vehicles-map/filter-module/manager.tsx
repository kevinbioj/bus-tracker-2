import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { GetNetworkQuery, type Network } from "~/api/networks";
import { Sheet, SheetContent } from "~/components/ui/sheet";
import { FilterModuleLinesList } from "~/components/vehicles-map/filter-module/line/lines-list";
import type { MapFilter } from "~/components/vehicles-map/filter-module/map-filter";
import { FilterModuleNetworkList } from "~/components/vehicles-map/filter-module/network/networks-list";
import { cn } from "~/utils/cn";

type FilterModuleManagerProps = {
	fixedNetworkId?: number;
	onFilterChange: (filter?: MapFilter) => void;
	open: boolean;
	setOpen: (open: boolean) => void;
};

export function FilterModuleManager({
	fixedNetworkId,
	onFilterChange,
	open,
	setOpen,
}: Readonly<FilterModuleManagerProps>) {
	const { data: fixedNetwork } = useQuery(GetNetworkQuery(fixedNetworkId));

	const popupRef = useRef<HTMLDivElement>(null);
	const resetNetworkOnClose = useRef(false);
	const [selectedNetwork, setSelectedNetwork] = useState<Network>();
	const [regionKey, setRegionKey] = useState<string>();
	const [networkSearchQuery, setNetworkSearchQuery] = useState("");

	const network = fixedNetwork ?? selectedNetwork;

	const depth = network !== undefined ? 2 : regionKey !== undefined ? 1 : 0;
	const viewKey = network !== undefined ? `network-${network.id}` : `region-${regionKey ?? ""}`;
	const [transition, setTransition] = useState<{ open: boolean; depth: number; direction?: "forward" | "back" }>({
		open,
		depth,
	});
	if (transition.open !== open) {
		setTransition({ open, depth });
	} else if (transition.depth !== depth) {
		setTransition({ open, depth, direction: depth > transition.depth ? "forward" : "back" });
	}
	const onBack = fixedNetwork ? undefined : () => setSelectedNetwork(undefined);

	const goBack = () => {
		if (network !== undefined) {
			onBack?.();
			return onBack !== undefined;
		}
		if (regionKey !== undefined) {
			setRegionKey(undefined);
			setNetworkSearchQuery("");
			return true;
		}
		return false;
	};

	return (
		<Sheet
			open={open}
			onOpenChange={(open, { reason }) => {
				if (!open && reason === "escape-key" && goBack()) return;
				setOpen(open);
			}}
			onOpenChangeComplete={(open) => {
				if (open || !resetNetworkOnClose.current) return;
				resetNetworkOnClose.current = false;
				setSelectedNetwork(undefined);
			}}
		>
			<SheetContent
				ref={popupRef}
				className="z-999 gap-0 overflow-hidden font-sans"
				initialFocus={() => (window.matchMedia("(pointer: coarse)").matches ? popupRef.current : true)}
				showCloseButton={false}
			>
				<div
					className={cn(
						"flex min-h-0 flex-1 flex-col",
						transition.direction !== undefined && "animate-in fade-in duration-200 ease-out motion-reduce:animate-none",
						transition.direction === "forward" && "slide-in-from-right-8",
						transition.direction === "back" && "slide-in-from-left-8",
					)}
					key={viewKey}
				>
					{network === undefined ? (
						<FilterModuleNetworkList
							regionKey={regionKey}
							onRegionKeyChange={setRegionKey}
							searchQuery={networkSearchQuery}
							onSearchQueryChange={setNetworkSearchQuery}
							onNetworkSelect={setSelectedNetwork}
						/>
					) : (
						<FilterModuleLinesList
							network={network}
							open={open}
							onBack={onBack}
							onClose={() => setOpen(false)}
							onLineChange={(line) => {
								if (line !== undefined) {
									onFilterChange({ kind: "line", network, line });
									setOpen(false);
								}
							}}
							// En mode embarqué le réseau est déjà l'intégralité de ce qui s'affiche.
							onNetworkChange={
								fixedNetworkId !== undefined
									? undefined
									: (network) => {
											onFilterChange({ kind: "network", network });
											resetNetworkOnClose.current = true;
											setOpen(false);
										}
							}
						/>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
