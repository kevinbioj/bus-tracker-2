import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BusFrontIcon, ChevronRight } from "lucide-react";
import { useState } from "react";
import { match, P } from "ts-pattern";
import { GetNetworkQuery } from "~/api/networks";
import { OnlineLines } from "~/components/interactive-map/online/online-lines";

import { OnlineNetworks } from "~/components/interactive-map/online/online-networks";
import { OnlineVehicles } from "~/components/interactive-map/online/online-vehicles";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet";
import { cn } from "~/utils/utils";

export function OnlineSheet() {
	const [open, setOpen] = useState(false);

	const [networkId, setNetworkId] = useState<number>();
	const [lineId, setLineId] = useState<number>();

	const { data: network } = useQuery(GetNetworkQuery(networkId, true));

	const back = () => {
		if (typeof lineId !== "undefined") {
			setLineId(undefined);
		} else if (typeof networkId !== "undefined") {
			setNetworkId(undefined);
		}
	};

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger asChild>
				<a
					aria-label="Véhicules en ligne"
					className="leaflet-bar-part leaflet-bar-part-single"
					// biome-ignore lint/a11y/useValidAnchor: required by Leaflet
					href="#"
				>
					<BusFrontIcon className="inline mb-0.5" />
				</a>
			</SheetTrigger>
			<SheetContent aria-describedby={undefined} className="">
				<SheetHeader>
					<SheetTitle className="flex items-center gap-2">
						{typeof networkId !== "undefined" ? (
							<Button onClick={back} size="xs" variant="branding-default">
								<ArrowLeft />
							</Button>
						) : null}
						<div className="flex items-center gap-0.5 flex-wrap leading-none">
							{typeof networkId === "undefined" ? (
								"Véhicules en ligne"
							) : (
								<>
									<span className={cn(lineId && "max-w-36 text-ellipsis overflow-x-hidden text-nowrap")}>
										{network?.name}
									</span>
									{typeof lineId !== "undefined" ? (
										<>
											{" "}
											<ChevronRight className="size-4" /> {network?.lines.find(({ id }) => id === lineId)?.number}
										</>
									) : null}
								</>
							)}
						</div>
					</SheetTitle>
					<div className="h-[93.5dvh] overflow-y-auto pb-3">
						{match([networkId, lineId])
							.with([undefined, undefined], () => <OnlineNetworks updateNetwork={setNetworkId} />)
							.with([P.number, undefined], ([networkId]) => (
								<OnlineLines networkId={networkId} updateLine={setLineId} />
							))
							.with([P.number, P.number], ([, lineId]) => (
								<OnlineVehicles closeSheet={() => setOpen(false)} lineId={lineId} />
							))
							.otherwise(() => null)}
					</div>
				</SheetHeader>
			</SheetContent>
		</Sheet>
	);
}
