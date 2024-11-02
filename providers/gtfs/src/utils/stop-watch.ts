export function createStopWatch() {
	const start = Date.now();
	let step = start;
	return {
		step: () => {
			const previousStep = Date.now() - step;
			step = Date.now();
			return previousStep;
		},
		total: () => Date.now() - start,
	};
}
