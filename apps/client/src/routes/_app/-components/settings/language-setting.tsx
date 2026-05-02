import { useState } from "react";

import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import * as m from "~/paraglide/messages";
import { locales, setLocale } from "~/paraglide/runtime";
import { getLocalePreference, setSystemLocalePreference, type LocalePreference } from "~/setup-paraglide";

type Locale = (typeof locales)[number];

export function LanguageSetting() {
	const [localePreference, setLocalePreference] = useState<LocalePreference>(getLocalePreference());

	const onValueChange = (value: string) => {
		if (value === "system") {
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
			<Label className="block mb-1 text-base">{m.language_label()}</Label>
			<Select value={localePreference} onValueChange={onValueChange}>
				<SelectTrigger className="w-full">
					<SelectValue />
				</SelectTrigger>
				<SelectContent className="z-9999">
					<SelectItem value="system">{m.language_system()}</SelectItem>
					<SelectItem value="fr">{m.language_french()}</SelectItem>
					<SelectItem value="en">{m.language_english()}</SelectItem>
				</SelectContent>
			</Select>
		</div>
	);
}
