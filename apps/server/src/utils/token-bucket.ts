export function createTokenBucket(capacity: number, refillPerSecond: number) {
	let tokens = capacity;
	let updatedAt = performance.now();

	return {
		take() {
			const now = performance.now();
			tokens = Math.min(capacity, tokens + ((now - updatedAt) / 1000) * refillPerSecond);
			updatedAt = now;
			if (tokens < 1) return false;
			tokens -= 1;
			return true;
		},
	};
}
