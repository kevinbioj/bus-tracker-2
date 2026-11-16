import type { ReactNode } from "react";

import { DataPageHeader, type DataPageHeaderProps } from "./data-page-header";

type DataPageLayoutProps = DataPageHeaderProps & {
	children: ReactNode;
	description?: string;
	title: string;
};

export function DataPageLayout({ children, description, title, ...header }: Readonly<DataPageLayoutProps>) {
	return (
		<>
			<title>{title}</title>
			{description !== undefined && <meta content={description} name="description" />}
			<main className="mx-auto w-full max-w-(--breakpoint-xl) p-3">
				<DataPageHeader {...header} />
				{children}
			</main>
		</>
	);
}
