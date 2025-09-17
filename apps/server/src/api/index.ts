import { Hono } from "hono";

import networkController from "./networks/networks.controller.js";
import regionController from "./regions/regions.controller.js";

const api = new Hono();
export default api;

api.route("/networks", networkController);
api.route("/regions", regionController);
