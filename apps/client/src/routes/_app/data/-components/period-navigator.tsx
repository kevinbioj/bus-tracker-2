import type { ReactNode } from "react";

type PeriodNavigatorProps = {
	children: ReactNode;
	className?: string;
	next?: ReactNode;
	previous?: ReactNode;
	sticky?: boolean;
};

export function PeriodNavigator({ children, className, next, previous, sticky }: Readonly<PeriodNavigatorProps>) {
	const content = (
		<div
			className={`bg-branding text-branding-foreground grid grid-cols-[3rem_1fr_3rem] px-3 py-2 rounded-md${className ? ` ${className}` : ""}`}
		>
			{previous ?? <div />}
			<p className="font-bold my-auto text-2xl text-center">{children}</p>
			{next ?? <div />}
		</div>
	);

	if (!sticky) return content;

	return <section className="sticky top-14 z-10 bg-background pt-1 pb-1">{content}</section>;
}
