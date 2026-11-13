import { describe, expect, it, vi } from "vitest";

import { Shape } from "../model/shape.js";

import { createJourneyPathPublisher } from "./publish-journey-paths.js";

function createRedis() {
	const writes: { key: string; value: string; ttl: number }[] = [];
	let failing = false;
	return {
		writes,
		fail: () => {
			failing = true;
		},
		set: async (key: string, value: string, { EX }: { EX: number }) => {
			if (failing) throw new Error("Redis indisponible");
			writes.push({ key, value, ttl: EX });
		},
	};
}

const routePath = { p: [[49.44, 1.09, 0]] };

describe("createJourneyPathPublisher", () => {
	it("écrit un tracé à sa première publication, puis plus tant qu'il ne change pas", async () => {
		const redis = createRedis();
		const publisher = createJourneyPathPublisher(900, 300_000);

		await publisher.publish(redis, { "N:RoutePath:a": routePath }, 0);
		await publisher.publish(redis, { "N:RoutePath:a": routePath }, 30_000);

		expect(redis.writes).toEqual([{ key: "N:RoutePath:a", value: JSON.stringify(routePath), ttl: 900 }]);
	});

	it("réécrit un tracé dont le contenu change, même sous le délai de rafraîchissement", async () => {
		const redis = createRedis();
		const publisher = createJourneyPathPublisher(900, 300_000);

		await publisher.publish(redis, { "N:CancelledPath:a": { segments: [[[0, 0]]] } }, 0);
		await publisher.publish(redis, { "N:CancelledPath:a": { segments: [[[1, 1]]] } }, 30_000);

		expect(redis.writes.map(({ value }) => value)).toEqual([
			JSON.stringify({ segments: [[[0, 0]]] }),
			JSON.stringify({ segments: [[[1, 1]]] }),
		]);
	});

	it("réécrit un tracé inchangé avant son expiration", async () => {
		const redis = createRedis();
		const publisher = createJourneyPathPublisher(900, 300_000);

		await publisher.publish(redis, { "N:RoutePath:a": routePath }, 0);
		await publisher.publish(redis, { "N:RoutePath:a": routePath }, 299_999);
		await publisher.publish(redis, { "N:RoutePath:a": routePath }, 300_000);

		expect(redis.writes).toHaveLength(2);
	});

	it("réécrit tout après une remise à zéro, Redis ayant pu tout perdre", async () => {
		const redis = createRedis();
		const publisher = createJourneyPathPublisher(900, 300_000);

		await publisher.publish(redis, { "N:RoutePath:a": routePath }, 0);
		publisher.reset();
		await publisher.publish(redis, { "N:RoutePath:a": routePath }, 1_000);

		expect(redis.writes).toHaveLength(2);
	});

	it("retente au cycle suivant une écriture en échec", async () => {
		const redis = createRedis();
		const publisher = createJourneyPathPublisher(900, 300_000);

		redis.fail();
		await expect(publisher.publish(redis, { "N:RoutePath:a": routePath }, 0)).rejects.toThrow();

		const retry = createRedis();
		await publisher.publish(retry, { "N:RoutePath:a": routePath }, 1_000);
		expect(retry.writes).toHaveLength(1);
	});

	it("publie un tracé de course tel que Shape#toPathJson le sérialise", async () => {
		const redis = createRedis();
		const publisher = createJourneyPathPublisher(900, 300_000);
		const shape = new Shape("s", new Float64Array([49.44, 1.09, 0, 49.45, 1.1, 120.5]));

		await publisher.publish(redis, { "N:RoutePath:s": shape }, 0);

		expect(redis.writes[0]?.value).toBe(shape.toPathJson());
	});

	it("ne réécrit pas un tracé identique porté par un autre objet", async () => {
		const redis = createRedis();
		const publisher = createJourneyPathPublisher(900, 300_000);

		await publisher.publish(redis, { "N:RoutePath:a": { p: [[1, 2, 3]] } }, 0);
		await publisher.publish(redis, { "N:RoutePath:a": { p: [[1, 2, 3]] } }, 30_000);

		expect(redis.writes).toHaveLength(1);
	});

	it("ne resérialise pas le même objet tant qu'il est frais", async () => {
		const redis = createRedis();
		const publisher = createJourneyPathPublisher(900, 300_000);
		const shape = new Shape("s", new Float64Array([49.44, 1.09, 0, 49.45, 1.1, 120.5]));
		const toPathJson = vi.spyOn(shape, "toPathJson");

		await publisher.publish(redis, { "N:RoutePath:s": shape }, 0);
		await publisher.publish(redis, { "N:RoutePath:s": shape }, 30_000);

		expect(toPathJson).toHaveBeenCalledTimes(1);
	});
});
