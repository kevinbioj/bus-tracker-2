import { useSuspenseQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import { GetNetworksQuery } from "~/api/networks";
import { Separator } from "~/components/ui/separator";

export function NetworkList() {
	const { data: networks } = useSuspenseQuery(GetNetworksQuery);

	return (
		<main className="mt-3 p-3 max-w-screen-lg w-full mx-auto">
			<h2 className="font-bold text-2xl">Données statistiques</h2>
			<p className="text-muted-foreground">Sélectionnez un réseau de transport pour continuer.</p>
			<Separator />
			<div className="mt-3 flex flex-col gap-3">
				{networks.map((network) => (
					<Link
						className="flex justify-between items-center h-16 px-4 py-2 rounded-lg transition-colors bg-primary hover:bg-primary/70 text-primary-foreground"
						key={network.id}
						to={`/data/networks/${network.id}`}
						style={{
							backgroundColor: network.color ?? undefined,
							color: network.textColor ?? undefined,
						}}
					>
						{network.logoHref ? (
							<>
								<div className="h-full w-full lg:w-40">
									<picture>
										{network.darkModeLogoHref !== null ? (
											<source srcSet={network.darkModeLogoHref} media="(prefers-color-scheme: dark)" />
										) : null}
										<img className="h-full object-contain mx-auto" src={network.logoHref} alt="" />
									</picture>
								</div>
								<Separator className="mx-4 bg-foreground dark:bg-foreground hidden lg:block" orientation="vertical" />
							</>
						) : null}
						<div className={clsx("flex-col flex-1", network.logoHref ? "hidden lg:flex" : "flex")}>
							<h3 className="font-bold text-center lg:text-start text-xl">{network.name}</h3>
							{network.authority ? <p className="hidden lg:block">{network.authority}</p> : null}
						</div>
						<ArrowRight />
					</Link>
				))}
			</div>
		</main>
	);
}
