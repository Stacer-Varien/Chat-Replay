import { createContext, useContext, useSyncExternalStore } from "react";
import { imageSettings, type PrintableOnlineImage } from "./online-images";

export const OnlineImageSettingsContext = createContext<() => void>(() => {});
export const PrintOnlineImagesContext = createContext<Map<string, PrintableOnlineImage> | null>(
  null,
);
export function useImageSettings() {
  return useSyncExternalStore(imageSettings.subscribe, imageSettings.get, imageSettings.server);
}
export function useOpenImageSettings() {
  return useContext(OnlineImageSettingsContext);
}
