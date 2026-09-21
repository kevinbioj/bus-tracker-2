import dayjs from "dayjs";

import * as m from "~/paraglide/messages";

/** Heure locale de l'arrêt : l'offset est retiré pour ne pas afficher celle du visiteur. */
export const formatLocalTime = (time: string) => dayjs(time.slice(0, -6)).format("HH:mm");

/** Attente restante avant un passage, en minutes puis en heures et minutes. */
export function formatCountdown(minutes: number) {
	return minutes < 60
		? m.stop_call_in_minutes({ count: minutes })
		: m.stop_call_in_hours({
				hours: Math.floor(minutes / 60),
				minutes: String(minutes % 60).padStart(2, "0"),
			});
}
