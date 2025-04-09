import { useSuspenseQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { BinaryIcon, ClockIcon, FilterIcon, SortAscIcon } from "lucide-react";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useDebounceValue } from "usehooks-ts";
import { GetNetworkQuery } from "~/api/networks";

import { GetVehiclesQuery, type Vehicle } from "~/api/vehicles";
import { VehiclesTable } from "~/components/data/networks/vehicles-table";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { BusIcon, ShipIcon, TramwayIcon } from "~/icons/means-of-transport";

const filterableVehicleTypes = {
	ALL: <span className="text-muted-foreground">Type</span>,
	TRAMWAY: <TramwayIcon className="size-5" />,
	BUS: <BusIcon className="size-5" />,
	FERRY: <ShipIcon className="size-5" />,
} as const;

type NetworkVehiclesProps = { networkId: number };

export function NetworkVehicles({ networkId }: Readonly<NetworkVehiclesProps>) {
	const { data: network } = useSuspenseQuery(GetNetworkQuery(networkId));
	const { data: vehicles } = useSuspenseQuery(GetVehiclesQuery(networkId));

	const availableNetworkTypeFilters = useMemo(() => {
		const networkVehicleTypes = new Set(vehicles.map(({ type }) => type));
		return [
			"ALL",
			...Object.keys(filterableVehicleTypes).filter((type) => networkVehicleTypes.has(type as Vehicle["type"])),
		];
	}, [vehicles]);

	const [searchParams, setSearchParams] = useSearchParams("");

	const updateSearchParam = (key: string, value: string) => {
		setSearchParams((searchParams) => {
			const newSearchParams = new URLSearchParams(searchParams);
			newSearchParams.set(key, value);
			return newSearchParams;
		});
	};

	const type = searchParams.get("type") ?? "ALL";
	const operatorId = searchParams.get("operatorId") ?? "ALL";
	const filter = searchParams.get("filter") ?? "";
	const sort = searchParams.get("sort") ?? "number";

	const [debouncedFilter] = useDebounceValue(() => filter, 100);

	const filteredAndSortedVehicles = useMemo(() => {
		const pattern = new RegExp(debouncedFilter.replaceAll("_", "\\d"), "i");
		const sort = searchParams.get("sort");

		return vehicles
			.filter((v) => {
				if (type?.trim().length && type !== "ALL" && v.type !== type) return false;
				if (operatorId !== "" && operatorId !== "ALL" && +operatorId !== v.operatorId) return false;
				if (debouncedFilter === "") return true;
				return pattern.test(v.number.toString()) || pattern.test(v.designation ?? "");
			})
			.sort((a, b) => {
				if (sort === "activity") {
					if (typeof a.activity.lineId !== "undefined" && typeof b.activity.lineId !== "undefined")
						return +a.number - +b.number;
					if (typeof a.activity.lineId === "number") return -1;
					if (typeof b.activity.lineId === "number") return 1;
					if (a.activity.since === null) return 1;
					if (b.activity.since === null) return -1;
					return b.activity.since.localeCompare(a.activity.since);
				}

				return +a.number - +b.number;
			});
	}, [debouncedFilter, operatorId, searchParams, type, vehicles]);

	const onlineVehicles = useMemo(
		() => filteredAndSortedVehicles.filter(({ activity }) => typeof activity.lineId !== "undefined"),
		[filteredAndSortedVehicles],
	);

	const activeVehiclesLabel = useMemo(() => {
		if (filteredAndSortedVehicles.length === 0) return "Aucun véhicule n'existe avec ces critères de recherche.";
		if (onlineVehicles.length === 0) return `Aucun véhicule sur ${filteredAndSortedVehicles.length} en circulation.`;
		return `${onlineVehicles.length}/${filteredAndSortedVehicles.length} véhicule${filteredAndSortedVehicles.length > 1 ? "s" : ""} en circulation.`;
	}, [filteredAndSortedVehicles, onlineVehicles]);

	return (
		<section>
			{vehicles.length > 0 ? (
				<>
					<div className="grid grid-cols-[1fr_4.5rem] gap-1 mt-2">
						{/* Filters */}
						<div className="flex flex-col gap-1">
							<Label className="inline-flex items-center gap-1" htmlFor="filter">
								<FilterIcon size={16} /> Filtrer par
							</Label>
							<div className="flex gap-1">
								{availableNetworkTypeFilters.length > 2 && (
									<Select value={type} onValueChange={(newType) => updateSearchParam("type", newType)}>
										<SelectTrigger className="h-10 w-[4.5rem]">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{availableNetworkTypeFilters.map((type) => (
												<SelectItem key={type} value={type}>
													{filterableVehicleTypes[type as keyof typeof filterableVehicleTypes]}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
								<div className="flex flex-1 gap-1 max-w-96">
									{network.operators.length > 0 && (
										<Select
											value={operatorId}
											onValueChange={(newOperatorId) => updateSearchParam("operatorId", newOperatorId)}
										>
											<SelectTrigger className="h-10 w-1/2">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="ALL">
													<span className="text-muted-foreground">Opérateur</span>
												</SelectItem>
												{network.operators
													.toSorted((a, b) => a.id - b.id)
													.map((operator) => (
														<SelectItem key={operator.id} value={operator.id.toString()}>
															{operator.name}
														</SelectItem>
													))}
											</SelectContent>
										</Select>
									)}
									<Input
										className="h-10 w-1/2"
										placeholder="numéro ou désignation"
										value={searchParams.get("filter") ?? ""}
										onChange={(e) => updateSearchParam("filter", e.target.value)}
									/>
								</div>
							</div>
						</div>
						{/* Sort */}
						<div className="flex flex-col gap-1">
							<Label className="inline-flex items-center gap-1" htmlFor="sort">
								<SortAscIcon size={16} /> Tri
							</Label>
							<Select value={sort} onValueChange={(newSort) => updateSearchParam("sort", newSort)}>
								<SelectTrigger className="h-10">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="number">
										<BinaryIcon />
									</SelectItem>
									<SelectItem value="activity">
										<ClockIcon />
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
					<p
						className={clsx(
							"text-muted-foreground text-sm",
							filteredAndSortedVehicles.length > 0 ? "mt-2 text-end" : "mt-5 text-center",
						)}
					>
						{activeVehiclesLabel}
					</p>
					<VehiclesTable data={filteredAndSortedVehicles} searchParams={searchParams} />
				</>
			) : (
				<p className="mt-5 text-center text-muted-foreground">Aucun véhicule n'est disponible pour ce réseau.</p>
			)}
		</section>
	);
}
