import sharp from "sharp";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../assets/logo.svg", import.meta.url));
for (const path of ["../icon.png", "../assets/icon.png", "../public/icon.png"]) {
  await sharp(source)
    .resize(1024, 1024)
    .png()
    .toFile(
      new URL(path, import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1").replace(/%20/g, " "),
    );
}
await sharp(source)
  .resize(192, 192)
  .png()
  .toFile(
    new URL("../public/icon-192.png", import.meta.url).pathname
      .replace(/^\/([A-Z]:)/, "$1")
      .replace(/%20/g, " "),
  );
await sharp(source)
  .resize(512, 512)
  .png()
  .toFile(
    new URL("../public/icon-512.png", import.meta.url).pathname
      .replace(/^\/([A-Z]:)/, "$1")
      .replace(/%20/g, " "),
  );
