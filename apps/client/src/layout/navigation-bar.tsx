// import { IconBus, IconWorld } from "@tabler/icons-react";

import { Button } from "../components/button";

export function NavigationBar() {
	return (
		<header className="flex h-16 w-full bg-primary p-3 lg:h-full lg:w-40 lg:flex-col">
			<h1 className="hidden text-center font-bold text-3xl text-white lg:block">
				Bus
				<br />
				Tracker
			</h1>
			<nav className="flex flex-1 gap-3 lg:my-3 lg:flex-col">
				<Button className="flex items-center justify-center gap-2 rounded-xl bg-primary-650 p-3 text-white shadow-lg transition-colors hover:bg-primary-600 active:bg-primary-650 lg:flex-col lg:gap-1">
					{/* <IconWorld /> */}
					Carte
				</Button>
				<Button className="flex items-center justify-center gap-2 rounded-xl bg-primary-650 p-3 text-white shadow-lg transition-colors hover:bg-primary-600 active:bg-primary-650 lg:flex-col lg:gap-1">
					{/* <IconBus /> */}
					Véhicules
				</Button>
			</nav>
			<p className="hidden text-center text-white text-xs lg:block">V.2.0.0 - 04/10/2024</p>
		</header>
	);
}
