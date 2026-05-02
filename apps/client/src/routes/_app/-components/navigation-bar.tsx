import { Link, useLocation } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";
import * as m from "~/paraglide/messages";
import { About } from "~/routes/_app/-components/about/about";
import { Announcements } from "~/routes/_app/-components/announcements/announcements";
import { Settings } from "~/routes/_app/-components/settings/settings";

const links = [
	{
		href: "/",
		label: m.nav_map,
		isActive: (pathname: string) => pathname === "/",
	},
	{
		href: "/data",
		label: m.nav_data,
		isActive: (pathname: string) => pathname.startsWith("/data"),
	},
] as const;

export function NavigationBar() {
	const pathname = useLocation({ select: (state) => state.pathname });

	return (
		<header className="bg-branding text-branding-foreground sticky top-0 z-10">
			<div className="h-14 px-3 py-1 flex gap-3 lg:gap-6 items-center">
				<div className="h-full flex gap-2 items-center">
					<img className="h-full" src="/logo.svg" alt="" />
					<span className="hidden text-center font-bold text-3xl text-white lg:block select-none hover:cursor-default">
						Bus Tracker
					</span>
				</div>
				<nav className="flex flex-1 gap-1 sm:gap-3">
					{links.map(({ href, label, isActive }) => (
						<Button
							key={href}
							variant={isActive(pathname) ? "on-branding-default" : "branding-ghost"}
							className="px-3"
							size="lg"
							nativeButton={false}
							render={<Link to={href}>{label()}</Link>}
						/>
					))}
				</nav>
				<div className="space-x-1 sm:space-x-2">
					<Announcements />
					<Settings />
					<About />
				</div>
			</div>
		</header>
	);
}
