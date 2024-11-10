import { Link, useLocation } from "react-router-dom";

import { Settings } from "~/components/settings/settings";
import { Button } from "../components/ui/button";

export function NavigationBar() {
	const { pathname } = useLocation();
	return (
		<header className="flex h-16 w-full p-3 lg:h-full lg:w-40 lg:flex-col">
			<h1 className="hidden text-center font-bold text-3xl text-white lg:block">
				Bus
				<br />
				Tracker
			</h1>
			<nav className="flex flex-1 gap-3 lg:my-3 lg:flex-col">
				<Button asChild variant={pathname === "/" ? "default" : "ghost"}>
					<Link to="/">
						{/* <IconWorld /> */}
						Carte
					</Link>
				</Button>
			</nav>
			<div className="">
				<Settings />
				<p className="mt-3 hidden text-center text-white text-xs lg:block">V.2.0.0 - 04/10/2024</p>
			</div>
		</header>
	);
}
