import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import type { Network } from "~/api/networks";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import * as m from "~/paraglide/messages";

import { NetworkHeader } from "./network-header";

type DataPageLayoutProps = {
	children: ReactNode;
	current?: ReactNode;
	currentClassName?: string;
	network: Network;
	networkSearch?: { tab?: string };
	title: string;
};

export function DataPageLayout({
	children,
	current,
	currentClassName,
	network,
	networkSearch,
	title,
}: Readonly<DataPageLayoutProps>) {
	return (
		<>
			<title>{title}</title>
			<main className="max-w-(--breakpoint-xl) p-3 w-full mx-auto">
				<NetworkHeader network={network} />
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink render={<Link to="/data">{m.data_breadcrumb()}</Link>} />
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						{current === undefined ? (
							<BreadcrumbItem>
								<BreadcrumbPage>
									<NetworkBreadcrumbLabel network={network} />
								</BreadcrumbPage>
							</BreadcrumbItem>
						) : (
							<>
								<BreadcrumbItem>
									<BreadcrumbLink
										render={
											<Link
												to="/data/networks/$networkId"
												params={{ networkId: String(network.id) }}
												search={networkSearch}
											>
												<NetworkBreadcrumbLabel network={network} />
											</Link>
										}
									/>
								</BreadcrumbItem>
								<BreadcrumbSeparator />
								<BreadcrumbItem>
									<BreadcrumbPage className={currentClassName}>{current}</BreadcrumbPage>
								</BreadcrumbItem>
							</>
						)}
					</BreadcrumbList>
				</Breadcrumb>
				{children}
			</main>
		</>
	);
}

function NetworkBreadcrumbLabel({ network }: Readonly<{ network: Network }>) {
	return network.logoHref ? (
		<picture className="min-w-12 w-fit">
			{network.darkModeLogoHref !== null && (
				<source srcSet={network.darkModeLogoHref} media="(prefers-color-scheme: dark)" />
			)}
			<img className="h-5 object-contain m-auto" src={network.logoHref} alt={network.name} />
		</picture>
	) : (
		network.name
	);
}
