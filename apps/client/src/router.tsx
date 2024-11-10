import { Outlet, createBrowserRouter } from "react-router-dom";
import { NavigationBar } from "~/layout/navigation-bar.js";
import MapPage from "./pages/map/page.js";

export const router = createBrowserRouter([
	{
		element: (
			<>
				<NavigationBar />
				<Outlet />
			</>
		),
		children: [
			{
				path: "/",
				element: <MapPage />,
			},
		],
	},
]);
