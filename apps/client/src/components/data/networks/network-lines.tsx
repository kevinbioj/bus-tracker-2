import { useSuspenseQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useMemo } from "react";
import { Link } from "react-router-dom";

import { GetNetworkQuery } from "~/api/networks";

type NetworkLinesProps = {
	networkId: number;
};

export function NetworkLines({ networkId }: Readonly<NetworkLinesProps>) {
	const { data: network } = useSuspenseQuery(GetNetworkQuery(networkId, true));

	const sortedLines = useMemo(
		() =>
			network.lines
				.filter((line) => line.archivedAt === null || dayjs().isBefore(line.archivedAt))
				.toSorted((a, b) => {
					const sortOrderDiff = (a.sortOrder ?? network.lines.length) - (b.sortOrder ?? network.lines.length);
					return sortOrderDiff || a.number.localeCompare(b.number, undefined, { numeric: true });
				}),
		[network],
	);

	return (
		<div className="max-h-[calc(100dvh-150px)] sm:max-h-[calc(100dvh-225px)] overflow-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 mt-2 pb-2">
			{sortedLines.map((line) => (
				<Link
					key={line.id}
					to={`/data/lines/${line.id}/vehicle-assignments`}
					className="h-14 border flex items-center gap-1 rounded-lg transition hover:brightness-90"
					style={{
						backgroundColor: line.color ?? undefined,
						color: line.textColor ?? undefined,
					}}
				>
					<div className="p-1 h-full max-w-32 shrink-0 flex items-center justify-center">
						{line.cartridgeHref ? (
							<img className="object-contain h-full" src={line.cartridgeHref} alt={line.number} />
						) : (
							<span className="font-bold min-w-12 text-center text-lg">{line.girouetteNumber ?? line.number}</span>
						)}
					</div>
					<div className="flex-1 min-w-0">
						<p className="font-bold truncate">{`${line.girouetteNumber ? "" : "Ligne "}${line.number}`}</p>
						<div className="flex items-center gap-1.5 text-sm">
							{line.onlineVehicleCount ?? 0} véhicule{(line.onlineVehicleCount ?? 0) > 1 ? "s" : ""} en service
						</div>
					</div>
				</Link>
			))}
		</div>
	);
}
