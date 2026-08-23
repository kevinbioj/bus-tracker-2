import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import { SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useDebounceValue } from "usehooks-ts";
import { GetNetworkQuery } from "~/api/networks";

import { Input } from "~/components/ui/input";
import * as m from "~/paraglide/messages";
import { searchLines } from "~/utils/line-search";

type NetworkLinesProps = {
	networkId: number;
};

export function NetworkLines({ networkId }: Readonly<NetworkLinesProps>) {
	const { data: network } = useSuspenseQuery(GetNetworkQuery(networkId, true));

	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedSearchQuery] = useDebounceValue(searchQuery, 200);

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

	// Une recherche active réordonne les lignes par pertinence, sinon l'ordre du réseau est conservé.
	const displayedLines = useMemo(
		() => searchLines(sortedLines, debouncedSearchQuery),
		[sortedLines, debouncedSearchQuery],
	);

	return (
		<>
			<div className="relative mt-2">
				<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
				<Input
					className="pl-9"
					placeholder={m.network_lines_search_placeholder()}
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
				/>
			</div>
			{displayedLines.length === 0 ? (
				<p className="text-muted-foreground text-sm text-center py-8">{m.network_lines_search_empty()}</p>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 mt-2">
					{displayedLines.map((line) => (
						<Link
							key={line.id}
							to="/data/lines/$lineId"
							params={{ lineId: String(line.id) }}
							className="h-14 border flex items-center gap-1 rounded-lg hover:brightness-90 active:translate-y-px transition-all"
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
								<p className="font-bold truncate">
									{line.girouetteNumber ? line.number : m.network_lines_label({ lineNumber: line.number })}
								</p>
								<div className="flex items-center gap-1.5 text-sm">
									{m.network_online_vehicle_count({ count: line.onlineVehicleCount ?? 0 })}
								</div>
							</div>
						</Link>
					))}
				</div>
			)}
		</>
	);
}
