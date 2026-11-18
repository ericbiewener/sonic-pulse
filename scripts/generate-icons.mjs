import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const directory = new URL("../public/icons/", import.meta.url);
const svg = await readFile(new URL("icon.svg", directory), "utf8");
const browser = await chromium.launch({ channel: "chrome" });

try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  await page.setContent(
    `<style>html,body{margin:0}svg{display:block;width:100%;height:100%}</style>${svg}`,
  );
  for (const [size, filename] of [
    [180, "apple-touch-icon.png"],
    [192, "icon-192.png"],
    [512, "icon-512.png"],
  ]) {
    await page.setViewportSize({ width: size, height: size });
    await page.screenshot({
      path: fileURLToPath(new URL(filename, directory)),
    });
  }
} finally {
  await browser.close();
}
