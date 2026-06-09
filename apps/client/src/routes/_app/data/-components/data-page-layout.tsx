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

type BreadcrumbEntry = {
	label: ReactNode;
	to: string;
	params?: Record<string, string>;
	search?: Record<string, string>;
};

type DataPageLayoutProps = {
	children: ReactNode;
	current?: ReactNode;
	currentClassName?: string;
	/** Extra breadcrumb levels inserted between the network and the current page */
	breadcrumbMiddle?: BreadcrumbEntry[];
	network: Network;
	networkSearch?: { tab?: string };
	title: string;
};

export function DataPageLayout({
	children,
	current,
	currentClassName,
	breadcrumbMiddle,
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
						{current === undefined && (breadcrumbMiddle === undefined || breadcrumbMiddle.length === 0) ? (
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
								{breadcrumbMiddle?.map((entry) => (
									<>
										<BreadcrumbSeparator key={`sep-${entry.to}`} />
										<BreadcrumbItem key={entry.to}>
											<BreadcrumbLink
												render={
													<Link to={entry.to} params={entry.params ?? {}} search={entry.search ?? {}}>
														{entry.label}
													</Link>
												}
											/>
										</BreadcrumbItem>
									</>
								))}
								{current !== undefined && (
									<>
										<BreadcrumbSeparator />
										<BreadcrumbItem>
											<BreadcrumbPage className={currentClassName}>{current}</BreadcrumbPage>
										</BreadcrumbItem>
									</>
								)}
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
