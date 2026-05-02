import { useState } from "react";

import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import * as m from "~/paraglide/messages";
import { getLocale, locales, setLocale } from "~/paraglide/runtime";

type Locale = (typeof locales)[number];

export function LanguageSetting() {
	const [locale, setSelectedLocale] = useState<Locale>(getLocale());

	const onValueChange = (value: string) => {
		const nextLocale = value as Locale;
		setSelectedLocale(nextLocale);
		void setLocale(nextLocale);
	};

	return (
		<div>
			<Label className="block mb-1 text-base">{m.language_label()}</Label>
			<Select value={locale} onValueChange={onValueChange}>
				<SelectTrigger className="w-full">
					<SelectValue />
				</SelectTrigger>
				<SelectContent className="z-9999">
					<SelectItem value="fr">{m.language_french()}</SelectItem>
					<SelectItem value="en">{m.language_english()}</SelectItem>
				</SelectContent>
			</Select>
		</div>
	);
}
