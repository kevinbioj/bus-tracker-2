import { type RefObject, useEffect, useState } from "react";

export function useDomVisibility<T extends HTMLElement>(elementRef: RefObject<T | null>) {
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		if (elementRef.current === null) return;

		const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));

		observer.observe(elementRef.current);
		return () => observer.disconnect();
	}, [elementRef]);

	return visible;
}
