import { useLocalStorage } from "usehooks-ts";

import { Label } from "~/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import * as m from "~/paraglide/messages";

export function DisplayAbsoluteTimeSetting() {
	const [displayAbsoluteTime, setDisplayAbsoluteTime] = useLocalStorage("display-absolute-time", false);

	return (
		<div>
			<Label className="block mb-1 text-base">{m.settings_time_display_label()}</Label>
			<Tabs
				value={displayAbsoluteTime ? "absolute" : "relative"}
				onValueChange={(v) => setDisplayAbsoluteTime(v === "absolute")}
			>
				<TabsList className="grid grid-cols-2">
					<TabsTrigger value="relative">{m.settings_time_display_relative()}</TabsTrigger>
					<TabsTrigger value="absolute">{m.settings_time_display_absolute()}</TabsTrigger>
				</TabsList>
			</Tabs>
		</div>
	);
}
