import { type ComponentPropsWithRef, cloneElement, type ReactElement, type ReactNode } from "react";

import { cn } from "~/utils/cn";

type RenderableChip = ReactElement<Record<string, unknown> & { children?: ReactNode; className?: string }>;

type InformationChipProps = Omit<ComponentPropsWithRef<"button">, "children"> & {
	/** Omise, la puce se réduit à son libellé. */
	icon?: ReactNode;
	/** Omis, la puce se réduit à son icône. */
	label?: string;
	/** Rend la puce à partir de cet élément — un lien, par exemple — plutôt qu'en `<button>`. */
	render?: RenderableChip;
	/** `md` pour les puces hors de la ligne d'informations, où la place ne manque pas. */
	size?: "sm" | "md";
};

const chipClasses =
	"h-5 flex items-center gap-1 rounded-sm px-1 py-0.5 text-[11px] font-semibold leading-none whitespace-nowrap select-none";

const mediumChipClasses = "h-6 gap-1.5 rounded-md px-1.5 text-[13px]";

const iconClasses = { sm: "size-3.5", md: "size-4" } as const;

const interactiveChipClasses =
	"cursor-pointer transition-[filter,box-shadow] hover:brightness-90 dark:hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40";

/**
 * Puce d'information de la pop-up véhicule : l'icône seule était sujette à interprétation, on
 * l'accompagne donc de son libellé sur un fond de la couleur qui portait jusqu'ici le sens.
 * Les propriétés non reconnues sont transmises à l'élément rendu, afin que la puce puisse servir
 * de déclencheur à une info-bulle ou à une fenêtre.
 */
export function InformationChip({
	className,
	icon,
	label,
	onClick,
	render,
	size = "sm",
	...props
}: Readonly<InformationChipProps>) {
	const content = (
		<>
			{icon !== undefined && icon !== null && (
				<span className={cn("inline-flex shrink-0 items-center justify-center", iconClasses[size])} aria-hidden="true">
					{icon}
				</span>
			)}
			{label}
		</>
	);

	if (render !== undefined) {
		return cloneElement(render, {
			...props,
			...render.props,
			children: content,
			className: cn(
				chipClasses,
				size === "md" && mediumChipClasses,
				interactiveChipClasses,
				className,
				render.props.className,
			),
			onClick,
		});
	}

	// Sans interaction, la puce est purement informative et rendue comme telle.
	if (onClick === undefined) {
		return (
			<span
				className={cn(chipClasses, size === "md" && mediumChipClasses, className)}
				{...(props as ComponentPropsWithRef<"span">)}
			>
				{content}
			</span>
		);
	}

	return (
		<button
			className={cn(chipClasses, size === "md" && mediumChipClasses, interactiveChipClasses, className)}
			onClick={onClick}
			type="button"
			{...props}
		>
			{content}
		</button>
	);
}
