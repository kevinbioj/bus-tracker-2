import type { Network } from "~/api/networks";
import { Separator } from "~/components/ui/separator";

type NetworkHeaderProps = {
	network: Network;
};

export function NetworkHeader({ network }: Readonly<NetworkHeaderProps>) {
	return (
		<div className="hidden sm:flex sm:items-center sm:gap-6 sm:mb-2">
			{network.logoHref ? (
				<>
					<picture>
						{network.darkModeLogoHref !== null && (
							<source srcSet={network.darkModeLogoHref} media="(prefers-color-scheme: dark)" />
						)}
						<img className="max-h-12 w-full h-auto" src={network.logoHref} alt="" />
					</picture>
					<Separator orientation="vertical" />
				</>
			) : null}
			<div className="grow flex-col my-auto hidden sm:flex">
				<h1 className="font-bold leading-none text-2xl">{network.name}</h1>
				{network.authority ? <span className="uppercase">{network.authority}</span> : null}
			</div>
		</div>
	);
}
