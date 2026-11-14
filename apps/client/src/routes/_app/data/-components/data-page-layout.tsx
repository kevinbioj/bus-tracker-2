import type { ReactNode } from "react";

import { DataPageHeader, type DataPageHeaderProps } from "./data-page-header";

type DataPageLayoutProps = DataPageHeaderProps & {
	children: ReactNode;
	title: string;
};

export function DataPageLayout({ children, title, ...header }: Readonly<DataPageLayoutProps>) {
	return (
		<>
			<title>{title}</title>
			<main className="mx-auto w-full max-w-(--breakpoint-xl) p-3">
				<DataPageHeader {...header} />
				{children}
			</main>
		</>
	);
}
