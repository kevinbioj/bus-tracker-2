"use client";

import { clsx } from "clsx";
import dayjs from "dayjs";
import { Refresh } from "tabler-icons-react";
import { match } from "ts-pattern";

import { REFRESH_INTERVAL, useVehiclesQuery } from "~/hooks/useVehicles";

export default function DataStatus() {
	const query = useVehiclesQuery();
	const canForceUpdate =
		!query.isFetching && (query.isError || dayjs(query.dataUpdatedAt).diff(dayjs(), "seconds") > REFRESH_INTERVAL);
	return (
		<div className="flex items-center justify-center gap-2 mb-1 mt-1.5">
			<p>
				{match(query.status)
					.with("error", () => <>Échec de la mise à jour des données.</>)
					.with("pending", () => <>Chargement des données en cours...</>)
					.with("success", () => (
						<>
							Données obtenues à <span className="font-bold">{dayjs(query.dataUpdatedAt).format("HH:mm:ss")}</span>
						</>
					))
					.exhaustive()}
			</p>
			<button
				className="bg-brand p-1 rounded-md disabled:brightness-50 disabled:cursor-not-allowed"
				disabled={!canForceUpdate}
				onClick={() => query.refetch()}
				type="button"
				title={
					canForceUpdate
						? "Forcer la mise à jour des données."
						: "Vous ne pouvez pas forcer la mise à jour des données."
				}
			>
				<Refresh className={clsx({ "animate-spin direction-reverse": query.isFetching })} color="white" size={19} />
			</button>
		</div>
	);
}
