import { Capacitor, registerPlugin } from "@capacitor/core";

interface NativePrintPlugin {
  printHtml(options: { title: string; html: string }): Promise<void>;
}

const nativePrint = registerPlugin<NativePrintPlugin>("NativePrint");

export function canUseNativePrint(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export function printHtmlOnAndroid(title: string, html: string): Promise<void> {
  return nativePrint.printHtml({ title, html });
}
