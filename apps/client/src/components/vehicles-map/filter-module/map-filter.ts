import type { Line, Network } from "~/api/networks";

// Le filtre de la carte est soit une ligne précise (le réseau n'est là que pour le fil d'Ariane),
// soit un réseau entier. Modéliser une union évite l'état impossible « réseau connu mais rien de filtré »,
// qui se produit en mode embarqué où le réseau est toujours défini.
export type MapFilter = { kind: "line"; network?: Network; line: Line } | { kind: "network"; network: Network };
