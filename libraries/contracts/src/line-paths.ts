export type LinePath = {
	segments: [number, number][][];
};

export type EncodedLinePath = {
	v: 1;
	segments: string[];
};

const PRECISION = 100000;

function encodeSigned(value: number) {
	let current = value < 0 ? ~(value << 1) : value << 1;
	let output = "";

	while (current >= 0x20) {
		output += String.fromCharCode((0x20 | (current & 0x1f)) + 63);
		current >>= 5;
	}

	return output + String.fromCharCode(current + 63);
}

function decodeSigned(value: number) {
	return value & 1 ? ~(value >> 1) : value >> 1;
}

export function encodeLinePath(linePath: LinePath): EncodedLinePath {
	return {
		v: 1,
		segments: linePath.segments.map((segment) => {
			let previousLat = 0;
			let previousLon = 0;
			let output = "";

			for (const [lat, lon] of segment) {
				const currentLat = Math.round(lat * PRECISION);
				const currentLon = Math.round(lon * PRECISION);

				output += encodeSigned(currentLat - previousLat);
				output += encodeSigned(currentLon - previousLon);

				previousLat = currentLat;
				previousLon = currentLon;
			}

			return output;
		}),
	};
}

export function decodeLinePath(encodedLinePath: EncodedLinePath): LinePath {
	return {
		segments: encodedLinePath.segments.flatMap((segment) => {
			const points: [number, number][] = [];
			let previousLat = 0;
			let previousLon = 0;
			let index = 0;

			while (index < segment.length) {
				let result = 0;
				let shift = 0;
				let byte = 0;

				do {
					byte = segment.charCodeAt(index++) - 63;
					result |= (byte & 0x1f) << shift;
					shift += 5;
				} while (byte >= 0x20);

				previousLat += decodeSigned(result);

				result = 0;
				shift = 0;

				do {
					byte = segment.charCodeAt(index++) - 63;
					result |= (byte & 0x1f) << shift;
					shift += 5;
				} while (byte >= 0x20);

				previousLon += decodeSigned(result);
				points.push([previousLat / PRECISION, previousLon / PRECISION]);
			}

			return points.length >= 2 ? [points] : [];
		}),
	};
}
