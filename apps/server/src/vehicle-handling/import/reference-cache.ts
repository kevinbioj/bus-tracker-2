/**
 * Durée pendant laquelle le worker garde réseaux, lignes et véhicules déjà importés. Les fonctions
 * d'import ne font qu'insérer ce qui manque : pour une référence connue, leur réponse ne change
 * qu'au gré d'un éditeur (archivage, réglages du réseau, numéro d'un véhicule), qui n'est donc
 * répercuté sur les courses qu'à l'expiration de l'entrée.
 */
export const REFERENCE_CACHE_TTL_MS = 60_000;
