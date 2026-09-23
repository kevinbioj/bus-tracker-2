/** Bleu nuit des plaques d'arrêt : sombre assez pour trancher sur le fond clair de la carte. */
const PLATE_COLOR = "#1E2A4A";

/** Repli de la couleur de marque, si la feuille de style n'est pas encore appliquée. */
const BRANDING_FALLBACK = "#8B1A4B";

/**
 * Couleur de marque de l'application, reprise pour l'arrêt sélectionné : c'est elle qui signale
 * partout ailleurs l'élément actif. Lue sur la feuille de style plutôt que recopiée, pour la suivre.
 */
function readBrandingColor() {
	const value = getComputedStyle(document.documentElement).getPropertyValue("--branding").trim();
	return value.length > 0 ? value : BRANDING_FALLBACK;
}

const OUTLINE_COLOR = "#FFFFFF";

/** Résolution du dessin : les icônes sont enregistrées en `pixelRatio: 2`, nettes sur écran dense. */
export const STOP_ICON_PIXEL_RATIO = 2;

// Dimensions logiques (px CSS) : une plaque carrée posée sur une hampe courte.
const PLATE_SIZE = 18;
const STEM_HEIGHT = 7;
const MARGIN = 2;

export const STOP_ICON_WIDTH = PLATE_SIZE + MARGIN * 2;
export const STOP_ICON_HEIGHT = PLATE_SIZE + STEM_HEIGHT + MARGIN * 2;

/** Agrandissement de l'icône de l'arrêt sélectionné. */
export const SELECTED_STOP_ICON_SCALE = 1.25;

/** Hauteur, depuis la pointe de la hampe, du centre de la plaque : sert à y aligner le libellé. */
export const STOP_PLATE_CENTER_OFFSET = STOP_ICON_HEIGHT - MARGIN - PLATE_SIZE / 2;

/**
 * Dessine un arrêt à la manière d'un poteau d'arrêt de bus : une plaque carrée portant un
 * pictogramme de bus, sur une hampe dont la pointe marque l'emplacement exact de l'arrêt.
 *
 * La silhouette est volontairement étrangère à celle des véhicules — des cercles aux couleurs de
 * leur ligne : un arrêt ne doit jamais pouvoir être pris pour un bus, ni l'inverse.
 */
export function createStopIcon(selected: boolean) {
	const ratio = STOP_ICON_PIXEL_RATIO;
	const canvas = document.createElement("canvas");
	canvas.width = STOP_ICON_WIDTH * ratio;
	canvas.height = STOP_ICON_HEIGHT * ratio;

	const ctx = canvas.getContext("2d")!;
	ctx.scale(ratio, ratio);

	const plateColor = selected ? readBrandingColor() : PLATE_COLOR;
	const glyphColor = OUTLINE_COLOR;

	const plateX = MARGIN;
	const plateY = MARGIN;
	const centerX = STOP_ICON_WIDTH / 2;
	const stemTop = plateY + PLATE_SIZE;
	const stemBottom = STOP_ICON_HEIGHT - 0.5;

	// Hampe : un trait sombre bordé de blanc, pour rester visible sur les routes comme sur le bâti.
	ctx.lineCap = "round";
	ctx.strokeStyle = OUTLINE_COLOR;
	ctx.lineWidth = 3.5;
	ctx.beginPath();
	ctx.moveTo(centerX, stemTop - 1);
	ctx.lineTo(centerX, stemBottom - 0.75);
	ctx.stroke();

	ctx.strokeStyle = plateColor;
	ctx.lineWidth = 1.75;
	ctx.stroke();

	// Plaque, détachée du fond par une ombre portée légère et un liseré blanc.
	ctx.save();
	ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
	ctx.shadowBlur = 2;
	ctx.shadowOffsetY = 0.5;
	ctx.fillStyle = plateColor;
	ctx.beginPath();
	ctx.roundRect(plateX, plateY, PLATE_SIZE, PLATE_SIZE, 4);
	ctx.fill();
	ctx.restore();

	ctx.strokeStyle = OUTLINE_COLOR;
	ctx.lineWidth = 1.25;
	ctx.beginPath();
	ctx.roundRect(plateX + 0.625, plateY + 0.625, PLATE_SIZE - 1.25, PLATE_SIZE - 1.25, 3.5);
	ctx.stroke();

	// Pictogramme de bus vu de face : caisse, pare-brise, feux et roues.
	const busX = plateX + 4.5;
	const busY = plateY + 3.5;
	const busWidth = PLATE_SIZE - 9;
	const busHeight = 9.5;

	ctx.fillStyle = glyphColor;
	ctx.beginPath();
	ctx.roundRect(busX, busY, busWidth, busHeight, 2);
	ctx.fill();

	// Roues, dépassant sous la caisse.
	ctx.beginPath();
	ctx.roundRect(busX + 0.75, busY + busHeight - 0.5, 2, 2, 0.6);
	ctx.roundRect(busX + busWidth - 2.75, busY + busHeight - 0.5, 2, 2, 0.6);
	ctx.fill();

	// Pare-brise et feux, évidés dans la couleur de la plaque.
	ctx.fillStyle = plateColor;
	ctx.beginPath();
	ctx.roundRect(busX + 1.25, busY + 1.25, busWidth - 2.5, 4, 0.8);
	ctx.fill();

	for (const lightX of [busX + 2.1, busX + busWidth - 2.1]) {
		ctx.beginPath();
		ctx.arc(lightX, busY + busHeight - 1.9, 0.8, 0, Math.PI * 2);
		ctx.fill();
	}

	return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
