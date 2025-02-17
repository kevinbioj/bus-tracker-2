import type { Network } from "~/api/networks";
import { Separator } from "~/components/ui/separator";

type NetworkHeaderProps = {
	network: Network;
};

export function NetworkHeader({ network }: Readonly<NetworkHeaderProps>) {
	return (
		<div className="flex h-16 mt-1 mb-4 space-x-4 w-full">
			{network.logoHref ? (
				<>
					<div className="px-3 h-full w-full sm:max-w-[30%] sm:w-auto">
						<picture>
							{network.darkModeLogoHref !== null ? (
								<source srcSet={network.darkModeLogoHref} media="(prefers-color-scheme: dark)" />
							) : null}
							<img className="h-full mx-auto" src={network.logoHref} alt="" />
						</picture>
					</div>
					<Separator className="hidden sm:block" orientation="vertical" />
				</>
			) : null}
			<div className="flex-grow flex-col my-auto hidden sm:flex">
				<h1 className="font-bold text-3xl">{network.name}</h1>
				{network.authority ? <span>{network.authority}</span> : null}
			</div>
		</div>
	);
}
