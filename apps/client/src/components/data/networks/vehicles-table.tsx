import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useRef } from "react";
import { useMediaQuery } from "usehooks-ts";

import type { Vehicle } from "~/api/vehicles";
import { VehicleCard } from "~/components/data/networks/vehicle-card";

type VehiclesTableProps = {
	data: Vehicle[];
	searchParams: URLSearchParams;
};

export function VehiclesTable({ data, searchParams }: Readonly<VehiclesTableProps>) {
	const parentRef = useRef(null);

	const isDesktop = useMediaQuery("(min-width: 640px)");

	const virtualizer = useVirtualizer({
		count: data.length,
		getScrollElement: () => parentRef.current,
		estimateSize: useCallback(() => (isDesktop ? 64 : 105), [isDesktop]),
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: we force component height to be recomputed on viewport dimensions changes.
	useEffect(() => {
		virtualizer.measure();
	}, [isDesktop, virtualizer]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: we reset position when searchParams changes
	useEffect(() => {
		virtualizer.scrollToIndex(0, { behavior: "smooth" });
	}, [searchParams]);

	return (
		<div className="h-[calc(100dvh-298px)] overflow-auto" ref={parentRef}>
			<div className="w-full relative" style={{ height: `${virtualizer.getTotalSize()}px` }}>
				{virtualizer.getVirtualItems().map((virtualItem) => {
					const vehicle = data[virtualItem.index];
					return (
						<div
							className="absolute py-2 top-0 left-0 w-full"
							key={vehicle.id}
							style={{
								height: `${virtualItem.size}px`,
								transform: `translateY(${virtualItem.start}px)`,
							}}
						>
							<VehicleCard vehicle={vehicle} />
						</div>
					);
				})}
			</div>
		</div>
	);
}
