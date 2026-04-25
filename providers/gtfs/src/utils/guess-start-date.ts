/**
 * Devine la date de début (jour 0) d'un voyage à partir de l'heure de départ
 * exprimée en secondes depuis minuit (modulus inclus, peut dépasser 86400).
 */
export function guessStartDate(startSecs: number, at = Temporal.Now.zonedDateTimeISO()) {
	const atDate = at.toPlainDate();
	// startSecs >= 86400 => modulus > 0 (départ après minuit jour 0)
	// (startSecs % 86400) >= 21h => heure > 20h (départ tard le soir jour 0)
	if (at.hour < 12 && (startSecs >= 86400 || startSecs % 86400 >= 21 * 3600)) {
		return atDate.subtract({ days: 1 });
	}
	return atDate;
}
