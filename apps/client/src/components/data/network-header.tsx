import type { Network } from "~/api/networks";

type NetworkHeaderProps = {
	network: Network;
};

export function NetworkHeader({ network }: Readonly<NetworkHeaderProps>) {
	return (
		<div className="hidden sm:flex sm:items-center sm:gap-6 sm:mb-3">
			{network.logoHref ? (
				<picture>
					{network.darkModeLogoHref !== null ? (
						<source srcSet={network.darkModeLogoHref} media="(prefers-color-scheme: dark)" />
					) : null}
					<img className="max-h-16 w-full" src={network.logoHref} alt="" />
				</picture>
			) : null}
			<div className="grow flex-col my-auto hidden sm:flex">
				<h1 className="font-bold text-3xl">{network.name}</h1>
				{network.authority ? <span>{network.authority}</span> : null}
			</div>
		</div>
	);
}
