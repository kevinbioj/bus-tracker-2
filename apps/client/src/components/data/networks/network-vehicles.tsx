import { useSuspenseQuery } from "@tanstack/react-query";
import { FilterIcon, SortAscIcon } from "lucide-react";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useDebounceValue } from "usehooks-ts";

import { GetVehiclesQuery } from "~/api/vehicles";
import { VehiclesTable } from "~/components/data/networks/vehicles-table";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";

type NetworkVehiclesProps = { networkId: number };

export function NetworkVehicles({ networkId }: NetworkVehiclesProps) {
	const { data: vehicles } = useSuspenseQuery(GetVehiclesQuery(networkId));

	const [searchParams, setSearchParams] = useSearchParams("");

	const filter = searchParams.get("filter") ?? "";
	const sort = searchParams.get("sort") ?? "number";

	const [debouncedFilter] = useDebounceValue(() => filter, 250);

	const filteredAndSortedVehicles = useMemo(() => {
		const pattern = new RegExp(debouncedFilter.replaceAll("_", "\\d"));
		const sort = searchParams.get("sort");

		return vehicles
			.filter((v) => {
				if (debouncedFilter === "") return true;
				return pattern.test(v.number.toString()) || pattern.test(v.designation ?? "");
			})
			.sort((a, b) => {
				if (sort === "activity") {
					if (typeof a.activity.lineId !== "undefined" && typeof b.activity.lineId !== "undefined")
						return +a.number - +b.number;
					if (typeof a.activity.lineId === "number") return -1;
					if (typeof b.activity.lineId === "number") return 1;
					return b.activity.since?.localeCompare(a.activity.since);
				}

				return +a.number - +b.number;
			});
	}, [debouncedFilter, searchParams, vehicles]);

	return (
		<section className="py-2">
			{vehicles.length > 0 ? (
				<>
					<div className="flex justify-between gap-3 py-2">
						<div className="flex flex-col gap-1 w-full max-w-72">
							<Label className="inline-flex items-center gap-1" htmlFor="filter">
								<FilterIcon size={16} /> Filtrer
							</Label>
							<Input
								className="h-10"
								placeholder="par numéro ou désignation..."
								value={searchParams.get("filter") ?? ""}
								onChange={(e) => setSearchParams({ filter: e.target.value, sort })}
							/>
						</div>
						<div className="flex flex-col gap-1">
							<Label className="inline-flex items-center gap-1" htmlFor="sort">
								<SortAscIcon size={16} /> Trier par
							</Label>
							<Select
								value={searchParams.get("sort") ?? "number"}
								onValueChange={(newSort) => setSearchParams({ filter, sort: newSort })}
							>
								<SelectTrigger className="h-10 min-w-28">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="number">Numéro</SelectItem>
									{/* <SelectItem value="line">Ligne</SelectItem> */}
									<SelectItem value="activity">Activité</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
					<VehiclesTable data={filteredAndSortedVehicles} />
				</>
			) : (
				<p className="text-center text-muted-foreground">Aucun véhicule n'est disponible pour ce réseau.</p>
			)}
		</section>
	);
}
