import { Link, useLocation } from "react-router-dom";

import { About } from "~/components/about/about";
import { Settings } from "~/components/settings/settings";
import { Button } from "~/components/ui/button";

const links = [
	{ href: "/", label: "Carte", isActive: (pathname: string) => pathname === "/" },
	{ href: "/data", label: "Données", isActive: (pathname: string) => pathname.startsWith("/data") },
] as const;

export function NavigationBar() {
	const { pathname } = useLocation();

	return (
		<header className="bg-branding text-branding-foreground flex gap-5 h-[60px] p-3">
			<h1 className="hidden text-center font-bold text-3xl text-white lg:block select-none hover:cursor-default">
				Bus Tracker
			</h1>
			<img src="/logo.svg" alt="Bus Tracker" className="lg:hidden" />
			<nav className="flex flex-1 gap-3">
				{links.map(({ href, label, isActive }) => (
					<Button asChild key={href} variant={isActive(pathname) ? "on-branding-default" : "branding-ghost"}>
						<Link to={href}>{label}</Link>
					</Button>
				))}
			</nav>
			<div className="space-x-2">
				<Settings />
				<About />
			</div>
		</header>
	);
}
