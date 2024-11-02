import { createBrowserRouter } from "react-router-dom";
import MapPage from "./pages/map/page.js";

export const router = createBrowserRouter([
	{
		path: "/",
		element: <MapPage />,
	},
]);
