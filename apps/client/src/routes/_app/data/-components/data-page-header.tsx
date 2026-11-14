import { ArrowLeftIcon, type LucideIcon } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import { Button } from "~/components/ui/button";

export type DataPageHeaderProps = {
	back: { label: string; link: ReactElement };
	media?: ReactNode;
	heading: ReactNode;
	subtitle?: ReactNode;
	actions?: ReactNode;
};

export function DataPageHeader({ back, media, heading, subtitle, actions }: Readonly<DataPageHeaderProps>) {
	return (
		<header className="mb-3 flex items-center gap-2 sm:gap-3">
			<Button
				aria-label={back.label}
				nativeButton={false}
				render={back.link}
				size="icon"
				title={back.label}
				variant="outline"
			>
				<ArrowLeftIcon className="size-4" />
			</Button>
			{media}
			<div className="grid min-w-0 flex-1 gap-0.5">
				<h1 className="line-clamp-2 text-lg leading-tight font-bold sm:text-2xl">{heading}</h1>
				{subtitle !== undefined && subtitle !== null && (
					<p className="truncate text-sm leading-tight text-muted-foreground">{subtitle}</p>
				)}
			</div>
			{actions !== undefined && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
		</header>
	);
}

type DataPageActionProps = {
	icon: LucideIcon;
	label: string;
	link: ReactElement;
};

export function DataPageAction({ icon: Icon, label, link }: Readonly<DataPageActionProps>) {
	return (
		<Button
			aria-label={label}
			className="size-8 px-0 sm:w-auto sm:px-2.5"
			nativeButton={false}
			render={link}
			title={label}
			variant="outline"
		>
			<Icon className="size-4" />
			<span className="hidden sm:inline">{label}</span>
		</Button>
	);
}

export const subtitleLinkClassName = "underline-offset-2 transition-colors hover:text-foreground hover:underline";
