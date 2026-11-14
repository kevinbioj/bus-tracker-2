import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PlusIcon } from "lucide-react";

import { GetLineGirouettesQuery } from "~/api/girouettes";
import { GetLineQuery } from "~/api/lines";
import { GetNetworkQuery } from "~/api/networks";
import { Button } from "~/components/ui/button";
import * as m from "~/paraglide/messages";
import { DataPageLayout } from "~/routes/_app/data/-components/data-page-layout";
import { LineMedia, LineSubtitle } from "~/routes/_app/data/-components/lines/line-identity";
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
			back={{
				label: m.data_back_to_line({ lineNumber: line.number }),
				link: <Link params={{ lineId: String(lineId) }} to="/data/lines/$lineId" />,
			}}
			heading={m.line_girouettes_breadcrumb()}
			media={<LineMedia line={line} />}
			subtitle={<LineSubtitle line={line} network={network} />}
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
