import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useParams, useSearch } from "@tanstack/react-router";
import dayjs, { type Dayjs } from "dayjs";
import { ChevronLeft, ChevronRight, RectangleEllipsisIcon } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { GetLineQuery, GetLineVehicleAssignmentsQuery } from "~/api/lines";
import { GetNetworkQuery } from "~/api/networks";
import { NoIndex } from "~/components/seo";
import { buttonVariants } from "~/components/ui/button";
import { useEditor } from "~/hooks/use-editor";
import * as m from "~/paraglide/messages";
import { DataPageAction, subtitleLinkClassName } from "~/routes/_app/data/-components/data-page-header";
import { DataPageLayout } from "~/routes/_app/data/-components/data-page-layout";
import { getLineLabel, LineMedia } from "~/routes/_app/data/-components/lines/line-identity";
import { LineVehiclesTimeline } from "~/routes/_app/data/-components/lines/line-vehicles-timeline";
import { PeriodNavigator } from "~/routes/_app/data/-components/period-navigator";
import { ViewOnMapButton } from "~/routes/_app/data/-components/view-on-map-button";
import { cn } from "~/utils/cn";
import { getNetworkLabel } from "~/utils/network-seo";
import { getLineVehicleAssignmentsDate } from "./-vehicle-assignments-date";

const parseMonth = (input: Dayjs, validMonths: string[]) => {
	if (!validMonths.includes(input.format("YYYY-MM")))
		return validMonths[validMonths.length - 1] ?? dayjs().format("YYYY-MM");
	return input.format("YYYY-MM");
};

export function LinePage() {
	const { lineId } = useParams({ from: "/_app/data/lines/$lineId/" });
	// Lu depuis le match (et non via nuqs) pour rester aligné sur ce que le loader a préchargé :
	// la location du routeur change dès le clic, avant que les données du nouveau mois soient en cache.
	const { date } = useSearch({ from: "/_app/data/lines/$lineId/" });

	const { data: line } = useSuspenseQuery(GetLineQuery(+lineId));
	const { data: network } = useSuspenseQuery(GetNetworkQuery(line.networkId, true));
	const { editor } = useEditor();

	const isNetworkEditor = editor?.allowedNetworks.includes(line.networkId);
	const lineLabel = getLineLabel(line);
	const networkLabel = getNetworkLabel(network);

	const selectedDate = getLineVehicleAssignmentsDate(line, date);
	const currentDate = dayjs(selectedDate);
	const month = parseMonth(currentDate, line.activeMonths);
	const currentMonthIndex = line.activeMonths.indexOf(month);

	const { data: assignments } = useSuspenseQuery(GetLineVehicleAssignmentsQuery(line.id, selectedDate));

	const currentDateRef = useRef<HTMLAnchorElement>(null);

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
			actions={
				<>
					<ViewOnMapButton search={{ "line-id": line.id }} />
					{isNetworkEditor && (
						<DataPageAction
							icon={RectangleEllipsisIcon}
							label={m.network_lines_girouettes_action()}
							link={<Link params={{ lineId }} to="/data/lines/$lineId/girouettes" />}
						/>
					)}
				</>
			}
			back={{
				label: m.data_back_to_network({ networkName: network.name }),
				link: (
					<Link params={{ networkId: String(network.id) }} search={{ tab: "lines" }} to="/data/networks/$networkId" />
				),
			}}
			heading={getLineLabel(line)}
			media={<LineMedia line={line} />}
			subtitle={
				<Link
					className={subtitleLinkClassName}
					params={{ networkId: String(network.id) }}
					search={{ tab: "lines" }}
					to="/data/networks/$networkId"
				>
					{network.name}
				</Link>
			}
			description={m.page_description_line({ lineLabel, network: networkLabel })}
			title={m.page_title_line_data({ lineLabel, network: networkLabel })}
		>
			<NoIndex />
			<section>
				<PeriodNavigator
					className="mb-2"
					previous={
						currentMonthIndex > 0 ? (
							<Link
								className="transition-opacity hover:opacity-70 active:not-aria-[haspopup]:translate-y-px"
								from="/data/lines/$lineId/"
								to="."
								search={(prev) => ({
									...prev,
									date: dayjs(line.activeMonths[currentMonthIndex - 1])
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
								className="transition-opacity hover:opacity-70 active:not-aria-[haspopup]:translate-y-px"
								from="/data/lines/$lineId/"
								to="."
								search={(prev) => ({
									...prev,
									date: dayjs(line.activeMonths[currentMonthIndex + 1])
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

				<div className="flex gap-1 overflow-x-auto pb-2 no-scrollbar">
					{daysInMonth.map((d) => {
						const dateStr = d.format("YYYY-MM-DD");
						const isSelected = currentDate.format("YYYY-MM-DD") === dateStr;
						const isFuture = d.isAfter(dayjs(), "day");
						const hasData = assignments.activeDays.includes(dateStr);

						const dayClassName = "relative flex flex-col gap-0 items-center justify-center h-full min-w-12 py-1";
						const dayContent = (
							<>
								<span aria-hidden="true" className="uppercase">
									{d.format("ddd")}
								</span>
								<span aria-hidden="true" className="font-bold text-lg">
									{d.format("DD")}
								</span>
								<span className="sr-only">{d.format("dddd D MMMM")}</span>
							</>
						);

						if (isFuture || !hasData) {
							return (
								<div
									className={cn(buttonVariants({ variant: "secondary", size: "sm" }), dayClassName, "opacity-50")}
									key={dateStr}
								>
									{dayContent}
								</div>
							);
						}

						return (
							<Link
								className={cn(
									buttonVariants({ variant: isSelected ? "branding-default" : "secondary", size: "sm" }),
									dayClassName,
								)}
								from="/data/lines/$lineId/"
								key={dateStr}
								ref={isSelected ? currentDateRef : undefined}
								search={(prev) => ({ ...prev, date: dateStr })}
								to="."
							>
								{dayContent}
							</Link>
						);
					})}
				</div>

				<LineVehiclesTimeline date={selectedDate} lineId={line.id} />
			</section>
		</DataPageLayout>
	);
}
