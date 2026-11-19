import clsx from "clsx";
import { LoaderCircleIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverDescription, PopoverTitle } from "~/components/ui/popover";
import { usePortalProps } from "~/hooks/use-portal-container";
import * as m from "~/paraglide/messages";

type PopoverContentProps = ComponentProps<typeof PopoverContent>;

export type Highlightable = Element | { getBoundingClientRect: () => DOMRect; borderRadius?: string };

const isAvailable = (target: Highlightable) => !(target instanceof Element) || target.isConnected;

const radiusOf = (target: Highlightable) =>
	target instanceof Element ? getComputedStyle(target).borderRadius : (target.borderRadius ?? "0px");

export type TourStep = {
	id: string;
	anchor: NonNullable<PopoverContentProps["anchor"]>;
	side: PopoverContentProps["side"];
	align: PopoverContentProps["align"];
	title: string;
	body: ReactNode;
	content?: ReactNode;
	finalAction?: "done" | "later";
	choice?: { accept: string; decline: string };
	group?: string;
	transient?: boolean;
	highlight?: Highlightable;
	spotlight?: Highlightable;
};

export type TourOutcome = "completed" | "skipped_at_start" | "skipped_midway";

export const skippedOutcome = (index: number): TourOutcome => (index === 0 ? "skipped_at_start" : "skipped_midway");

function useEveryFrame(callback: () => void) {
	const callbackRef = useRef(callback);
	useLayoutEffect(() => {
		callbackRef.current = callback;
	});

	useEffect(() => {
		let frame = 0;
		const tick = () => {
			callbackRef.current();
			frame = requestAnimationFrame(tick);
		};
		tick();
		return () => cancelAnimationFrame(frame);
	}, []);
}

function placeAt(element: HTMLElement, rect: DOMRect, origin = { left: 0, top: 0 }) {
	element.style.left = `${rect.left - origin.left}px`;
	element.style.top = `${rect.top - origin.top}px`;
	element.style.width = `${rect.width}px`;
	element.style.height = `${rect.height}px`;
}

function HighlightRing({ target }: Readonly<{ target: Highlightable }>) {
	const { container } = usePortalProps();
	const ringRef = useRef<HTMLDivElement>(null);

	useEveryFrame(() => {
		const ring = ringRef.current;
		if (ring === null) return;
		placeAt(ring, target.getBoundingClientRect());
		ring.style.borderRadius = radiusOf(target);
	});

	return createPortal(
		<div aria-hidden className="onboarding-ring pointer-events-none fixed top-0 left-0 z-40" ref={ringRef} />,
		container ?? document.body,
	);
}

function Backdrop({ bounds, target }: Readonly<{ bounds: Element; target: Highlightable | undefined }>) {
	const { container } = usePortalProps();
	const veilRef = useRef<HTMLDivElement>(null);
	const holeRef = useRef<HTMLDivElement>(null);

	useEveryFrame(() => {
		const veil = veilRef.current;
		const hole = holeRef.current;
		if (veil === null || hole === null) return;

		const boundsRect = bounds.getBoundingClientRect();
		placeAt(veil, boundsRect);

		if (target !== undefined && isAvailable(target)) {
			placeAt(hole, target.getBoundingClientRect(), boundsRect);
			hole.style.borderRadius = radiusOf(target);
		} else {
			const center = new DOMRect(boundsRect.left + boundsRect.width / 2, boundsRect.top + boundsRect.height / 2, 0, 0);
			placeAt(hole, center, boundsRect);
		}
	});

	return createPortal(
		<div aria-hidden className="onboarding-backdrop fixed top-0 left-0 z-30 touch-none overflow-hidden" ref={veilRef}>
			<div className="absolute top-0 left-0 shadow-[0_0_0_100vmax_rgb(0_0_0/0.5)]" ref={holeRef} />
		</div>,
		container ?? document.body,
	);
}

type TourProps = {
	backdrop?: Element;
	busy?: boolean;
	doneLabel?: string;
	index: number;
	steps: TourStep[];
	onDecline?: () => void;
	onNext: () => void;
	onSkip: () => void;
};

export function Tour({ backdrop, busy, doneLabel, index, steps, onDecline, onNext, onSkip }: Readonly<TourProps>) {
	const nextButtonRef = useRef<HTMLButtonElement>(null);
	const step = steps[index];

	if (step === undefined) return null;

	const isLast = index === steps.length - 1;
	const highlight = step.highlight ?? (step.anchor instanceof Element ? step.anchor : undefined);
	const concealed = busy === true && step.transient === true;

	return (
		<>
			{backdrop !== undefined && <Backdrop bounds={backdrop} target={step.spotlight ?? highlight} />}
			{highlight !== undefined && !concealed && <HighlightRing target={highlight} />}
			<Popover
				key={step.id}
				open
				onOpenChange={(open, details) => {
					if (!open && details.reason === "escape-key") onSkip();
				}}
			>
				<PopoverContent
					align={step.align}
					anchor={step.anchor}
					className="w-96 max-w-[calc(var(--available-width)-1rem)] data-concealed:invisible data-concealed:transition-none gap-3 p-5 font-sans sm:w-md sm:gap-4 sm:p-6 sm:text-base"
					data-concealed={concealed || undefined}
					finalFocus={false}
					initialFocus={nextButtonRef}
					side={step.side}
					sideOffset={10}
				>
					<div className="flex flex-col gap-1">
						<PopoverTitle className="text-base font-semibold sm:text-lg">{step.title}</PopoverTitle>
						<PopoverDescription className="leading-snug">{step.body}</PopoverDescription>
						<span className="sr-only">{m.onboarding_progress({ current: index + 1, total: steps.length })}</span>
					</div>
					{step.content}
					<div className="flex items-center gap-2">
						<div aria-hidden className="flex flex-1 gap-1">
							{steps.length > 1 &&
								steps.map(({ id }, dotIndex) => (
									<span
										key={id}
										className={clsx(
											"h-1.5 rounded-full transition-all",
											dotIndex === index ? "w-4 bg-branding" : "w-1.5 bg-muted-foreground/30",
										)}
									/>
								))}
						</div>
						{step.choice !== undefined && (
							<Button disabled={busy} size="sm" variant="ghost" onClick={onDecline}>
								{step.choice.decline}
							</Button>
						)}
						{!isLast && step.finalAction !== "later" && step.choice === undefined && (
							<Button disabled={busy} size="sm" variant="ghost" onClick={onSkip}>
								{m.onboarding_skip()}
							</Button>
						)}
						{step.choice !== undefined ? (
							<Button disabled={busy} ref={nextButtonRef} size="sm" variant="branding-default" onClick={onNext}>
								{busy && <LoaderCircleIcon className="animate-spin" />}
								{step.choice.accept}
							</Button>
						) : step.finalAction === "later" ? (
							<Button ref={nextButtonRef} size="sm" variant="ghost" onClick={onNext}>
								{m.onboarding_later()}
							</Button>
						) : (
							<Button disabled={busy} ref={nextButtonRef} size="sm" variant="branding-default" onClick={onNext}>
								{busy && <LoaderCircleIcon className="animate-spin" />}
								{isLast ? (doneLabel ?? m.onboarding_done()) : m.onboarding_next()}
							</Button>
						)}
					</div>
				</PopoverContent>
			</Popover>
		</>
	);
}
