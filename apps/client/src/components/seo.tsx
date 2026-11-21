export function Canonical({ path }: Readonly<{ path: string }>) {
	return <link href={new URL(path, location.origin).href} rel="canonical" />;
}

export function NoIndex() {
	return <meta content="noindex" name="robots" />;
}

export function BreadcrumbJsonLd({ items }: Readonly<{ items: { name: string; path: string }[] }>) {
	const data = {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: items.map(({ name, path }, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name,
			item: new URL(path, location.origin).href,
		})),
	};
	return <script type="application/ld+json">{JSON.stringify(data)}</script>;
}
