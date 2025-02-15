import { Link, useLocation } from "react-router-dom";

import { About } from "~/components/about/about";
import { Help } from "~/components/help/help";
import { Settings } from "~/components/settings/settings";
import { Button } from "~/components/ui/button";

const links = [
	{ href: "/", label: "Carte", isActive: (pathname: string) => pathname === "/" },
	{ href: "/data", label: "Données", isActive: (pathname: string) => pathname.startsWith("/data") },
] as const;

export function NavigationBar() {
	const { pathname } = useLocation();

	return (
		<header className="bg-branding text-branding-foreground flex gap-4 h-[60px] p-3 sticky top-0 z-10">
			<img className="h-full" src="/logo.svg" alt="" />
			<span className="hidden text-center font-bold text-3xl text-white lg:block select-none hover:cursor-default">
				Bus Tracker
			</span>
			<nav className="flex flex-1 gap-1 sm:gap-3">
				{links.map(({ href, label, isActive }) => (
					<Button
						asChild
						key={href}
						variant={isActive(pathname) ? "on-branding-default" : "branding-ghost"}
						className="px-3"
					>
						<Link to={href}>{label}</Link>
					</Button>
				))}
			</nav>
			<div className="space-x-1 sm:space-x-2">
				<Settings />
				<Help />
				<About />
			</div>
		</header>
	);
}
