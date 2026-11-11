import { LanguagesIcon } from "lucide-react";
import { useState } from "react";

import { SettingField, settingIconClasses } from "~/components/setting-blocks";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import * as m from "~/paraglide/messages";
import { type locales, setLocale } from "~/paraglide/runtime";
import { getLocalePreference, type LocalePreference, setSystemLocalePreference } from "~/setup-paraglide";

type Locale = (typeof locales)[number];

const languages = [
	{ label: m.language_system(), value: "system" },
	{ label: m.language_french(), value: "fr" },
	{ label: m.language_english(), value: "en" },
	{ label: m.language_german(), value: "de" },
];

export function LanguageSetting() {
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
		<SettingField icon={<LanguagesIcon className={settingIconClasses} />} label={m.language_label()}>
			<Select items={languages} value={localePreference} onValueChange={onValueChange}>
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
		</SettingField>
	);
}
