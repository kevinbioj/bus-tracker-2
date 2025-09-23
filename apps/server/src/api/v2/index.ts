import { Hono } from "hono";

import announcementsApp from "./announcements.js";
import linesApp from "./lines.js";
import networksApp from "./networks.js";
import regionsApp from "./regions.js";

const v2app = new Hono();
v2app.route("/announcements", announcementsApp);
v2app.route("/lines", linesApp);
v2app.route("/networks", networksApp);
v2app.route("/regions", regionsApp);

export default v2app;
