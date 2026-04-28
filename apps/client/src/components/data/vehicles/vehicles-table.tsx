import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useRef } from "react";
import { useMediaQuery } from "usehooks-ts";

import type { Vehicle } from "~/api/vehicles";
import { VehicleCard } from "~/components/data/vehicles/vehicle-card";

type VehiclesTableProps = {
	data: Vehicle[];
};

export function VehiclesTable({ data }: Readonly<VehiclesTableProps>) {
	const listRef = useRef<HTMLDivElement>(null);

	const isDesktop = useMediaQuery("(min-width: 640px)");

	const virtualizer = useWindowVirtualizer({
		count: data.length,
		estimateSize: useCallback(() => (isDesktop ? 64 : 105), [isDesktop]),
		measureElement:
			window !== undefined && navigator.userAgent.indexOf("Firefox") === -1
				? (element) => element?.getBoundingClientRect().height
				: undefined,
		overscan: 5,
		scrollMargin: listRef.current?.offsetTop ?? 0,
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: need to react on isDesktop changes
	useEffect(() => {
		virtualizer.measure();
	}, [isDesktop, virtualizer]);

	if (data.length === 0) {
		return null;
	}

	return (
		<div ref={listRef} className="w-full relative" style={{ height: `${virtualizer.getTotalSize()}px` }}>
			{virtualizer.getVirtualItems().map((virtualItem) => {
				const vehicle = data[virtualItem.index];
				return (
					<div
						className="absolute py-1 top-0 left-0 w-full"
						data-index={virtualItem.index}
						key={vehicle.id}
						ref={virtualizer.measureElement}
						style={{
							transform: `translateY(${virtualItem.start - virtualizer.options.scrollMargin}px)`,
						}}
					>
						<VehicleCard vehicle={vehicle} />
					</div>
				);
			})}
		</div>
	);
}
