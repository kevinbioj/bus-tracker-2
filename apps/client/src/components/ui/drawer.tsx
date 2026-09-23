import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";

import { cn } from "~/utils/cn";

export function Drawer({ ...props }: DrawerPrimitive.Root.Props) {
	return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}

export function DrawerTrigger({ ...props }: DrawerPrimitive.Trigger.Props) {
	return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

export function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
	return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

export function DrawerPortal({ ...props }: DrawerPrimitive.Portal.Props) {
	return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

export function DrawerOverlay({ className, ...props }: DrawerPrimitive.Backdrop.Props) {
	return (
		<DrawerPrimitive.Backdrop
			data-slot="drawer-overlay"
			className={cn(
				"fixed inset-0 z-50 bg-black/10 opacity-[calc(1-var(--drawer-swipe-progress,0))] transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 data-swiping:duration-0 supports-backdrop-filter:backdrop-blur-xs",
				className,
			)}
			{...props}
		/>
	);
}

export function DrawerContent({
	className,
	children,
	showOverlay = true,
	...props
}: DrawerPrimitive.Popup.Props & {
	/** À désactiver pour un drawer non modal, qui laisse la page derrière lui utilisable. */
	showOverlay?: boolean;
}) {
	return (
		<DrawerPortal>
			{showOverlay && <DrawerOverlay />}
			<DrawerPrimitive.Viewport
				data-slot="drawer-viewport"
				className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center"
			>
				<DrawerPrimitive.Popup
					data-slot="drawer-content"
					className={cn(
						"pointer-events-auto flex max-h-[85dvh] w-full flex-col rounded-t-xl border-t bg-popover bg-clip-padding pb-[env(safe-area-inset-bottom)] text-sm text-popover-foreground shadow-lg outline-none",
						"translate-y-[calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y,0px))] transition-transform duration-200 ease-out data-ending-style:translate-y-full data-starting-style:translate-y-full data-swiping:duration-0 data-swiping:select-none",
						className,
					)}
					{...props}
				>
					<div aria-hidden className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-muted" />
					{children}
				</DrawerPrimitive.Popup>
			</DrawerPrimitive.Viewport>
		</DrawerPortal>
	);
}

export function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="drawer-header" className={cn("flex flex-col gap-0.5 p-4", className)} {...props} />;
}

export function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
	return <div data-slot="drawer-footer" className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />;
}

export function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
	return (
		<DrawerPrimitive.Title
			data-slot="drawer-title"
			className={cn("cn-font-heading text-base font-medium text-foreground", className)}
			{...props}
		/>
	);
}

export function DrawerDescription({ className, ...props }: DrawerPrimitive.Description.Props) {
	return (
		<DrawerPrimitive.Description
			data-slot="drawer-description"
			className={cn("text-sm text-muted-foreground", className)}
			{...props}
		/>
	);
}
