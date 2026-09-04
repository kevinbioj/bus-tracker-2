import dayjs from "dayjs";
import { LockIcon, RadioTowerIcon, TableIcon } from "lucide-react";

import type { DataSource, DataSourceRealtimeEntityType } from "~/api/data-sources";
import * as m from "~/paraglide/messages";
import { FeedLink } from "~/routes/_app/-components/attributions/feed-link";

type DataSourceItemProps = {
	dataSource: DataSource;
};

function getEntityTypeLabel(entityType: DataSourceRealtimeEntityType) {
	return entityType === "TRIP_UPDATES"
		? m.attributions_entity_trip_updates()
		: m.attributions_entity_vehicle_positions();
}

export function DataSourceItem({ dataSource }: Readonly<DataSourceItemProps>) {
	const { staticFeed, realtimeFeeds } = dataSource;
	const lastModified = staticFeed.lastModified !== null ? dayjs(staticFeed.lastModified) : null;

	return (
		<div className="rounded-lg border border-foreground/10 p-3 space-y-3">
			<div className="flex flex-wrap items-center gap-2">
				<span className="font-mono text-xs text-muted-foreground">
					{dataSource.providerId} / {dataSource.sourceId}
				</span>
				{dataSource.authenticated && (
					<span
						className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
						title={m.attributions_authenticated()}
					>
						<LockIcon aria-hidden className="size-3" />
						{m.attributions_authenticated()}
					</span>
				)}
			</div>

			<div className="space-y-1">
				<h4 className="flex items-center gap-1.5 text-sm font-semibold">
					<TableIcon aria-hidden className="size-4 text-muted-foreground" />
					{m.attributions_static_feed()}
				</h4>
				<div className="text-sm">
					<FeedLink href={staticFeed.href} />
					{lastModified?.isValid() && (
						<p className="text-xs text-muted-foreground">
							{m.attributions_last_modified({ date: lastModified.format("LL") })}
						</p>
					)}
				</div>
			</div>

			<div className="space-y-1">
				<h4 className="flex items-center gap-1.5 text-sm font-semibold">
					<RadioTowerIcon aria-hidden className="size-4 text-muted-foreground" />
					{m.attributions_realtime_feeds()}
				</h4>
				{realtimeFeeds.length === 0 ? (
					<p className="text-sm text-muted-foreground italic">{m.attributions_no_realtime()}</p>
				) : (
					<ul className="space-y-1 text-sm">
						{realtimeFeeds.map((realtimeFeed) => (
							<li className="flex flex-wrap items-center gap-x-2 gap-y-1" key={realtimeFeed.href}>
								<FeedLink href={realtimeFeed.href} />
								{realtimeFeed.entityTypes?.map((entityType) => (
									<span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs whitespace-nowrap" key={entityType}>
										{getEntityTypeLabel(entityType)}
									</span>
								))}
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
