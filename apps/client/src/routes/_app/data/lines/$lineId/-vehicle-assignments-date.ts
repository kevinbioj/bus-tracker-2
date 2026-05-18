import dayjs from "dayjs";

import type { Line } from "~/api/lines";

export const getLineVehicleAssignmentsDate = (line: Line, date?: string) => {
	const fallback = line.latestServiceDate ?? dayjs().format("YYYY-MM-DD");
	const parsed = dayjs(date ?? fallback);

	return (parsed.isValid() ? parsed : dayjs(fallback)).format("YYYY-MM-DD");
};
