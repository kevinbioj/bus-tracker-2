import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";

import { GetLineGirouettesQuery } from "~/api/girouettes";
import { GetLineQuery } from "~/api/lines";
import { GetNetworkQuery } from "~/api/networks";
import { Button } from "~/components/ui/button";
import * as m from "~/paraglide/messages";
import { DataPageLayout, LineBreadcrumbLabel } from "~/routes/_app/data/-components/data-page-layout";
import { GirouettesTable } from "./-components/girouettes/girouettes-table";

type GirouettesPageProps = {
	lineId: number;
};

export function GirouettesPage({ lineId }: Readonly<GirouettesPageProps>) {
	const { data: line } = useSuspenseQuery(GetLineQuery(lineId));
	const { data: network } = useSuspenseQuery(GetNetworkQuery(line.networkId, true));
	const { data: girouettes } = useSuspenseQuery(GetLineGirouettesQuery(lineId));

	return (
		<DataPageLayout
			current={m.line_girouettes_breadcrumb()}
			breadcrumbMiddle={[
				{
					label: <LineBreadcrumbLabel line={line} />,
					to: "/data/lines/$lineId",
					params: { lineId: String(lineId) },
				},
			]}
			network={network}
			networkSearch={{ tab: "lines" }}
			title={m.line_girouettes_page_title({ lineNumber: line.number, networkName: network.name })}
		>
			<GirouettesTable girouettes={girouettes} lineId={lineId} />
			<div className="flex justify-end mt-3">
				<Button
					size="sm"
					nativeButton={false}
					render={
						<Link to="/data/lines/$lineId/girouettes/new" params={{ lineId: String(lineId) }}>
							<PlusIcon />
							{m.line_girouettes_create()}
						</Link>
					}
				/>
			</div>
		</DataPageLayout>
	);
}
