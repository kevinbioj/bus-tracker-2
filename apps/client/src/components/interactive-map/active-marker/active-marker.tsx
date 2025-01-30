import { type ReactNode, createContext, useContext, useMemo, useState } from "react";

type ActiveMarkerContextProps = {
	activeMarker: string | undefined;
	setActiveMarker: (activeMarker: string | undefined) => void;
};

const ActiveMarkerContext = createContext<ActiveMarkerContextProps>({
	activeMarker: undefined,
	setActiveMarker: () => void 0,
});

type ActiveContextProviderProps = {
	children: ReactNode;
};

export function ActiveMarkerProvider({ children }: Readonly<ActiveContextProviderProps>) {
	const [activeMarker, setActiveMarker] = useState<string | undefined>();

	const value = useMemo(
		() => ({
			activeMarker,
			setActiveMarker,
		}),
		[activeMarker],
	);

	return <ActiveMarkerContext.Provider value={value}>{children}</ActiveMarkerContext.Provider>;
}

export const useActiveMarker = () => useContext(ActiveMarkerContext);
