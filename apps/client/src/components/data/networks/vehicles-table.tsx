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
		measureElement:
			typeof window !== "undefined" && navigator.userAgent.indexOf("Firefox") === -1
				? (element) => element?.getBoundingClientRect().height
				: undefined,
		overscan: 5,
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: need to react on isDesktop changes
	useEffect(() => {
		virtualizer.measure();
	}, [isDesktop, virtualizer]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: need to react on searchParams changes
	useEffect(() => {
		virtualizer.scrollToIndex(0, { behavior: "smooth" });
	}, [searchParams]);

	return (
		<div className="h-[calc(100dvh-255px)] sm:h-[calc(100dvh-270px)] overflow-auto pb-1" ref={parentRef}>
			<div className="w-full relative" style={{ height: `${virtualizer.getTotalSize()}px` }}>
				{virtualizer.getVirtualItems().map((virtualItem) => {
					const vehicle = data[virtualItem.index];
					return (
						<div
							className="absolute py-1 top-0 left-0 w-full"
							data-index={virtualItem.index}
							key={vehicle.id}
							ref={virtualizer.measureElement}
							style={{
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
