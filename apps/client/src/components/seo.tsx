export function Canonical({ path }: Readonly<{ path: string }>) {
	return <link href={new URL(path, location.origin).href} rel="canonical" />;
}

export function NoIndex() {
	return <meta content="noindex" name="robots" />;
}
