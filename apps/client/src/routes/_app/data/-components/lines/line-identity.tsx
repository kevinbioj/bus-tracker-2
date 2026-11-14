import { Link } from "@tanstack/react-router";

import type { Line } from "~/api/lines";
import type { Network } from "~/api/networks";
import * as m from "~/paraglide/messages";
import { subtitleLinkClassName } from "~/routes/_app/data/-components/data-page-header";

type LineIdentity = Pick<Line, "number" | "girouetteNumber">;

export function getLineLabel(line: LineIdentity) {
	return line.girouetteNumber ? line.number : m.network_lines_label({ lineNumber: line.number });
}

type LineSubtitleProps = {
	line: LineIdentity & Pick<Line, "id">;
	network: Pick<Network, "id" | "name">;
};

export function LineSubtitle({ line, network }: Readonly<LineSubtitleProps>) {
	return (
		<>
			<Link className={subtitleLinkClassName} params={{ lineId: String(line.id) }} to="/data/lines/$lineId">
				{getLineLabel(line)}
			</Link>
			{" · "}
			<Link
				className={subtitleLinkClassName}
				params={{ networkId: String(network.id) }}
				search={{ tab: "lines" }}
				to="/data/networks/$networkId"
			>
				{network.name}
			</Link>
		</>
	);
}

type LineMediaProps = {
	line: LineIdentity & { cartridgeHref: string | null; color: string | null; textColor: string | null };
};

export function LineMedia({ line }: Readonly<LineMediaProps>) {
	if (line.cartridgeHref) {
		return (
			<span aria-hidden="true" className="flex h-10 w-16 shrink-0 items-center justify-center sm:h-12 sm:w-24">
				<img alt="" className="max-h-full max-w-full object-contain" src={line.cartridgeHref} />
			</span>
		);
	}

	return (
		<span
			aria-hidden="true"
			className="flex h-10 max-w-24 min-w-10 shrink-0 items-center justify-center rounded-md border bg-muted px-2 text-lg font-bold sm:h-12 sm:min-w-12"
			style={
				line.color
					? {
							backgroundColor: `#${line.color}`,
							borderColor: `#${line.color}`,
							color: line.textColor ? `#${line.textColor}` : undefined,
						}
					: undefined
			}
		>
			<span className="truncate">{line.girouetteNumber ?? line.number}</span>
		</span>
	);
}
