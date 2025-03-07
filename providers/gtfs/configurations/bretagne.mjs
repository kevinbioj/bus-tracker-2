function nthIndexOf(input, pattern, n) {
  const length = input.length;
  let i = -1;
  let j = n;
  while (j-- && i++ < length) {
    i = input.indexOf(pattern, i);
    if (i < 0) break;
  }
  return i;
}

/** @type {import('../src/model/source.ts').SourceOptions[]} */
const sources = [
  {
    id: "brest",
    staticResourceHref:
      "https://s3.eu-west-1.amazonaws.com/files.orchestra.ratpdev.com/networks/bibus/exports/medias.zip",
    realtimeResourceHrefs: [
      "https://proxy.transport.data.gouv.fr/resource/bibus-brest-gtfs-rt-vehicle-position",
      "https://proxy.transport.data.gouv.fr/resource/bibus-brest-gtfs-rt-trip-update",
    ],
    mode: "NO-TU",
    getNetworkRef: () => "BIBUS",
    // "anonymised" vehicle reference 😅🤣
    getVehicleRef: (vehicle) => (vehicle ? +vehicle.id - 2 ** 28 : undefined),
  },
  {
    id: "lorient",
    staticResourceHref:
      "https://s3.eu-west-1.amazonaws.com/files.orchestra.ratpdev.com/networks/rdla-lorient/exports/medias.zip",
    realtimeResourceHrefs: ["https://feed-rdla-lorient.ratpdev.com/GTFS-RT"],
    getNetworkRef: () => "IZILO",
    getVehicleRef: (vehicle) => vehicle?.label ?? undefined,
  },
  {
    id: "quimper",
    staticResourceHref:
      "https://www.data.gouv.fr/fr/datasets/r/0cf733af-e58a-4b56-ab18-abbd09de7d02",
    realtimeResourceHrefs: [],
    gtfsOptions: {
      // QUB City comes in the next source
      filterTrips: (trip) => trip.route.id !== "QCIT-648",
    },
    getNetworkRef: () => "QUB",
  },
  {
    id: "quimper-navette",
    staticResourceHref:
      "https://zenbus.net/gtfs/static/download.zip?dataset=quimper",
    realtimeResourceHrefs: [
      "https://zenbus.net/gtfs/rt/poll.proto?dataset=quimper",
    ],
    getNetworkRef: () => "QUB",
    getVehicleRef: () => undefined,
    mapLineRef: (lineRef) =>
      lineRef.slice(
        nthIndexOf(lineRef, ":", 2) + 1,
        nthIndexOf(lineRef, ":", 3)
      ),
    mapStopRef: (stopRef) =>
      stopRef.slice(
        nthIndexOf(stopRef, ":", 3) + 1,
        nthIndexOf(stopRef, ":", 4)
      ),
  },
  {
    id: "rennes",
    staticResourceHref: "https://gtfs.bus-tracker.fr/star.zip",
    realtimeResourceHrefs: [
      "https://proxy.transport.data.gouv.fr/resource/star-rennes-integration-gtfs-rt-trip-update",
      "https://proxy.transport.data.gouv.fr/resource/star-rennes-integration-gtfs-rt-vehicle-position",
    ],
    mode: "NO-TU",
    excludeScheduled: (trip) => trip.route.type !== "SUBWAY",
    getNetworkRef: () => "STAR",
  },
  {
    id: "saint-malo",
    staticResourceHref:
      "https://www.data.gouv.fr/fr/datasets/r/3bd31fbe-93f4-432d-ade7-ee8d69897880",
    realtimeResourceHrefs: [
      "https://proxy.transport.data.gouv.fr/resource/mat-saint-malo-gtfs-rt-trip-update",
    ],
    getNetworkRef: () => "MAT",
  },
  {
    id: "vannes",
    staticResourceHref:
      "https://www.data.gouv.fr/fr/datasets/r/565533c0-64ae-44d6-9dfa-169be5b805c6",
    realtimeResourceHrefs: [
      "https://proxy.transport.data.gouv.fr/resource/kiceo-vannes-gtfs-rt-trip-update",
      "https://proxy.transport.data.gouv.fr/resource/kiceo-vannes-gtfs-rt-vehicle-position",
    ],
    getNetworkRef: () => "KICEO",
    getVehicleRef: (vehicle) => vehicle?.label ?? undefined,
  },
];

/** @type {import('../src/configuration/configuration.ts').Configuration} */
const configuration = {
  computeDelayMs: 30_000,
  redisOptions: {
    url: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
  },
  sources,
};

export default configuration;
