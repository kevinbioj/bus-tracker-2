/**
 * Appareil modeste : peu de mémoire vive, d'après `deviceMemory` (arrondi et plafonné à 8 Go), que
 * seuls les navigateurs Chromium exposent. Faute de pouvoir en juger, un appareil n'est pas tenu pour
 * modeste : le nombre de cœurs, lui, est arrondi ou bridé par certains navigateurs et ne dit rien de
 * sûr. Évalué une fois : la mémoire ne change pas en cours de visite.
 */
export const isLowEndDevice = (() => {
	if (typeof navigator === "undefined") return false;

	const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
	return memory !== undefined && memory <= 4;
})();
