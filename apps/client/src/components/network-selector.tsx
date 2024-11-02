"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowRight, Route2 as Route2Icon } from "tabler-icons-react";
import { useLocalStorage } from "usehooks-ts";

import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { networks } from "~/data/dataset";

const destinations = [
	{
		id: "normandie",
		title: (
			<span className="font-bold flex items-center gap-2">
				<span className="w-8 h-full relative">
					<Image className="object-contain" fill src="/assets/destinations/normandie.svg" alt="" />
				</span>
				en Normandie
			</span>
		),
		href: "https://normandie.bus-tracker.fr",
		color: "#d20a28",
		textColor: "#ffffff",
	},
	{
		id: "angers",
		title: (
			<span className="font-bold flex items-center gap-2">
				<span className="w-8 h-full relative">
					<Image className="object-contain" fill src="/assets/destinations/angers.svg" alt="" />
				</span>{" "}
				à Angers
			</span>
		),
		href: "https://angers.bus-tracker.fr",
		color: "#EB0F2D",
		textColor: "#ffffff",
	},
	{
		id: "dijon",
		title: (
			<span className="font-bold flex items-center gap-2">
				<span className="w-8 h-full relative">
					<Image className="object-contain" fill src="/assets/destinations/dijon.png" alt="" />
				</span>{" "}
				à Dijon
			</span>
		),
		href: "https://dijon.bus-tracker.fr",
		color: "#9E40A7",
		textColor: "#ffffff",
	},
	{
		id: "rennes",
		title: (
			<span className="font-bold flex items-center gap-2">
				<span className="w-8 h-full relative">
					<Image className="object-contain" fill src="/assets/destinations/rennes.svg" alt="" />
				</span>{" "}
				à Rennes
			</span>
		),
		href: "https://rennes.bus-tracker.fr",
		color: "#1D1D1B",
		textColor: "#ffffff",
	},
];

export default function NetworkSelector() {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [_, setActiveNetwork] = useLocalStorage<string | null>("active-network", null);
	const switchNetwork = (slug: string) => {
		setActiveNetwork(slug);
		setDialogOpen(false);
	};
	return (
		<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
			<DialogTrigger asChild>
				<Button aria-label="Changer de réseau" variant="inherit">
					<Route2Icon size={32} />
				</Button>
			</DialogTrigger>
			<DialogContent className="overflow-y-scroll max-h-[100dvh] sm:max-h-[98dvh]">
				<DialogHeader>
					<DialogTitle>Changer de réseau</DialogTitle>
				</DialogHeader>
				<div className="flex flex-col gap-2">
					<ul className="flex flex-col gap-2 max-h-[60vh] overflow-scroll">
						{networks.map((network) => (
							<li
								className="flex justify-between px-2 py-2 rounded-md transition hover:cursor-pointer hover:brightness-90"
								onClick={() => switchNetwork(network.slug)}
								onKeyUp={() => switchNetwork(network.slug)}
								key={network.slug}
								style={{ backgroundColor: network.color, color: network.textColor }}
							>
								<span className="font-bold">{network.name}</span>
								<ArrowRight className="my-auto" size={20} />
							</li>
						))}
					</ul>
					<hr />
					<div>
						<DialogTitle>ou changer de région</DialogTitle>
						<ul className="flex flex-col gap-2 mt-2">
							{destinations.map((destination) => (
								<a
									className="flex justify-between px-2 py-2 rounded-md transition hover:cursor-pointer hover:brightness-90 h-12"
									href={destination.href}
									target="_blank"
									rel="noreferrer"
									key={destination.id}
									style={{ backgroundColor: destination.color, color: destination.textColor }}
								>
									{destination.title}
									<ArrowRight className="my-auto" size={20} />
								</a>
							))}
						</ul>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
