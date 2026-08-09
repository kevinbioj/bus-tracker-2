import {
	type ComponentPropsWithoutRef,
	type CSSProperties,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { match, P } from "ts-pattern";

import { cn } from "~/utils/cn";

const paneBgColor = "#1D1D1B";

/** Scrolling speed of texts, expressed in matrix pixels per second. */
const scrollSpeed = 50;

/**
 * Speed multiplier applied to the route number block. Its pane is much narrower
 * than the destination one, so at the nominal speed its cycle restarts far too
 * often: scrolling it half as fast keeps it readable.
 */
const routeNumberSpeedRatio = 0.5;

/** Time a page stays displayed when none of its lines scrolls, in milliseconds. */
const staticPageDuration = 3000;

/**
 * Determines the outline color for an automatically-generated route number,
 * following the rule in effect for automatic girouettes:
 * - white text over any background → black outline
 * - no text and no background → no outline
 * - anything else → white outline
 */
export function getAutoOutlineColor(textColor?: string | null, backgroundColor?: string | null): string | undefined {
	return match([textColor?.toUpperCase() ?? null, backgroundColor ?? null])
		.with(["#FFFFFF", P.string], () => "#000000")
		.with([null, null], () => undefined)
		.otherwise(() => "#FFFFFF");
}

function processText(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\\n/g, "<br>")
		.replaceAll(" ", "&nbsp;");
}

const fontProperties = {
	// Hanover Graphic fonts
	"0808B2E1": { height: 8, spacing: 1, extraSpacing: false },
	"1310C2E1": { height: 13, spacing: 2, extraSpacing: false },
	"1508C2E1": { height: 15, spacing: 2, extraSpacing: false },
	"1510N2E1": { height: 15, spacing: 2, extraSpacing: false },
	"1513B3E1": { height: 15, spacing: 2, extraSpacing: false },
	// Hanover Super-X fonts
	"0505SUPX": { height: 5, spacing: 1, extraSpacing: true },
	"1107SUPX": { height: 11, spacing: 1, extraSpacing: true },
	"1407SUPX": { height: 14, spacing: 1, extraSpacing: true },
	"1507SUPX": { height: 15, spacing: 1, extraSpacing: true },
	"1508SUPX": { height: 15, spacing: 1, extraSpacing: true },
	"1710SUPX": { height: 17, spacing: 2, extraSpacing: true },
	// Lumiplan/Duhamel fonts
	"14LUPLAN": { height: 14, spacing: 1, extraSpacing: false },
	"LUMIPLAN-2": { height: 8, spacing: 1, extraSpacing: false },
	"LUMIPLAN-A": { height: 16, spacing: 1, extraSpacing: false },
	"DUHAMEL-24-22-2": { height: 22, spacing: 2, extraSpacing: false },
	// Special fonts
	METRO: { height: 16, spacing: 0, extraSpacing: false },
	"1510N2E1-TCAR": { height: 15, spacing: 2, extraSpacing: false },
	"1513B3E1-TCAR": { height: 15, spacing: 2, extraSpacing: false },
	"17SYMBOLS": { height: 17, spacing: 2, extraSpacing: false },
} as const;

type Font = keyof typeof fontProperties;
export type TextSpacing = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

const ledColors = {
	YELLOW: "#FF8000",
	WHITE: "#F2FBFF",
} as const;
type LedColor = keyof typeof ledColors;

type GirouetteDimensions = {
	height: number;
	rnWidth: number;
	destinationWidth: number;
};
const defaultDimensions: GirouetteDimensions = {
	height: 17,
	rnWidth: 32,
	destinationWidth: 160,
};

export type RouteNumberData = {
	text: string;
	//- Font & spacing
	font?: Font;
	scroll?: boolean;
	spacing?: TextSpacing;
	//- Colors
	backgroundColor?: string;
	outlineColor?: string;
	textColor?: string;
	halfPattern?: "tl" | "tr" | "bl" | "br";
};

type PageLine = {
	font?: Font;
	scroll?: boolean;
	spacing?: number;
	text: string;
};

type PagesData = PageLine | [PageLine, PageLine];

export type GirouetteData = {
	dimensions?: GirouetteDimensions;
	ledColor?: "YELLOW" | "WHITE";
	routeNumber?: RouteNumberData;
	pages?: PagesData[];
	width?: number;
};

type GirouetteProps = ComponentPropsWithoutRef<"div"> &
	GirouetteData & {
		onRouteNumberClick?: () => void;
		width: number;
	};

export function Girouette({
	className,
	dimensions = defaultDimensions,
	ledColor = "WHITE",
	onRouteNumberClick,
	pages = [],
	routeNumber = { text: "" },
	width,
	...props
}: Readonly<GirouetteProps>) {
	return (
		<div
			className={cn("flex border-white", className)}
			style={{
				aspectRatio: (dimensions.rnWidth + dimensions.destinationWidth) / dimensions.height,
				backgroundColor: paneBgColor,
				width: `${width}px`,
			}}
			{...props}
		>
			<RouteNumber
				dimensions={dimensions}
				ledColor={ledColor}
				onClick={onRouteNumberClick}
				routeNumber={routeNumber}
				width={width}
			/>
			<Pages dimensions={dimensions} ledColor={ledColor} pages={pages} width={width} />
		</div>
	);
}

// ---

type ScrollingTextProps = {
	className?: string;
	/** Notified with the duration of a full scrolling cycle, in milliseconds (0 when the text doesn't scroll). */
	onDurationChange?: (duration: number) => void;
	/** Size of a single matrix pixel, in CSS pixels. */
	onePixel: number;
	scroll?: boolean;
	/** Multiplier applied to the nominal scrolling speed. */
	speedRatio?: number;
	style?: CSSProperties;
	text: string;
};

/**
 * Renders a girouette text, optionally scrolling it at a constant speed: the
 * animation duration is derived from the distance to travel, so that a long
 * text takes longer to scroll instead of scrolling faster.
 */
function ScrollingText({
	className,
	onDurationChange,
	onePixel,
	scroll,
	speedRatio = 1,
	style,
	text,
}: Readonly<ScrollingTextProps>) {
	const ref = useRef<HTMLSpanElement>(null);
	const [metrics, setMetrics] = useState<{ containerWidth: number; textWidth: number }>();

	useLayoutEffect(() => {
		const element = ref.current;
		if (!scroll || element === null) {
			setMetrics(undefined);
			return;
		}

		// Observing both the text and its container covers every change that
		// affects the travelled distance: text, font size, spacing, girouette
		// width, and the asynchronous loading of the LED fonts.
		const observer = new ResizeObserver(() => {
			const containerWidth = element.parentElement?.clientWidth ?? 0;
			const textWidth = element.scrollWidth;
			setMetrics((current) =>
				current?.containerWidth === containerWidth && current.textWidth === textWidth
					? current
					: { containerWidth, textWidth },
			);
		});

		observer.observe(element);
		if (element.parentElement !== null) observer.observe(element.parentElement);

		return () => observer.disconnect();
	}, [scroll]);

	const duration =
		metrics !== undefined && onePixel > 0 && speedRatio > 0
			? (metrics.containerWidth + metrics.textWidth) / (scrollSpeed * speedRatio * onePixel)
			: 0;

	useEffect(() => {
		onDurationChange?.(duration * 1000);
	}, [duration, onDurationChange]);

	return (
		<span
			className={className}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: HTML-escaped by processText, only <br> tags are injected
			dangerouslySetInnerHTML={{ __html: processText(text) }}
			ref={ref}
			style={{
				...style,
				...(duration > 0 && metrics !== undefined
					? ({
							// Cancels the centering of the parent (both in row and column
							// direction) so that the scroll starts from the left edge.
							marginRight: "auto",
							animation: `girouette-scroll ${duration}s linear infinite`,
							"--scroll-from": `${metrics.containerWidth}px`,
							"--scroll-to": `${-metrics.textWidth}px`,
						} as CSSProperties)
					: {}),
			}}
		/>
	);
}

// ---

type RouteNumberProps = {
	dimensions: GirouetteDimensions;
	ledColor: LedColor;
	onClick?: () => void;
	routeNumber: RouteNumberData;
	width: number;
};

function RouteNumber({ dimensions, ledColor, onClick, routeNumber, width }: Readonly<RouteNumberProps>) {
	const [halfPattern, setHalfPattern] = useState<RouteNumberData["halfPattern"]>();

	useEffect(() => {
		if (routeNumber.halfPattern === undefined) {
			setHalfPattern(undefined);
			return;
		}

		let showingHalfPattern = false;

		const interval = setInterval(() => {
			setHalfPattern(showingHalfPattern ? undefined : routeNumber.halfPattern);
			showingHalfPattern = !showingHalfPattern;
		}, 1500);

		return () => clearInterval(interval);
	}, [routeNumber.halfPattern]);

	// A zero-width route number block is collapsed away entirely, so that its
	// padding and letter-spacing don't eat into the destination block.
	if (routeNumber === undefined || dimensions.rnWidth === 0) return null;

	const fontFamily =
		routeNumber.font !== undefined && routeNumber.font in fontProperties ? routeNumber.font : "1513B3E1";
	const height = (dimensions.height * width) / (dimensions.rnWidth + dimensions.destinationWidth);
	const onePixel = width / (dimensions.rnWidth + dimensions.destinationWidth);
	const spacing =
		onePixel * (routeNumber.spacing ?? fontProperties[fontFamily].spacing) +
		onePixel * (fontProperties[fontFamily].extraSpacing && routeNumber.outlineColor ? 2 : 0);
	const virtualHeight = (height / dimensions.height) * fontProperties[fontFamily].height;
	return (
		<button
			className="flex items-center justify-center overflow-hidden whitespace-nowrap"
			onClick={onClick}
			type="button"
			style={{
				width: `${onePixel * dimensions.rnWidth}px`,
				cursor: onClick ? "pointer" : "default",
				//- Font, placement & spacing
				fontFamily: `"${fontFamily}"`,
				fontSize: `${virtualHeight}px`,
				letterSpacing: `${spacing}px`,
				lineHeight: `${virtualHeight}px`,
				paddingLeft: `${spacing}px`,
				//- Colors
				...(halfPattern
					? {
							background: `linear-gradient(to ${match(halfPattern)
								.with("tl", () => "top left")
								.with("tr", () => "top right")
								.with("bl", () => "bottom left")
								.with("br", () => "bottom right")
								.exhaustive()}, ${routeNumber.backgroundColor ?? paneBgColor} 50%, ${paneBgColor} 50%)`,
						}
					: { backgroundColor: routeNumber.backgroundColor ?? paneBgColor }),
				color: routeNumber.textColor ?? ledColors[ledColor],
				//- Outline (if applicable)
				...(routeNumber.outlineColor
					? {
							textShadow: `
                ${onePixel}px 0px 0 ${routeNumber.outlineColor},
                -${onePixel}px 0px 0 ${routeNumber.outlineColor},
                0px ${onePixel}px 0 ${routeNumber.outlineColor},
                0px -${onePixel}px 0 ${routeNumber.outlineColor}`,
						}
					: {}),
			}}
		>
			<ScrollingText
				onePixel={onePixel}
				scroll={routeNumber.scroll}
				speedRatio={routeNumberSpeedRatio}
				text={routeNumber.text}
			/>
		</button>
	);
}

// ---

type PagesProps = {
	dimensions: GirouetteDimensions;
	ledColor: LedColor;
	pages: PagesData[];
	width: number;
};

function Pages({ dimensions, ledColor, pages, width }: Readonly<PagesProps>) {
	const [currentPageIndex, setCurrentPageIndex] = useState(0);

	// Scrolling durations of the lines of the displayed page, keyed by line index.
	const [scrollDurations, setScrollDurations] = useState<Record<number, number>>({});
	const handleDurationChange = useCallback((lineIndex: number, duration: number) => {
		setScrollDurations((current) =>
			current[lineIndex] === duration ? current : { ...current, [lineIndex]: duration },
		);
	}, []);

	const pageIndex = pages.length > 0 ? currentPageIndex % pages.length : 0;
	const activePage = pages[pageIndex];
	const lines = activePage === undefined ? [] : Array.isArray(activePage) ? activePage : [activePage];

	// A page is displayed at least until its slowest line has scrolled entirely once.
	const pageDuration = Math.max(staticPageDuration, ...lines.map((_, lineIndex) => scrollDurations[lineIndex] ?? 0));

	useEffect(() => {
		if (pages.length <= 1) return;
		const timeout = setTimeout(() => setCurrentPageIndex(pageIndex + 1), pageDuration);
		return () => clearTimeout(timeout);
	}, [pageDuration, pageIndex, pages.length]);

	if (activePage === undefined) return null;

	const oneLine = lines.length === 1;

	const height = (dimensions.height * width) / (dimensions.rnWidth + dimensions.destinationWidth);
	const onePixel = width / (dimensions.rnWidth + dimensions.destinationWidth);

	return (
		<div
			className="flex flex-col items-center overflow-hidden"
			style={{
				color: ledColors[ledColor],
				width: `${onePixel * dimensions.destinationWidth}px`,
				//- Lines alignment
				justifyContent: lines.length === 1 ? "center" : "space-between",
			}}
		>
			{lines.filter(Boolean).map((line, lineIndex) => {
				const fontFamily =
					line.font !== undefined && line.font in fontProperties ? line.font : oneLine ? "1513B3E1" : "0808B2E1";
				const spacing = onePixel * (line.spacing ?? fontProperties[fontFamily].spacing);
				const virtualHeight = (height / dimensions.height) * fontProperties[fontFamily].height;
				return (
					<ScrollingText
						className="overflow-hidden whitespace-nowrap"
						// Remounting on page change restarts the scrolling animation from its beginning.
						// biome-ignore lint/suspicious/noArrayIndexKey: safe here
						key={`${pageIndex}-${lineIndex}`}
						onDurationChange={(duration) => handleDurationChange(lineIndex, duration)}
						onePixel={onePixel}
						scroll={line.scroll}
						text={line.text}
						style={{
							//- Font, placement & spacing
							fontFamily: `"${fontFamily}"`,
							fontSize: `${virtualHeight}px`,
							letterSpacing: `${spacing}px`,
							lineHeight: `${virtualHeight}px`,
							paddingLeft: `${spacing}px`,
						}}
					/>
				);
			})}
		</div>
	);
}
