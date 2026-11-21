const METERS_PER_DEGREE = 111_320;
const MAX_STEP_M = 15;
const MATCH_DISTANCE_M = 20;
const MIN_PARALLEL_COS = Math.cos((25 * Math.PI) / 180);
const MIN_RUN_LENGTH_M = 60;
const RAMP_LENGTH_M = 60;
const RAMP_STEP_M = 3;

export type BundleInput = { lineId: number; segments: [number, number][][] };

export type BundledPath = { lineId: number; coordinates: [number, number][]; offset: number };

type Polyline = {
	line: number;
	lonLat: [number, number][];
	x: Float64Array;
	y: Float64Array;
};

type SubSegmentRef = { polyline: Polyline; index: number };

function densify(points: [number, number][], toX: (lon: number) => number): [number, number][] {
	const result: [number, number][] = [];
	for (let index = 0; index < points.length; index += 1) {
		const [latitude, longitude] = points[index]!;
		if (index > 0) {
			const [previousLatitude, previousLongitude] = points[index - 1]!;
			const length = Math.hypot(
				toX(longitude) - toX(previousLongitude),
				(latitude - previousLatitude) * METERS_PER_DEGREE,
			);
			const steps = Math.ceil(length / MAX_STEP_M);
			for (let step = 1; step < steps; step += 1) {
				const t = step / steps;
				result.push([
					previousLongitude + t * (longitude - previousLongitude),
					previousLatitude + t * (latitude - previousLatitude),
				]);
			}
		}
		result.push([longitude, latitude]);
	}
	return result;
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
	const dx = bx - ax;
	const dy = by - ay;
	const lengthSquared = dx * dx + dy * dy;
	const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
	return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function toRuns(flags: boolean[], lengths: number[]) {
	const runs: { value: boolean; start: number; end: number; length: number }[] = [];
	for (let index = 0; index < flags.length; index += 1) {
		const last = runs.at(-1);
		if (last?.value === flags[index]) {
			last.end = index;
			last.length += lengths[index]!;
		} else {
			runs.push({ value: flags[index]!, start: index, end: index, length: lengths[index]! });
		}
	}
	return runs;
}

function smooth(flags: boolean[], lengths: number[]) {
	for (const value of [false, true]) {
		const runs = toRuns(flags, lengths);
		runs.forEach((run, index) => {
			if (run.value !== value || run.length >= MIN_RUN_LENGTH_M) return;
			if (index === 0 || index === runs.length - 1) return;
			flags.fill(!value, run.start, run.end + 1);
		});
	}
}

export function bundleLinePaths(inputs: BundleInput[]): BundledPath[] {
	let latitudeSum = 0;
	let pointCount = 0;
	for (const { segments } of inputs) {
		for (const segment of segments) {
			for (const [latitude] of segment) {
				latitudeSum += latitude;
				pointCount += 1;
			}
		}
	}
	if (pointCount === 0) return [];

	const cosLatitude = Math.cos(((latitudeSum / pointCount) * Math.PI) / 180);
	const toX = (longitude: number) => longitude * cosLatitude * METERS_PER_DEGREE;
	const toY = (latitude: number) => latitude * METERS_PER_DEGREE;

	const polylines: Polyline[] = [];
	inputs.forEach(({ segments }, line) => {
		for (const segment of segments) {
			if (segment.length < 2) continue;
			const lonLat = densify(segment, toX);
			polylines.push({
				line,
				lonLat,
				x: Float64Array.from(lonLat, ([longitude]) => toX(longitude)),
				y: Float64Array.from(lonLat, ([, latitude]) => toY(latitude)),
			});
		}
	});

	const grid = new Map<string, SubSegmentRef[]>();
	for (const polyline of polylines) {
		for (let index = 0; index < polyline.lonLat.length - 1; index += 1) {
			const minX = Math.floor(Math.min(polyline.x[index]!, polyline.x[index + 1]!) / MATCH_DISTANCE_M);
			const maxX = Math.floor(Math.max(polyline.x[index]!, polyline.x[index + 1]!) / MATCH_DISTANCE_M);
			const minY = Math.floor(Math.min(polyline.y[index]!, polyline.y[index + 1]!) / MATCH_DISTANCE_M);
			const maxY = Math.floor(Math.max(polyline.y[index]!, polyline.y[index + 1]!) / MATCH_DISTANCE_M);
			for (let cx = minX; cx <= maxX; cx += 1) {
				for (let cy = minY; cy <= maxY; cy += 1) {
					const key = `${cx},${cy}`;
					const cell = grid.get(key);
					if (cell === undefined) grid.set(key, [{ polyline, index }]);
					else cell.push({ polyline, index });
				}
			}
		}
	}

	const bundled: BundledPath[] = [];

	for (const polyline of polylines) {
		const count = polyline.lonLat.length - 1;
		const lengths: number[] = [];
		const directions = new Map<number, number[]>();

		for (let index = 0; index < count; index += 1) {
			const ax = polyline.x[index]!;
			const ay = polyline.y[index]!;
			const dx = polyline.x[index + 1]! - ax;
			const dy = polyline.y[index + 1]! - ay;
			const length = Math.hypot(dx, dy);
			lengths.push(length);
			if (length === 0) continue;

			const mx = ax + dx / 2;
			const my = ay + dy / 2;
			const cellX = Math.floor(mx / MATCH_DISTANCE_M);
			const cellY = Math.floor(my / MATCH_DISTANCE_M);
			for (let cx = cellX - 1; cx <= cellX + 1; cx += 1) {
				for (let cy = cellY - 1; cy <= cellY + 1; cy += 1) {
					for (const candidate of grid.get(`${cx},${cy}`) ?? []) {
						const other = candidate.polyline;
						if (other.line === polyline.line) continue;
						const bx = other.x[candidate.index]!;
						const by = other.y[candidate.index]!;
						const ex = other.x[candidate.index + 1]!;
						const ey = other.y[candidate.index + 1]!;
						const otherLength = Math.hypot(ex - bx, ey - by);
						if (otherLength === 0) continue;

						const cos = (dx * (ex - bx) + dy * (ey - by)) / (length * otherLength);
						if (Math.abs(cos) < MIN_PARALLEL_COS) continue;
						if (distanceToSegment(mx, my, bx, by, ex, ey) > MATCH_DISTANCE_M) continue;

						let signs = directions.get(other.line);
						if (signs === undefined) {
							signs = new Array<number>(count).fill(0);
							directions.set(other.line, signs);
						}
						signs[index] = cos > 0 ? 1 : -1;
					}
				}
			}
		}

		const companions = [...directions.entries()].map(([line, signs]) => {
			const flags = signs.map((sign) => sign !== 0);
			smooth(flags, lengths);
			return { line, signs, flags };
		});

		const groups = Array.from({ length: count }, (_, index) =>
			companions.filter(({ flags }) => flags[index]).map(({ line }) => line),
		);
		const keys = groups.map((group) => group.join());

		const runs: { start: number; end: number; size: number; offset: number; length: number }[] = [];
		let runStart = 0;
		for (let index = 1; index <= count; index += 1) {
			if (index < count && keys[index] === keys[runStart]) continue;

			const members = [...groups[runStart]!, polyline.line].toSorted((a, b) => a - b);
			const leader = members[0]!;
			let sign = 1;
			let length = 0;
			for (let position = runStart; position < index; position += 1) length += lengths[position]!;
			if (leader !== polyline.line) {
				const leaderSigns = companions.find(({ line }) => line === leader)!.signs;
				let sum = 0;
				for (let position = runStart; position < index; position += 1) sum += leaderSigns[position]!;
				sign = sum < 0 ? -1 : 1;
			}

			runs.push({
				start: runStart,
				end: index,
				size: members.length,
				offset: sign * (members.indexOf(polyline.line) - (members.length - 1) / 2),
				length,
			});
			runStart = index;
		}

		const offsets = new Array<number>(count);
		const ramped = new Array<boolean>(count).fill(false);
		for (const run of runs) offsets.fill(run.offset, run.start, run.end);

		for (let index = 1; index < runs.length; index += 1) {
			const before = runs[index - 1]!;
			const after = runs[index]!;
			const forward = after.size <= before.size;
			const ramp = forward ? after : before;
			const rampLength = Math.min(RAMP_LENGTH_M, ramp.length / 2);
			if (rampLength === 0) continue;

			let distance = 0;
			for (let step = 0; step < ramp.end - ramp.start; step += 1) {
				const position = forward ? ramp.start + step : ramp.end - 1 - step;
				if (distance >= rampLength) break;
				ramped[position] = true;
				distance += lengths[position]!;
			}
		}

		const offsetAt = (position: number, t: number) => {
			const run = runs.find(({ start, end }) => position >= start && position < end)!;
			const runIndex = runs.indexOf(run);
			let value = run.offset;
			let distanceFromStart = -lengths[position]! * (1 - t);
			for (let index = position; index >= run.start; index -= 1) distanceFromStart += lengths[index]!;
			const distanceToEnd = run.length - distanceFromStart;
			const previous = runs[runIndex - 1];
			const next = runs[runIndex + 1];
			if (previous !== undefined && run.size <= previous.size) {
				const rampLength = Math.min(RAMP_LENGTH_M, run.length / 2);
				if (distanceFromStart < rampLength) {
					value = previous.offset + (run.offset - previous.offset) * (distanceFromStart / rampLength);
				}
			}
			if (next !== undefined && next.size > run.size) {
				const rampLength = Math.min(RAMP_LENGTH_M, run.length / 2);
				if (distanceToEnd < rampLength) {
					value = next.offset + (value - next.offset) * (distanceToEnd / rampLength);
				}
			}
			return value;
		};

		const lineId = inputs[polyline.line]!.lineId;
		let current: BundledPath | undefined;
		const emit = (from: [number, number], to: [number, number], offset: number) => {
			if (current !== undefined && current.offset === offset) {
				current.coordinates.push(to);
				return;
			}
			current = { lineId, coordinates: [from, to], offset };
			bundled.push(current);
		};

		for (let position = 0; position < count; position += 1) {
			const [fromLongitude, fromLatitude] = polyline.lonLat[position]!;
			const [toLongitude, toLatitude] = polyline.lonLat[position + 1]!;
			if (!ramped[position]) {
				emit([fromLongitude, fromLatitude], [toLongitude, toLatitude], offsets[position]!);
				continue;
			}

			const pieces = Math.max(1, Math.ceil(lengths[position]! / RAMP_STEP_M));
			for (let piece = 0; piece < pieces; piece += 1) {
				const t0 = piece / pieces;
				const t1 = (piece + 1) / pieces;
				emit(
					[fromLongitude + t0 * (toLongitude - fromLongitude), fromLatitude + t0 * (toLatitude - fromLatitude)],
					[fromLongitude + t1 * (toLongitude - fromLongitude), fromLatitude + t1 * (toLatitude - fromLatitude)],
					Math.round(offsetAt(position, (t0 + t1) / 2) * 100) / 100,
				);
			}
		}
	}

	return bundled;
}
