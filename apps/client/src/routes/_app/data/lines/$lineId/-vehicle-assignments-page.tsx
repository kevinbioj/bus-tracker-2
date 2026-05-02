import { keepPreviousData, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import dayjs, { type Dayjs } from "dayjs";
import { ChevronLeft, ChevronRight, MapIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useMemo, useRef } from "react";

import { GetLineQuery, GetLineVehicleAssignmentsQuery } from "~/api/lines";
import { GetNetworkQuery } from "~/api/networks";
import * as m from "~/paraglide/messages";
import { DataPageLayout } from "~/routes/_app/data/-components/data-page-layout";
import { LineVehiclesTimeline } from "~/routes/_app/data/-components/lines/line-vehicles-timeline";
import { PeriodNavigator } from "~/routes/_app/data/-components/period-navigator";
import { Button } from "~/components/ui/button";
import { cn } from "~/utils/cn";

const parseMonth = (input: Dayjs, validMonths: string[]) => {
	if (!validMonths.includes(input.format("YYYY-MM"))) return validMonths.at(-1) ?? dayjs().format("YYYY-MM");
	return input.format("YYYY-MM");
};

export function LineVehicleAssignments() {
	const { lineId } = useParams({ from: "/_app/data/lines/$lineId/vehicle-assignments" });
	const [date] = useQueryState("date", parseAsString);

	const { data: line } = useSuspenseQuery(GetLineQuery(+lineId));
	const { data: network } = useSuspenseQuery(GetNetworkQuery(line.networkId, true));

	const currentDate = date ? dayjs(date) : dayjs(line.latestServiceDate ?? undefined);
	const month = parseMonth(currentDate, line.activeMonths);
	const currentMonthIndex = line.activeMonths.indexOf(month);

	const { data: assignments } = useQuery({
		...GetLineVehicleAssignmentsQuery(line.id, currentDate.format("YYYY-MM-DD")),
		placeholderData: keepPreviousData,
	});
	if (!assignments) throw new Error("Assignments should be preloaded by route loader");

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
		<DataPageLayout
			current={
				<>
					{line.cartridgeHref ? (
						<img className="h-5 object-contain rounded-sm" src={line.cartridgeHref} alt={line.number} />
					) : (
						line.number
					)}
					<Button
						asChild
						size="sm"
						variant="outline"
						className="border-[0.5px] h-5 ml-2 my-0 py-0 px-2"
						title={m.view_on_map()}
					>
						<Link to="/" search={{ "line-id": line.id }}>
							<MapIcon className="size-3.5" />
							{m.view_on_map()}
						</Link>
					</Button>
				</>
			}
			currentClassName="flex items-center gap-1"
			network={network}
			networkSearch={{ tab: "lines" }}
			title={m.page_title_line_data({ lineNumber: line.number, networkName: network.name })}
		>
			<section className="mt-1">
				<PeriodNavigator
					className="mb-2"
					previous={
						currentMonthIndex > 0 ? (
							<Link
								className="transition-opacity hover:opacity-70"
								from="/data/lines/$lineId/vehicle-assignments"
								to="."
								search={(prev) => ({
									...prev,
									date: dayjs(line.activeMonths.at(currentMonthIndex - 1))
										.endOf("month")
										.format("YYYY-MM-DD"),
								})}
							>
								<ChevronLeft
									aria-label={m.period_previous()}
									className="mx-auto"
									color="white"
									width={32}
									height={32}
									strokeWidth={2.5}
								/>
							</Link>
						) : (
							<div />
						)
					}
					next={
						currentMonthIndex < line.activeMonths.length - 1 ? (
							<Link
								className="transition-opacity hover:opacity-70"
								from="/data/lines/$lineId/vehicle-assignments"
								to="."
								search={(prev) => ({
									...prev,
									date: dayjs(line.activeMonths.at(currentMonthIndex + 1))
										.startOf("month")
										.format("YYYY-MM-DD"),
								})}
							>
								<ChevronRight
									aria-label={m.period_next()}
									className="mx-auto"
									color="white"
									width={32}
									height={32}
									strokeWidth={2.5}
								/>
							</Link>
						) : (
							<div />
						)
					}
				>
					<span className="hidden lg:inline">{m.activity_of()}</span>
					{dayjs(month).format("MMMM YYYY")}
				</PeriodNavigator>
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
							<Link
								from="/data/lines/$lineId/vehicle-assignments"
								to="."
								search={(prev) => ({ ...prev, date: dateStr })}
							>
								<p className="uppercase">{d.format("ddd")}</p>
								<p className="font-bold text-lg">{d.format("DD")}</p>
							</Link>
						</Button>
					);
				})}
			</div>
			<LineVehiclesTimeline date={currentDate.format("YYYY-MM-DD")} lineId={line.id} />
		</DataPageLayout>
	);
}
