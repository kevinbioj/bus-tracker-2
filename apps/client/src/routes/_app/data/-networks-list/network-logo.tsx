import { BusFrontIcon } from "lucide-react";

import type { Network } from "~/api/networks";
import { cn } from "~/utils/cn";

type NetworkLogoProps = {
	network: Network;
	className?: string;
};

export function NetworkLogo({ network, className }: Readonly<NetworkLogoProps>) {
	if (network.logoHref === null) {
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
			className={cn(
				"flex shrink-0 items-center justify-center rounded-md p-1",
				network.darkModeLogoHref === null && "dark:bg-white",
				className,
			)}
		>
			<picture className="contents">
				{network.darkModeLogoHref !== null && (
					<source media="(prefers-color-scheme: dark)" srcSet={network.darkModeLogoHref} />
				)}
				<img
					alt=""
					className="max-h-full max-w-full object-contain"
					decoding="async"
					loading="lazy"
					src={network.logoHref}
				/>
			</picture>
		</span>
	);
}
