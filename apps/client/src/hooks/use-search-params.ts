import { useLocation, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";

type Updater = URLSearchParams | Record<string, string> | ((prev: URLSearchParams) => URLSearchParams);

export function useSearchParams() {
	const search = useLocation({ select: (state) => state.searchStr });
	const navigate = useNavigate();

	const searchParams = useMemo(() => new URLSearchParams(search), [search]);

	const setSearchParams = useCallback(
		(updater: Updater) => {
			let next: URLSearchParams;
			if (typeof updater === "function") {
				next = updater(new URLSearchParams(search));
			} else if (updater instanceof URLSearchParams) {
				next = updater;
			} else {
				next = new URLSearchParams(updater);
			}
			const obj: Record<string, string> = {};
			for (const [k, v] of next.entries()) obj[k] = v;
			void navigate({ to: ".", search: obj as never, replace: false });
		},
		[navigate, search],
	);

	return [searchParams, setSearchParams] as const;
}
