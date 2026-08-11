import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDownIcon, SearchIcon } from "lucide-react";
import { useDeferredValue, useId, useMemo, useState } from "react";

import { GetNetworksQuery } from "~/api/networks";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import {
	type CountryCode,
	defaultCountryCodes,
	getCountryFlag,
	getCountryName,
	isCountryCode,
	useDisplayedCountryCodes,
} from "~/components/vehicles-map/displayed-countries";
import * as m from "~/paraglide/messages";
import { getLocale } from "~/paraglide/runtime";

// Au-delà, parcourir la liste à l'œil devient pénible : on affiche le champ de recherche.
const SEARCH_THRESHOLD = 8;
// Nombre de drapeaux montrés dans le bouton avant de basculer sur un simple compteur.
const SUMMARY_FLAG_LIMIT = 6;

export function DisplayedCountriesSetting() {
	const id = useId();
	const queryClient = useQueryClient();
	const locale = getLocale();
	const { data: networks } = useQuery(GetNetworksQuery);
	const [displayedCountryCodes, setDisplayedCountryCodes] = useDisplayedCountryCodes();

	const [search, setSearch] = useState("");
	const deferredSearch = useDeferredValue(search);

	// La liste proposée suit les réseaux réellement exposés par l'API : aucun code pays n'est figé
	// dans le client. Les pays déjà cochés y figurent même si plus aucun réseau ne les porte, pour
	// que l'utilisateur puisse les décocher.
	const availableCountries = useMemo(() => {
		const codes = new Set<CountryCode>(
			[
				...(networks ?? []).map((network) => network.countryCode),
				...displayedCountryCodes,
				...defaultCountryCodes,
			].filter(isCountryCode),
		);

		return Array.from(codes, (code) => ({ code, name: getCountryName(code, locale) })).sort((a, b) =>
			a.name.localeCompare(b.name, locale),
		);
	}, [networks, displayedCountryCodes, locale]);

	const matchingCountries = useMemo(() => {
		const query = deferredSearch.trim().toLocaleLowerCase(locale);
		if (query.length === 0) return availableCountries;

		return availableCountries.filter(
			({ code, name }) => name.toLocaleLowerCase(locale).includes(query) || code.toLowerCase().includes(query),
		);
	}, [availableCountries, deferredSearch, locale]);

	const selectedCountries = availableCountries.filter(({ code }) => displayedCountryCodes.includes(code));

	const onChange = (countryCode: CountryCode, checked: boolean) => {
		setDisplayedCountryCodes(
			availableCountries
				.map(({ code }) => code)
				.filter((code) => (code === countryCode ? checked : displayedCountryCodes.includes(code))),
		);
		queryClient.refetchQueries({ queryKey: ["vehicle-journeys"] });
	};

	return (
		<div>
			<Label className="block mb-1 text-base" htmlFor={id}>
				{m.settings_displayed_countries_label()}
			</Label>
			<p className="mb-2 text-sm text-muted-foreground">{m.settings_displayed_countries_description()}</p>
			<Popover onOpenChange={(open) => !open && setSearch("")}>
				<PopoverTrigger
					render={
						<Button id={id} size="lg" variant="outline" className="w-full justify-between font-normal">
							<span className="min-w-0 truncate text-left">
								{selectedCountries.length > SUMMARY_FLAG_LIMIT
									? m.settings_displayed_countries_summary({ count: selectedCountries.length })
									: selectedCountries.length === 1
										? `${getCountryFlag(selectedCountries[0]!.code)} ${selectedCountries[0]!.name}`
										: selectedCountries.map(({ code }) => getCountryFlag(code)).join(" ")}
							</span>
							<ChevronDownIcon className="opacity-50" data-icon="inline-end" />
						</Button>
					}
				/>
				<PopoverContent align="start" className="w-(--anchor-width) p-0" positionerClassName="z-10000">
					{availableCountries.length > SEARCH_THRESHOLD ? (
						<div className="relative border-b p-1.5">
							<SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								autoFocus
								className="h-8 border-0 pl-8 shadow-none focus-visible:ring-0"
								placeholder={m.settings_displayed_countries_search_placeholder()}
								value={search}
								onChange={(event) => setSearch(event.target.value)}
							/>
						</div>
					) : null}
					{/* Liste bornée en hauteur : le réglage garde la même taille quel que soit le nombre de pays. */}
					<div className="max-h-56 overflow-y-auto p-1">
						{matchingCountries.length === 0 ? (
							<p className="px-2 py-4 text-center text-sm text-muted-foreground">
								{m.settings_displayed_countries_empty()}
							</p>
						) : (
							matchingCountries.map(({ code, name }) => {
								const checked = displayedCountryCodes.includes(code);

								return (
									<Label
										key={code}
										className="items-center gap-2 rounded-md px-2 py-1.5 text-sm font-normal cursor-pointer hover:bg-muted has-disabled:cursor-not-allowed has-disabled:opacity-50"
									>
										<Checkbox
											checked={checked}
											className="rounded-sm"
											// Tout décocher afficherait une carte vide : on garde au moins un pays actif.
											disabled={checked && displayedCountryCodes.length === 1}
											onCheckedChange={(value) => onChange(code, value)}
										/>
										<span aria-hidden className="text-base leading-none">
											{getCountryFlag(code)}
										</span>
										<span className="min-w-0 truncate">{name}</span>
									</Label>
								);
							})
						)}
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}
