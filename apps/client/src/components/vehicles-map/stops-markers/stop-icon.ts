import type { StopAreaMode } from "@bus-tracker/contracts";

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

/** Emplacement du pictogramme sur la plaque ; la hauteur disponible est de 11 px. */
type GlyphBox = { x: number; y: number; width: number };

/** Phares, évidés au bas de la face avant. */
function drawLights(ctx: CanvasRenderingContext2D, { x, width }: GlyphBox, y: number) {
	for (const lightX of [x + 2.1, x + width - 2.1]) {
		ctx.beginPath();
		ctx.arc(lightX, y, 0.8, 0, Math.PI * 2);
		ctx.fill();
	}
}

/** Rails qui fuient vers le bas, sous une caisse dont le bas est en `bottom`. */
function drawRails(ctx: CanvasRenderingContext2D, { x, width }: GlyphBox, bottom: number) {
	ctx.lineCap = "round";
	ctx.lineWidth = 1.2;
	ctx.beginPath();
	ctx.moveTo(x + 2, bottom + 0.8);
	ctx.lineTo(x + 0.8, bottom + 2.6);
	ctx.moveTo(x + width - 2, bottom + 0.8);
	ctx.lineTo(x + width - 0.8, bottom + 2.6);
	ctx.stroke();
}

/**
 * Pictogrammes, dessinés dans la couleur du glyphe ; les évidements reprennent celle de la plaque.
 * Tous vus de face, sauf le funiculaire — de face, rien ne le distinguerait d'un tramway.
 */
const drawGlyph: Record<StopAreaMode, (ctx: CanvasRenderingContext2D, box: GlyphBox, plateColor: string) => void> = {
	// Train : caisse au nez arrondi, posée sur des rails qui fuient vers le bas.
	RAIL: (ctx, box, plateColor) => {
		const { x, y, width } = box;
		const height = 8.5;

		ctx.beginPath();
		ctx.roundRect(x, y, width, height, [4, 4, 1.5, 1.5]);
		ctx.fill();

		drawRails(ctx, box, y + height);

		ctx.fillStyle = plateColor;
		ctx.beginPath();
		ctx.roundRect(x + 1.4, y + 2, width - 2.8, 3, 0.8);
		ctx.fill();
		drawLights(ctx, box, y + height - 1.8);
	},
	// Métro : le « M » des entrées de station.
	SUBWAY: (ctx, { x, y, width }) => {
		ctx.lineWidth = 1.9;
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		ctx.beginPath();
		ctx.moveTo(x + 0.8, y + 9.5);
		ctx.lineTo(x + 0.8, y + 1);
		ctx.lineTo(x + width / 2, y + 8);
		ctx.lineTo(x + width - 0.8, y + 1);
		ctx.lineTo(x + width - 0.8, y + 9.5);
		ctx.stroke();
	},
	// Tramway, réduit à l'essentiel : pantographe, caisse haute et étroite percée d'un large
	// pare-brise, rails.
	TRAMWAY: (ctx, box, plateColor) => {
		const { x, y, width } = box;
		const centerX = x + width / 2;
		const bodyWidth = 6.4;
		const bodyLeft = centerX - bodyWidth / 2;
		const bodyTop = y + 1.8;
		const bodyHeight = 7;

		ctx.lineCap = "round";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(centerX - 1.8, y + 0.5);
		ctx.lineTo(centerX + 1.8, y + 0.5);
		ctx.moveTo(centerX, y + 0.5);
		ctx.lineTo(centerX, bodyTop);
		ctx.stroke();

		ctx.beginPath();
		ctx.roundRect(bodyLeft, bodyTop, bodyWidth, bodyHeight, [2.2, 2.2, 1.2, 1.2]);
		ctx.fill();
		drawRails(ctx, box, bodyTop + bodyHeight);

		ctx.fillStyle = plateColor;
		ctx.beginPath();
		ctx.roundRect(bodyLeft + 1, bodyTop + 1.2, bodyWidth - 2, 3.2, 0.8);
		ctx.fill();
	},
	// Bus : caisse, pare-brise, feux et roues.
	BUS: (ctx, box, plateColor) => {
		const { x, y, width } = box;
		const height = 9.5;

		ctx.beginPath();
		ctx.roundRect(x, y, width, height, 2);
		ctx.fill();

		// Roues, dépassant sous la caisse.
		ctx.beginPath();
		ctx.roundRect(x + 0.75, y + height - 0.5, 2, 2, 0.6);
		ctx.roundRect(x + width - 2.75, y + height - 0.5, 2, 2, 0.6);
		ctx.fill();

		// Pare-brise et feux, évidés dans la couleur de la plaque.
		ctx.fillStyle = plateColor;
		ctx.beginPath();
		ctx.roundRect(x + 1.25, y + 1.25, width - 2.5, 4, 0.8);
		ctx.fill();
		drawLights(ctx, box, y + height - 1.9);
	},
	// Funiculaire : cabine de profil, gravissant sa voie en pente.
	FUNICULAR: (ctx, { x, y, width }, plateColor) => {
		ctx.save();
		ctx.translate(x + width / 2, y + 5.5);
		ctx.rotate(-Math.PI / 7);

		ctx.lineCap = "round";
		ctx.lineWidth = 1.2;
		ctx.beginPath();
		ctx.moveTo(-6, 3);
		ctx.lineTo(6, 3);
		ctx.stroke();

		ctx.beginPath();
		ctx.roundRect(-4, -4, 8, 5.5, 1.2);
		for (const wheelX of [-2.3, 2.3]) {
			ctx.moveTo(wheelX + 0.9, 2);
			ctx.arc(wheelX, 2, 0.9, 0, Math.PI * 2);
		}
		ctx.fill();

		ctx.fillStyle = plateColor;
		ctx.beginPath();
		ctx.roundRect(-3, -3, 2.6, 2.2, 0.5);
		ctx.roundRect(0.4, -3, 2.6, 2.2, 0.5);
		ctx.fill();
		ctx.restore();
	},
};

/**
 * Dessine un arrêt à la manière d'un poteau d'arrêt : une plaque carrée portant le pictogramme du
 * mode le plus lourd qui le dessert, sur une hampe dont la pointe marque l'emplacement exact de l'arrêt.
 *
 * La silhouette est volontairement étrangère à celle des véhicules — des cercles aux couleurs de
 * leur ligne : un arrêt ne doit jamais pouvoir être pris pour un bus, ni l'inverse.
 */
export function createStopIcon(mode: StopAreaMode, selected: boolean) {
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

	const glyphBox = { x: plateX + 4.5, y: plateY + 3.5, width: PLATE_SIZE - 9 };
	ctx.fillStyle = glyphColor;
	ctx.strokeStyle = glyphColor;
	drawGlyph[mode](ctx, glyphBox, plateColor);

	return ctx.getImageData(0, 0, canvas.width, canvas.height);
}
