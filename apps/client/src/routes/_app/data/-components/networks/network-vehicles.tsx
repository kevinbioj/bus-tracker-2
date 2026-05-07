import { useSuspenseQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { ArchiveIcon, BinaryIcon, ClockIcon, FilterIcon, SortAscIcon } from "lucide-react";
import { parseAsBoolean, parseAsString, parseAsStringEnum, useQueryState } from "nuqs";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useDebounceValue } from "usehooks-ts";
import { GetNetworkQuery } from "~/api/networks";
import { GetVehiclesQuery, type Vehicle } from "~/api/vehicles";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { BusIcon, CoachIcon, ShipIcon, TramwayIcon, TrolleybusIcon } from "~/icons/means-of-transport";
import * as m from "~/paraglide/messages";
import { VehiclesTable } from "~/routes/_app/data/-components/vehicles/vehicles-table";
import { cn } from "~/utils/cn";

const vehicleTypeOptions = {
	ALL: {
		label: () => <span className="text-muted-foreground">{m.network_vehicle_type_filter()}</span>,
		icon: null,
	},
	TRAMWAY: {
		label: () => "Tramway",
		icon: <TramwayIcon className="size-5" />,
	},
	TROLLEY: {
		label: () => "Trolleybus",
		icon: <TrolleybusIcon className="size-5" />,
	},
	BUS: {
		label: () => "Bus",
		icon: <BusIcon className="size-5" />,
	},
	COACH: {
		label: () => "Car",
		icon: <CoachIcon className="size-5" />,
	},
	FERRY: {
		label: () => "Ferry",
		icon: <ShipIcon className="size-5" />,
	},
};

const vehicleTypeKeys = Object.keys(vehicleTypeOptions) as (keyof typeof vehicleTypeOptions)[];

const sortingOptions = {
	number: {
		label: () => m.network_vehicle_sort_number(),
		icon: <BinaryIcon className="size-5" />,
	},
	activity: {
		label: () => m.network_vehicle_sort_activity(),
		icon: <ClockIcon className="size-5" />,
	},
};

const sortingKeys = Object.keys(sortingOptions) as (keyof typeof sortingOptions)[];

const numberSort = (a: Vehicle, b: Vehicle) => {
	const numberifiedA = Number.parseInt(a.number, 10);
	const numberifiedB = Number.parseInt(b.number, 10);

	if (Number.isNaN(numberifiedA)) {
		if (Number.isNaN(numberifiedB)) {
			return a.number.localeCompare(b.number);
		}
		return 1;
	}

	if (Number.isNaN(numberifiedB)) {
		return -1;
	}
	return numberifiedA - numberifiedB;
};

type NetworkVehiclesProps = {
	networkId: number;
};

export function NetworkVehicles({ networkId }: NetworkVehiclesProps) {
	const { data: network } = useSuspenseQuery(GetNetworkQuery(networkId, true, true));
	const { data: vehicles } = useSuspenseQuery(GetVehiclesQuery(networkId));

	const [type, setType] = useQueryState("type", parseAsStringEnum(vehicleTypeKeys).withDefault("ALL"));
	const [operatorId, setOperatorId] = useQueryState("operatorId", parseAsString.withDefault("ALL"));
	const [filter, setFilter] = useQueryState("filter", parseAsString.withDefault(""));
	const [sort, setSort] = useQueryState("sort", parseAsStringEnum(sortingKeys).withDefault("number"));
	const [showArchived, setShowArchived] = useQueryState("archived", parseAsBoolean.withDefault(false));
	const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
	const mobileFiltersId = useId();

	const [debouncedFilter] = useDebounceValue(filter, 100);

	const selectableOperators = useMemo(() => {
		if (network.operators.length === 0) {
			return;
		}

		return [
			{ label: m.network_vehicle_operator_all(), value: null },
			...network.operators
				.sort((a, b) => a.sortOrder - b.sortOrder)
				.map((operator) => ({ label: operator.name, value: operator.id })),
		];
	}, [network]);

	const selectedOperatorLabel = useMemo(() => {
		const selectedValue = operatorId === "ALL" ? null : Number(operatorId);
		return selectableOperators?.find(({ value }) => value === selectedValue)?.label ?? "";
	}, [operatorId, selectableOperators]);

	const hasArchivedVehicles = useMemo(() => vehicles.some((vehicle) => vehicle.archivedAt !== null), [vehicles]);

	const availableNetworkTypeFilters = useMemo(() => {
		const networkVehicleTypes = new Set(vehicles.map(({ type }) => type));
		return ["ALL", ...vehicleTypeKeys.filter((t) => t !== "ALL" && networkVehicleTypes.has(t as Vehicle["type"]))];
	}, [vehicles]);

	const filteredAndSortedVehicles = useMemo(() => {
		let pattern: RegExp | string = debouncedFilter;

		try {
			pattern = new RegExp(debouncedFilter.replaceAll("_", "\\d"), "i");
		} catch {}

		return vehicles
			.filter((v) => {
				if (showArchived && v.archivedAt === null) return false;
				if (!showArchived && v.archivedAt !== null) return false;
				if (type !== "ALL" && v.type !== type) return false;
				if (operatorId !== "ALL" && +operatorId !== v.operatorId) return false;
				if (debouncedFilter === "") return true;
				return pattern instanceof RegExp
					? pattern.test(v.number.toString()) || pattern.test(v.designation ?? "")
					: v.number.toString().includes(pattern);
			})
			.sort((a, b) => {
				if (sort === "activity") {
					if (a.activity.lineId !== undefined && b.activity.lineId !== undefined) return numberSort(a, b);
					if (typeof a.activity.lineId === "number") return -1;
					if (typeof b.activity.lineId === "number") return 1;
					if (a.activity.since === null) return 1;
					if (b.activity.since === null) return -1;
					return b.activity.since.localeCompare(a.activity.since);
				}

				return numberSort(a, b);
			});
	}, [debouncedFilter, operatorId, showArchived, sort, type, vehicles]);

	const onlineVehicles = useMemo(
		() => filteredAndSortedVehicles.filter(({ activity }) => activity.lineId !== undefined),
		[filteredAndSortedVehicles],
	);

	const activeVehiclesLabel = useMemo(() => {
		if (showArchived)
			return m.network_vehicles_archived_count({
				count: filteredAndSortedVehicles.length,
				plural: filteredAndSortedVehicles.length > 1 ? "s" : "",
			});
		if (filteredAndSortedVehicles.length === 0) return m.network_vehicles_empty();
		if (onlineVehicles.length === 0) return m.network_vehicles_none_online({ count: filteredAndSortedVehicles.length });
		return m.network_vehicles_online_count({
			onlineCount: onlineVehicles.length,
			totalCount: filteredAndSortedVehicles.length,
			plural: filteredAndSortedVehicles.length > 1 ? "s" : "",
		});
	}, [filteredAndSortedVehicles, onlineVehicles, showArchived]);

	const filterSortKey = `${type}|${operatorId}|${debouncedFilter}|${sort}|${showArchived}`;
	const prevFilterSortKey = useRef(filterSortKey);
	useEffect(() => {
		if (prevFilterSortKey.current === filterSortKey) return;
		prevFilterSortKey.current = filterSortKey;
		const stickyY = window.innerWidth >= 640 ? 134 : 76;
		if (window.scrollY > stickyY) {
			window.scrollTo({ top: stickyY, behavior: "instant" });
		}
	}, [filterSortKey]);

	return (
		<div>
			<div className="sticky top-14 bg-background z-10 pt-2">
				<div
					className={cn(
						"hidden gap-2 sm:grid sm:gap-1",
						hasArchivedVehicles ? "sm:grid-cols-[minmax(0,1fr)_4.5rem_2.3rem]" : "sm:grid-cols-[minmax(0,1fr)_4.5rem]",
					)}
				>
					{/* Filters */}
					<div className="flex min-w-0 flex-col gap-1">
						<Label className="inline-flex items-center gap-1" htmlFor="filter">
							<FilterIcon size={16} /> {m.network_vehicle_filter_label()}
						</Label>
						<div className="flex min-w-0 gap-1">
							{availableNetworkTypeFilters.length > 2 && (
								<Select value={type} onValueChange={(newType) => setType(newType as typeof type)}>
									<SelectTrigger aria-label={m.network_vehicle_type_filter()} className="w-20 shrink-0" size="lg">
										<SelectValue className="w-0 min-w-0 flex-1 overflow-hidden">
											{vehicleTypeOptions[type].icon ?? (
												<span className="block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
													{vehicleTypeOptions.ALL.label()}
												</span>
											)}
										</SelectValue>
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											{availableNetworkTypeFilters.map((typeKey) => {
												const item = vehicleTypeOptions[typeKey as keyof typeof vehicleTypeOptions];
												return (
													<SelectItem key={typeKey} value={typeKey}>
														<div className="flex items-center gap-2">
															{item.icon}
															<span>{item.label()}</span>
														</div>
													</SelectItem>
												);
											})}
										</SelectGroup>
									</SelectContent>
								</Select>
							)}
							<div
								className={cn(
									"grid min-w-0 flex-1 gap-1 sm:max-w-96",
									selectableOperators !== undefined ? "grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : "grid-cols-1",
								)}
							>
								{selectableOperators !== undefined && (
									<Select
										items={selectableOperators}
										value={operatorId === "ALL" ? null : Number(operatorId)}
										onValueChange={(value) => setOperatorId(value ? String(value) : null)}
									>
										<SelectTrigger
											aria-label={m.network_vehicle_operator_filter()}
											className="w-full min-w-0 overflow-hidden"
											size="lg"
										>
											<SelectValue className="w-0 min-w-0 flex-1 overflow-hidden">
												<span className="block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
													{selectedOperatorLabel}
												</span>
											</SelectValue>
										</SelectTrigger>
										<SelectContent className="w-fit">
											<SelectGroup>
												{selectableOperators.map(({ label, value }) => (
													<SelectItem key={value} value={value}>
														{value ? label : <span className="text-muted-foreground">{label}</span>}
													</SelectItem>
												))}
											</SelectGroup>
										</SelectContent>
									</Select>
								)}
								<Input
									className="h-10 min-w-0"
									placeholder={m.network_vehicle_filter_placeholder()}
									value={filter}
									onChange={(e) => setFilter(e.target.value || null)}
								/>
							</div>
						</div>
					</div>
					{/* Sort */}
					<div className="flex min-w-0 flex-col gap-1">
						<Label className="inline-flex items-center gap-1" htmlFor="sort">
							<SortAscIcon size={16} /> {m.network_vehicle_sort_label()}
						</Label>
						<Select value={sort} onValueChange={(newSort) => setSort(newSort as typeof sort)}>
							<SelectTrigger aria-label={m.network_vehicle_sort_aria_label()} className="w-full" size="lg">
								<SelectValue>{sortingOptions[sort].icon}</SelectValue>
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{Object.entries(sortingOptions).map(([key, item]) => (
										<SelectItem key={key} value={key}>
											<div className="flex items-center gap-2">
												{item.icon}
												<span>{item.label()}</span>
											</div>
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</div>
					{/* Archive */}
					{hasArchivedVehicles && (
						<Button
							className="mt-auto"
							onClick={() => setShowArchived(showArchived ? null : true)}
							size="icon-xl"
							variant={showArchived ? "branding-default" : "secondary"}
						>
							<ArchiveIcon />
						</Button>
					)}
				</div>
				<div className="sm:hidden">
					<div className="flex gap-1">
						<Input
							className="h-10 min-w-0 flex-1"
							placeholder={m.network_vehicle_filter_placeholder()}
							value={filter}
							onChange={(e) => setFilter(e.target.value || null)}
						/>
						<Button
							aria-controls={mobileFiltersId}
							aria-expanded={mobileFiltersOpen}
							aria-label={m.network_vehicle_filter_label()}
							className="h-10 w-10"
							onClick={() => setMobileFiltersOpen((open) => !open)}
							size="icon-lg"
							type="button"
							variant={mobileFiltersOpen ? "branding-default" : "secondary"}
						>
							<FilterIcon />
						</Button>
					</div>
					{mobileFiltersOpen && (
						<div
							id={mobileFiltersId}
							className={cn(
								"mt-2 grid gap-1",
								hasArchivedVehicles ? "grid-cols-[4.5rem_1fr_5.25rem_2.25rem]" : "grid-cols-[4.5rem_1fr_5.25rem]",
							)}
						>
							{availableNetworkTypeFilters.length > 2 ? (
								<Select value={type} onValueChange={(newType) => setType(newType as typeof type)}>
									<SelectTrigger aria-label={m.network_vehicle_type_filter()} className="w-full min-w-0 px-2" size="lg">
										<SelectValue className="w-0 min-w-0 flex-1 overflow-hidden">
											{vehicleTypeOptions[type].icon ?? (
												<span className="block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
													{vehicleTypeOptions.ALL.label()}
												</span>
											)}
										</SelectValue>
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											{availableNetworkTypeFilters.map((typeKey) => {
												const item = vehicleTypeOptions[typeKey as keyof typeof vehicleTypeOptions];
												return (
													<SelectItem key={typeKey} value={typeKey}>
														<div className="flex items-center gap-2">
															{item.icon}
															<span>{item.label()}</span>
														</div>
													</SelectItem>
												);
											})}
										</SelectGroup>
									</SelectContent>
								</Select>
							) : (
								<div />
							)}
							{selectableOperators !== undefined ? (
								<Select
									items={selectableOperators}
									value={operatorId === "ALL" ? null : Number(operatorId)}
									onValueChange={(value) => setOperatorId(value ? String(value) : null)}
								>
									<SelectTrigger
										aria-label={m.network_vehicle_operator_filter()}
										className="w-full min-w-0 overflow-hidden"
										size="lg"
									>
										<SelectValue className="w-0 min-w-0 flex-1 overflow-hidden">
											<span className="block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
												{selectedOperatorLabel}
											</span>
										</SelectValue>
									</SelectTrigger>
									<SelectContent className="w-fit">
										<SelectGroup>
											{selectableOperators.map(({ label, value }) => (
												<SelectItem key={value} value={value}>
													{value ? label : <span className="text-muted-foreground">{label}</span>}
												</SelectItem>
											))}
										</SelectGroup>
									</SelectContent>
								</Select>
							) : (
								<div />
							)}
							<Select value={sort} onValueChange={(newSort) => setSort(newSort as typeof sort)}>
								<SelectTrigger aria-label={m.network_vehicle_sort_aria_label()} className="w-full min-w-0" size="lg">
									<SelectValue className="w-0 min-w-0 flex-1 overflow-hidden">
										<span className="flex w-full min-w-0 items-center gap-1">
											<SortAscIcon className="size-4" />
											{sortingOptions[sort].icon}
										</span>
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{Object.entries(sortingOptions).map(([key, item]) => (
											<SelectItem key={key} value={key}>
												<div className="flex items-center gap-2">
													{item.icon}
													<span>{item.label()}</span>
												</div>
											</SelectItem>
										))}
									</SelectGroup>
								</SelectContent>
							</Select>
							{hasArchivedVehicles && (
								<Button
									className="h-full"
									onClick={() => setShowArchived(showArchived ? null : true)}
									size="icon-lg"
									type="button"
									variant={showArchived ? "branding-default" : "secondary"}
								>
									<ArchiveIcon />
								</Button>
							)}
						</div>
					)}
				</div>
				<p
					className={clsx(
						"text-muted-foreground text-sm mt-2",
						filteredAndSortedVehicles.length > 0 ? "text-end" : "text-center",
					)}
				>
					{activeVehiclesLabel}
				</p>
			</div>
			<VehiclesTable data={filteredAndSortedVehicles} />
		</div>
	);
}
