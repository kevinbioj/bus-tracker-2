import { BusFrontIcon } from "lucide-react";

import type { Network } from "~/api/networks";
import { useMapTheme } from "~/components/vehicles-map/map-style";
import { cn } from "~/utils/cn";

function useNetworkLogo(network: Network) {
	const dark = useMapTheme() === "dark";
	if (network.logoHref === null) return null;
	if (dark && network.darkModeLogoHref !== null) return { src: network.darkModeLogoHref, backdrop: false };
	return { src: network.logoHref, backdrop: dark };
}

type NetworkLogoTileProps = {
	network: Network;
	className?: string;
};

export function NetworkLogoTile({ network, className }: Readonly<NetworkLogoTileProps>) {
	const logo = useNetworkLogo(network);

	if (logo === null) {
		return (
			<span
				aria-hidden="true"
				className={cn(
					"flex shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground",
					className,
				)}
				style={
					network.color
						? {
								backgroundColor: `color-mix(in srgb, ${network.color} 15%, transparent)`,
								borderColor: `color-mix(in srgb, ${network.color} 50%, transparent)`,
								color: network.color,
							}
						: undefined
				}
			>
				<BusFrontIcon className="size-5" />
			</span>
		);
	}

	return (
		<span
			aria-hidden="true"
			className={cn("flex shrink-0 items-center justify-center rounded-md p-1", logo.backdrop && "bg-white", className)}
		>
			<img alt="" className="max-h-full max-w-full object-contain" decoding="async" loading="lazy" src={logo.src} />
		</span>
	);
}
