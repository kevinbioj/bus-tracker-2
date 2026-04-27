import { ArrowRight } from "lucide-react";

import type { Network } from "~/api/networks";
import { Button } from "~/components/ui/button";
import { Link } from "~/components/ui/link";

type NetworkCardProps = {
	network: Network;
};

export function NetworkCard({ network }: Readonly<NetworkCardProps>) {
	return (
		<div className="h-16 relative w-full" key={network.id}>
			{network.color && (
				<style>
					{`@scope {
					.favorite-network-background:hover {
						background-color: ${network.color}33;
					}

					.card-network-background:hover {
						background-color: ${network.color}44 !important;
					}
				}`}
				</style>
			)}
			<Button
				asChild
				className="border drop-shadow-md flex justify-between items-center h-16 px-2 py-2 rounded-lg shadow-md transition-colors relative overflow-hidden bg-primary/25 text-neutral-800 dark:text-neutral-200 hover:text-primary-foreground card-network-background"
				style={{
					backgroundColor: network.color ? `${network.color}33` : undefined,
					borderColor: network.color ?? undefined,
				}}
			>
				<Link to={`/data/networks/${network.id}`}>
					<div className="flex-1 overflow-auto text-start text-wrap px-2">
						<h3 className="font-bold text-lg leading-tight">{network.name}</h3>
						{network.authority !== null && <p className="text-xs">{network.authority}</p>}
					</div>
					<ArrowRight />
				</Link>
			</Button>
		</div>
	);
}
