import { useId, useState } from "react";

import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import * as m from "~/paraglide/messages";
import { type locales, setLocale } from "~/paraglide/runtime";
import { getLocalePreference, type LocalePreference, setSystemLocalePreference } from "~/setup-paraglide";

type Locale = (typeof locales)[number];

const languages = [
	{ label: m.language_system(), value: "system" },
	{ label: m.language_french(), value: "fr" },
	{ label: m.language_english(), value: "en" },
];

export function LanguageSetting() {
	const id = useId();
	const [localePreference, setLocalePreference] = useState<LocalePreference>(getLocalePreference());

	const onValueChange = (value: string | null) => {
		if (value === "system" || value === null) {
			setLocalePreference("system");
			setSystemLocalePreference();
			return;
		}

		const nextLocale = value as Locale;
		setLocalePreference(nextLocale);
		void setLocale(nextLocale);
	};

	return (
		<div>
			<Label className="block mb-1 text-base" htmlFor={id}>
				{m.language_label()}
			</Label>
			<Select id={id} items={languages} value={localePreference} onValueChange={onValueChange}>
				<SelectTrigger className="w-full">
					<SelectValue />
				</SelectTrigger>
				<SelectContent className="z-9999">
					<SelectGroup>
						{languages.map(({ label, value }) => (
							<SelectItem key={value} value={value}>
								{label}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</div>
	);
}
