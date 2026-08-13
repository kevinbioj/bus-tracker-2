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
 * Blinking cycle of a flashing text. The share of it the text stays displayed
 * is carried by the keyframes, so only the total is expressed here.
 */
const flashAnimation = "girouette-flash 1.25s steps(1, end) infinite";

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
	flash?: boolean;
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
	flash?: boolean;
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
		/**
		 * Displays that page instead of cycling through them automatically. The
		 * index is wrapped around the number of pages, so it may grow indefinitely.
		 */
		pageIndex?: number;
		/** Notified with the index of the displayed page, whether it changed on its own or not. */
		onPageIndexChange?: (pageIndex: number) => void;
		width: number;
	};

export function Girouette({
	className,
	dimensions = defaultDimensions,
	ledColor = "WHITE",
	onPageIndexChange,
	onRouteNumberClick,
	pageIndex,
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
			<Pages
				controlledPageIndex={pageIndex}
				dimensions={dimensions}
				ledColor={ledColor}
				onPageIndexChange={onPageIndexChange}
				pages={pages}
				width={width}
			/>
		</div>
	);
}

// ---

type ScrollingTextProps = {
	className?: string;
	/** Blinks the text on and off, independently of its scrolling. */
	flash?: boolean;
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
	flash,
	onDurationChange,
	onePixel,
	scroll,
	speedRatio = 1,
	style,
	text,
}: Readonly<ScrollingTextProps>) {
	const ref = useRef<HTMLSpanElement>(null);
	const [metrics, setMetrics] = useState<{ from: number; to: number }>();

	useLayoutEffect(() => {
		const element = ref.current;
		const container = element?.parentElement;
		if (!scroll || element == null || container == null) {
			setMetrics(undefined);
			return;
		}

		// Observing both the text and its container covers every change that
		// affects the travelled distance: text, font size, spacing, girouette
		// width, and the asynchronous loading of the LED fonts.
		const observer = new ResizeObserver(() => {
			const { paddingLeft } = getComputedStyle(container);
			// The text lays out at the left edge of the content box: offsetting it
			// by the padding gives the distances to the visible edges of the pane.
			const leftPadding = Number.parseFloat(paddingLeft) || 0;
			const from = container.clientWidth - leftPadding;
			const to = -(element.scrollWidth + leftPadding);
			setMetrics((current) => (current?.from === from && current.to === to ? current : { from, to }));
		});

		observer.observe(element);
		observer.observe(container);

		return () => observer.disconnect();
	}, [scroll]);

	const duration =
		metrics !== undefined && onePixel > 0 && speedRatio > 0
			? (metrics.from - metrics.to) / (scrollSpeed * speedRatio * onePixel)
			: 0;

	useEffect(() => {
		onDurationChange?.(duration * 1000);
	}, [duration, onDurationChange]);

	const html = { __html: processText(text) };

	// Blinking is carried by the outer element in both cases, so that it composes
	// with the scrolling animation rather than replacing it.
	const flashStyle: CSSProperties | undefined = flash ? { ...style, animation: flashAnimation } : style;

	// A text that doesn't scroll is left to the centering of its parent, which
	// also keeps an overflowing one centered on the pane.
	if (!scroll) {
		return (
			// biome-ignore lint/security/noDangerouslySetInnerHtml: HTML-escaped by processText, only <br> tags are injected
			<span className={className} dangerouslySetInnerHTML={html} style={flashStyle} />
		);
	}

	// A scrolling text, on the other hand, is wrapped in a full-width block so
	// that the centering of the parent (`justify-center` or `items-center`) never
	// shifts it: `margin: auto` doesn't cancel that centering once the text
	// overflows, as the free space is then negative.
	return (
		<span className={cn("block w-full", className)} style={flashStyle}>
			<span
				className="inline-block"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: HTML-escaped by processText, only <br> tags are injected
				dangerouslySetInnerHTML={html}
				ref={ref}
				style={
					duration > 0 && metrics !== undefined
						? ({
								animation: `girouette-scroll ${duration}s linear infinite`,
								"--scroll-from": `${metrics.from}px`,
								"--scroll-to": `${metrics.to}px`,
							} as CSSProperties)
						: undefined
				}
			/>
		</span>
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
				flash={routeNumber.flash}
				onePixel={onePixel}
				scroll={routeNumber.scroll}
				speedRatio={routeNumberSpeedRatio}
				// Carried by the text wrapper rather than the pane so that the scrolling
				// distances, which are measured against it, stay exact.
				style={{ paddingLeft: `${spacing}px` }}
				text={routeNumber.text}
			/>
		</button>
	);
}

// ---

type PagesProps = {
	/** When set, that page is displayed and the automatic cycling is suspended. */
	controlledPageIndex?: number;
	dimensions: GirouetteDimensions;
	ledColor: LedColor;
	onPageIndexChange?: (pageIndex: number) => void;
	pages: PagesData[];
	width: number;
};

function Pages({ controlledPageIndex, dimensions, ledColor, onPageIndexChange, pages, width }: Readonly<PagesProps>) {
	const [currentPageIndex, setCurrentPageIndex] = useState(0);

	// Scrolling durations of the lines of the displayed page, keyed by line index.
	const [scrollDurations, setScrollDurations] = useState<Record<number, number>>({});
	const handleDurationChange = useCallback((lineIndex: number, duration: number) => {
		setScrollDurations((current) =>
			current[lineIndex] === duration ? current : { ...current, [lineIndex]: duration },
		);
	}, []);

	const isControlled = controlledPageIndex !== undefined;
	// The modulo is normalized so that a controlled index walking backwards past
	// the first page wraps around to the last one.
	const pageIndex =
		pages.length > 0
			? (((isControlled ? controlledPageIndex : currentPageIndex) % pages.length) + pages.length) % pages.length
			: 0;
	const activePage = pages[pageIndex];
	const lines = activePage === undefined ? [] : Array.isArray(activePage) ? activePage : [activePage];

	// A page is displayed at least until its slowest line has scrolled entirely once.
	const pageDuration = Math.max(staticPageDuration, ...lines.map((_, lineIndex) => scrollDurations[lineIndex] ?? 0));

	useEffect(() => {
		onPageIndexChange?.(pageIndex);
	}, [onPageIndexChange, pageIndex]);

	useEffect(() => {
		if (isControlled || pages.length <= 1) return;
		const timeout = setTimeout(() => setCurrentPageIndex(pageIndex + 1), pageDuration);
		return () => clearTimeout(timeout);
	}, [isControlled, pageDuration, pageIndex, pages.length]);

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
						flash={line.flash}
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
