import { createRedisClient } from "@bus-tracker/redis";

/** Client partagé du serveur. Sa connexion est établie au démarrage, en arrière-plan. */
export const redis = createRedisClient({ name: "server" });
