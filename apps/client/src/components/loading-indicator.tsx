import { useEffect, useRef } from "react";
import { useNavigation } from "react-router-dom";
import LoadingBar, { type LoadingBarRef } from "react-top-loading-bar";

export function LoadingIndicator() {
	const ref = useRef<LoadingBarRef>(null);
	const { state } = useNavigation();

	useEffect(() => {
		const loadingBar = ref.current;
		if (loadingBar === null) return;

		if (state === "loading" || state === "submitting") {
			loadingBar.continuousStart();
		} else {
			loadingBar.complete();
		}
	}, [state]);

	return <LoadingBar className="h-2" color="white" ref={ref} />;
}
