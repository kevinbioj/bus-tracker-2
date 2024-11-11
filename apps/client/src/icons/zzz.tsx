import type { ComponentPropsWithoutRef } from "react";

type ZzzProps = Omit<ComponentPropsWithoutRef<"svg">, "xmlns" | "viewBox">;

export function Zzz(props: ZzzProps) {
	return (
		<svg
			{...props}
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<title>Hors-ligne</title>
			<path stroke="none" d="M0 0h24v24H0z" fill="none" />
			<path d="M4 12h6l-6 8h6" />
			<path d="M14 4h6l-6 8h6" />
		</svg>
	);
}
