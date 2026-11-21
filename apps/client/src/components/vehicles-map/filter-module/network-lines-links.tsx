import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useLayoutEffect, useRef, useState } from "react";

import { GetNetworkQuery, type Line, type Network } from "~/api/networks";
import * as m from "~/paraglide/messages";
import { cn } from "~/utils/cn";
import { DEFAULT_LINE_COLOR, DEFAULT_LINE_TEXT_COLOR } from "~/utils/line-colors";
import { getNetworkLabel, isActiveLine } from "~/utils/network-seo";

export function useNetworkActiveLines(network?: Network) {
	const { data } = useQuery(GetNetworkQuery(network?.id, true));
	return network !== undefined && data?.id === network.id ? data.lines.filter(isActiveLine) : [];
}

type NetworkLinesPanelProps = {
	id: string;
	open: boolean;
	network: Network;
	lines: Line[];
	currentLineId?: number;
	onNavigate: () => void;
};

export function NetworkLinesPanel({
	id,
	open,
	network,
	lines,
	currentLineId,
	onNavigate,
}: Readonly<NetworkLinesPanelProps>) {
	const listRef = useRef<HTMLUListElement>(null);
	const [textSpans, setTextSpans] = useState<Map<number, number>>(new Map());

	useLayoutEffect(() => {
		const list = listRef.current;
		if (!open || list === null) return;

		const style = getComputedStyle(list);
		const columns = style.gridTemplateColumns.split(" ");
		const columnWidth = Number.parseFloat(columns[0]);
		const gap = Number.parseFloat(style.columnGap) || 0;
		if (!(columnWidth > 0)) return;

		const spans = new Map<number, number>();
		for (const line of lines) {
			const text = list.querySelector<HTMLElement>(`[data-line-text="${line.id}"]`);
			const link = text?.parentElement;
			if (!text || !link) continue;
			const linkStyle = getComputedStyle(link);
			const requiredWidth =
				text.scrollWidth +
				Number.parseFloat(linkStyle.paddingLeft) +
				Number.parseFloat(linkStyle.paddingRight) +
				Number.parseFloat(linkStyle.borderLeftWidth) +
				Number.parseFloat(linkStyle.borderRightWidth);
			const span = Math.min(columns.length, Math.ceil((requiredWidth + gap) / (columnWidth + gap)));
			spans.set(line.id, span);
		}
		setTextSpans((current) =>
			current.size === spans.size && Array.from(spans).every(([id, span]) => current.get(id) === span)
				? current
				: spans,
		);
	}, [open, lines]);

	return (
		<nav
			aria-label={getNetworkLabel(network)}
			className={cn(
				"absolute top-full left-0 z-10 mt-2 max-h-[50dvh] w-64 max-w-[50vw] overflow-y-auto rounded-lg bg-card p-1.5 text-card-foreground shadow-md ring-2 ring-card",
				!open && "hidden",
			)}
			id={id}
		>
			{currentLineId !== undefined && (
				<Link
					className="mb-2 ml-0.5 block w- text-sm text-branding underline-offset-2 hover:underline dark:text-branding-foreground"
					onClick={onNavigate}
					search={{ "network-id": network.id }}
					to="/"
				>
					{m.map_filter_whole_network()}
				</Link>
			)}
			<ul className="grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1" ref={listRef}>
				{lines.map((line) => (
					<LineChip
						active={line.id === currentLineId}
						key={line.id}
						line={line}
						onNavigate={onNavigate}
						textSpan={textSpans.get(line.id) ?? 1}
					/>
				))}
			</ul>
		</nav>
	);
}

function cartridgeColumnSpan(aspectRatio: number) {
	if (aspectRatio <= 1.5) return 1;
	if (aspectRatio <= 3.2) return 2;
	return 3;
}

type LineChipProps = {
	line: Line;
	active: boolean;
	onNavigate: () => void;
	textSpan: number;
};

function LineChip({ line, active, onNavigate, textSpan }: Readonly<LineChipProps>) {
	const [cartridgeSpan, setCartridgeSpan] = useState(1);
	const lineLabel = line.girouetteNumber ? line.number : m.network_lines_label({ lineNumber: line.number });
	const span = line.cartridgeHref === null ? textSpan : cartridgeSpan;

	return (
		<li className="min-w-0" style={{ gridColumn: `span ${span} / span ${span}` }}>
			<Link
				aria-current={active ? "page" : undefined}
				className={cn(
					"flex h-7 w-full items-center justify-center rounded-md border border-black/10 text-sm font-bold transition outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-branding/60 aria-[current=page]:ring-2 aria-[current=page]:ring-branding aria-[current=page]:ring-offset-1 aria-[current=page]:ring-offset-card dark:border-white/10",
					line.cartridgeHref === null ? "px-1" : "px-px",
				)}
				onClick={onNavigate}
				search={{ "line-id": line.id }}
				style={{
					backgroundColor: line.color ?? DEFAULT_LINE_COLOR,
					color: line.textColor ?? DEFAULT_LINE_TEXT_COLOR,
				}}
				title={lineLabel}
				to="/"
			>
				{line.cartridgeHref === null ? (
					<>
						<span aria-hidden="true" className="truncate" data-line-text={line.id}>
							{line.number}
						</span>
						<span className="sr-only">{lineLabel}</span>
					</>
				) : (
					<img
						alt={lineLabel}
						className="h-full max-w-full object-contain"
						onLoad={({ currentTarget }) =>
							setCartridgeSpan(cartridgeColumnSpan(currentTarget.naturalWidth / currentTarget.naturalHeight))
						}
						src={line.cartridgeHref}
					/>
				)}
			</Link>
		</li>
	);
}
