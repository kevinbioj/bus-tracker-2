import { useLayoutEffect, useRef } from "react";

/**
 * Ramène un texte qui passe à la ligne à la largeur de sa plus longue ligne : un bloc qui passe à la
 * ligne occupe sinon toute la place disponible, et ce qui le suit est rejeté au bout de son conteneur.
 */
export function useFitToLines<T extends HTMLElement>(text: string) {
	const ref = useRef<T>(null);

	useLayoutEffect(() => {
		const element = ref.current;
		const container = element?.parentElement;
		if (!element || !container) return;

		const fit = () => {
			element.style.width = "";
			const bottom = element.getBoundingClientRect().bottom;
			const range = document.createRange();
			range.selectNodeContents(element);
			// Les lignes masquées par `line-clamp` restent mises en page sous le bloc : elles sont ignorées.
			const rects = Array.from(range.getClientRects()).filter((rect) => rect.top < bottom);
			if (rects.length < 2) return;
			const left = Math.min(...rects.map((rect) => rect.left));
			const right = Math.max(...rects.map((rect) => rect.right));
			element.style.width = `${Math.ceil(right - left)}px`;
		};

		fit();
		const observer = new ResizeObserver(fit);
		observer.observe(container);
		return () => observer.disconnect();
	}, [text]);

	return ref;
}
