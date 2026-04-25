import { describe, expect, it } from "vitest";

import { guessStartDate } from "./guess-start-date.js";

function timeToSecs(time: string, modulus: number) {
	const [h, m, s = "0"] = time.split(":");
	return modulus * 86400 + +h! * 3600 + +m! * 60 + +s;
}

describe("guessStartDate(startSecs, at)", () => {
	const testCases = [
		{
			at: "2024-10-19T23:55:00.000[Europe/Paris]",
			startTime: "23:58",
			startModulus: 0,
			expectedDate: "2024-10-19",
		},
		{
			at: "2024-10-19T23:55:00.000[Europe/Paris]",
			startTime: "00:05",
			startModulus: 1,
			expectedDate: "2024-10-19",
		},
		{
			at: "2024-10-20T00:04:00.000[Europe/Paris]",
			startTime: "00:05",
			startModulus: 0,
			expectedDate: "2024-10-20",
		},
		{
			at: "2024-10-20T00:04:00.000[Europe/Paris]",
			startTime: "23:58",
			startModulus: 0,
			expectedDate: "2024-10-19",
		},
		{
			at: "2024-10-20T04:15:00.000[Europe/Paris]",
			startTime: "04:30",
			startModulus: 0,
			expectedDate: "2024-10-20",
		},
	];

	for (const testCase of testCases) {
		it(`should return '${testCase.expectedDate}' at '${testCase.at}' with time '${testCase.startTime}' % '${testCase.startModulus}'`, () => {
			expect(
				guessStartDate(
					timeToSecs(testCase.startTime, testCase.startModulus),
					Temporal.ZonedDateTime.from(testCase.at),
				).toString(),
			).toEqual(testCase.expectedDate);
		});
	}
});
