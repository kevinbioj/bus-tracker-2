/**
 * Triangle d'avertissement plein, le point d'exclamation évidé dans la couleur du fond. Lucide ne
 * dessine ses pictogrammes qu'au trait : remplir le sien y noierait le point d'exclamation.
 */
export function TriangleAlertFilledIcon({ className, size = 24 }: Readonly<{ className?: string; size?: number }>) {
	return (
		<svg
			aria-hidden
			className={className}
			fill="none"
			height={size}
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2}
			viewBox="0 0 24 24"
			width={size}
			xmlns="http://www.w3.org/2000/svg"
		>
			<path
				d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"
				fill="currentColor"
				stroke="currentColor"
			/>
			<path className="stroke-background" d="M12 9v4" strokeWidth={2.5} />
			<path className="stroke-background" d="M12 17h.01" strokeWidth={2.5} />
		</svg>
	);
}
