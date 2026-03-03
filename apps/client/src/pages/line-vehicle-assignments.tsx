import { useSuspenseQuery } from "@tanstack/react-query";
import dayjs, { type Dayjs } from "dayjs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { GetLineQuery, GetLineVehicleAssignmentsQuery } from "~/api/lines";
import { GetNetworkQuery } from "~/api/networks";
import { LineVehiclesTimeline } from "~/components/data/lines/line-vehicles-timeline";
import { NetworkHeader } from "~/components/data/network-header";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/utils/utils";

const parseMonth = (input: Dayjs, validMonths: string[]) => {
	if (!validMonths.includes(input.format("YYYY-MM"))) return validMonths.at(-1) ?? dayjs().format("YYYY-MM");
	return input.format("YYYY-MM");
};

export function LineVehicleAssignments() {
	const { lineId } = useParams();
	const [searchParams] = useSearchParams();

	if (typeof lineId === "undefined") {
		throw new Error("Expected lineId to be provided!");
	}

	const { data: line } = useSuspenseQuery(GetLineQuery(+lineId));
	const { data: network } = useSuspenseQuery(GetNetworkQuery(line.networkId, true));

	const currentDate = searchParams.has("date")
		? dayjs(searchParams.get("date"))
		: dayjs(line.latestServiceDate ?? undefined);
	const month = parseMonth(currentDate, line.activeMonths);
	const currentMonthIndex = line.activeMonths.indexOf(month);

	const { data: assignments } = useSuspenseQuery(
		GetLineVehicleAssignmentsQuery(line.id, currentDate.format("YYYY-MM-DD")),
	);

	const currentDateRef = useRef<HTMLButtonElement>(null);

	const daysInMonth = useMemo(() => {
		const startOfMonth = dayjs(month).startOf("month");
		const days = [];
		for (let i = 0; i < startOfMonth.daysInMonth(); i++) {
			days.push(startOfMonth.add(i, "day"));
		}
		return days;
	}, [month]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: should react on month change
	useEffect(() => {
		currentDateRef.current?.scrollIntoView({
			behavior: "auto",
			inline: "center",
			block: "nearest",
		});
	}, [currentDate.format("YYYY-MM")]);

	return (
		<>
			<title>{`${line.number} – ${network.name} – Données – Bus Tracker`}</title>
			<main className="max-w-(--breakpoint-xl) p-3 w-full mx-auto">
				<NetworkHeader network={network} />
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink asChild>
								<Link to="/data">Données</Link>
							</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbLink asChild>
								<Link to={`/data/networks/${network.id}?tab=lines`}>
									{network.logoHref ? (
										<picture className="min-w-12 w-fit">
											{network.darkModeLogoHref !== null ? (
												<source srcSet={network.darkModeLogoHref} media="(prefers-color-scheme: dark)" />
											) : null}
											<img className="h-5 object-contain m-auto" src={network.logoHref} alt={network.name} />
										</picture>
									) : (
										network.name
									)}
								</Link>
							</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbPage>
								{line.cartridgeHref ? (
									<img className="h-5 object-contain rounded-sm" src={line.cartridgeHref} alt={line.number} />
								) : (
									line.number
								)}
							</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
				<Separator className="my-1" />
				<section>
					<div className="bg-branding text-branding-foreground grid grid-cols-[3rem_1fr_3rem] px-3 py-2 rounded-md mb-2">
						{currentMonthIndex > 0 ? (
							<Link
								className="transition-opacity hover:opacity-70"
								to={`?date=${dayjs(line.activeMonths.at(currentMonthIndex - 1))
									.endOf("month")
									.format("YYYY-MM-DD")}`}
							>
								<ChevronLeft
									aria-label="Période précédente"
									className="mx-auto"
									color="white"
									width={32}
									height={32}
									strokeWidth={2.5}
								/>
							</Link>
						) : (
							<div />
						)}
						<p className="font-bold my-auto text-2xl text-center">
							<span className="hidden lg:inline">activité de </span>
							{dayjs(month).format("MMMM YYYY")}
						</p>
						{currentMonthIndex < line.activeMonths.length - 1 ? (
							<Link
								className="transition-opacity hover:opacity-70"
								to={`?date=${dayjs(line.activeMonths.at(currentMonthIndex + 1))
									.startOf("month")
									.format("YYYY-MM-DD")}`}
							>
								<ChevronRight
									aria-label="Période suivante"
									className="mx-auto"
									color="white"
									width={32}
									height={32}
									strokeWidth={2.5}
								/>
							</Link>
						) : (
							<div />
						)}
					</div>
				</section>

				<div className="flex gap-1 overflow-x-auto pb-2 no-scrollbar">
					{daysInMonth.map((d) => {
						const dateStr = d.format("YYYY-MM-DD");
						const isSelected = currentDate.format("YYYY-MM-DD") === dateStr;
						const isFuture = d.isAfter(dayjs(), "day");
						const hasData = assignments.activeDays.includes(dateStr);

						return (
							<Button
								key={dateStr}
								asChild
								variant={isSelected ? "branding-default" : "secondary"}
								size="sm"
								ref={isSelected ? currentDateRef : undefined}
								className={cn(
									"flex flex-col gap-0 items-center justify-center h-full min-w-12 py-1",
									(isFuture || !hasData) && "opacity-50 pointer-events-none hover:cursor-not-allowed",
								)}
							>
								<Link to={`?date=${dateStr}`}>
									<p className="uppercase">{d.format("ddd")}</p>
									<p className="font-bold text-lg">{d.format("DD")}</p>
								</Link>
							</Button>
						);
					})}
				</div>
				<LineVehiclesTimeline date={currentDate.format("YYYY-MM-DD")} lineId={line.id} />
			</main>
		</>
	);
}
