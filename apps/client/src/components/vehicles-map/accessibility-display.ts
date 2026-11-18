import { useDisplaySetting } from "~/components/vehicles-map/embed-display-settings";

/** Affichage de l'accessibilité PMR des arrêts et des courses : masquée par défaut. */
export const useShowWheelchairAccessibility = () => useDisplaySetting("showWheelchairAccessibility");

/** Affichage de la prise en charge des vélos par les courses : masquée par défaut. */
export const useShowBikesAllowed = () => useDisplaySetting("showBikesAllowed");
