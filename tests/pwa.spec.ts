import { expect, test } from "@playwright/test";

test("is installable with valid home screen icons", async ({
  page,
  browserName,
}) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector<HTMLLinkElement>(
      'link[rel="manifest"]',
    );
    if (!link) throw new Error("Missing manifest link");
    const response = await fetch(link.href);
    if (!response.ok) throw new Error("Could not load manifest");
    return response.json();
  });
  expect(manifest).toMatchObject({
    id: "/",
    name: "Sonic Pulse",
    start_url: "/",
    scope: "/",
    display: "standalone",
  });
  for (const icon of manifest.icons) {
    const dimensions = await page.evaluate(async (src: string) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return `${image.naturalWidth}x${image.naturalHeight}`;
    }, icon.src);
    expect(dimensions).toBe(icon.sizes);
  }
  const appleIcon = await page
    .locator('link[rel="apple-touch-icon"]')
    .getAttribute("href");
  expect(appleIcon).toBeTruthy();
  expect(
    await page.evaluate(async (src) => {
      const image = new Image();
      image.src = src ?? "";
      await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    }, appleIcon),
  ).toEqual([180, 180]);
  if (browserName === "chromium") {
    const client = await page.context().newCDPSession(page);
    expect((await client.send("Page.getAppManifest")).errors).toEqual([]);
    await expect
      .poll(async () => {
        const { installabilityErrors } = await client.send(
          "Page.getInstallabilityErrors",
        );
        // Playwright's isolated contexts are private windows, where Chrome blocks installation.
        return installabilityErrors.filter(
          (error) => error.errorId !== "in-incognito",
        );
      })
      .toEqual([]);
  }
});

test("opens offline and plays audio without ever playing online", async ({
  page,
  context,
  browserName,
}) => {
  await page.goto("/");
  const tempo = page.getByRole("spinbutton", { name: "Tempo in BPM" });
  await tempo.fill("135");
  await tempo.press("Enter");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.close();

  // The audio worklet has never been requested by a page; it must come from the PWA cache.
  const offlinePage = await context.newPage();
  if (browserName === "chromium") {
    const client = await context.newCDPSession(offlinePage);
    await client.send("Network.enable");
    await client.send("Network.setCacheDisabled", { cacheDisabled: true });
  }
  await context.setOffline(true);
  await offlinePage.addInitScript(() => {
    const OriginalContext = window.AudioContext;
    window.AudioContext = class extends OriginalContext {
      constructor(options?: AudioContextOptions) {
        super(options);
        const analyser = this.createAnalyser();
        analyser.fftSize = 8192;
        Object.assign(window, { __offlineAnalyser: analyser });
        const createGain = this.createGain.bind(this);
        this.createGain = () => {
          const gain = createGain();
          gain.connect(analyser);
          return gain;
        };
      }
    };
  });
  const errors: string[] = [];
  offlinePage.on("pageerror", (error) => errors.push(error.message));
  await offlinePage.goto("/");
  await expect(
    offlinePage.getByRole("spinbutton", { name: "Tempo in BPM" }),
  ).toHaveValue("135");
  await offlinePage.getByRole("button", { name: "Start pulse" }).click();
  await expect(
    offlinePage.getByRole("button", { name: "Stop pulse" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      offlinePage.evaluate(() => {
        const analyser = (
          window as unknown as { __offlineAnalyser: AnalyserNode }
        ).__offlineAnalyser;
        const samples = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(samples);
        return Math.max(...samples.map(Math.abs));
      }),
    )
    .toBeGreaterThan(0.005);
  expect(
    await offlinePage.evaluate(async () => {
      await document.fonts.ready;
      return (
        document.fonts.check('12px "DM Sans Variable"') &&
        document.fonts.check('12px "Manrope Variable"')
      );
    }),
  ).toBe(true);
  await offlinePage.reload();
  await expect(
    offlinePage.getByRole("button", { name: "Start pulse" }),
  ).toBeVisible();
  await expect(
    offlinePage.getByRole("spinbutton", { name: "Tempo in BPM" }),
  ).toHaveValue("135");
  expect(errors).toEqual([]);
});

test("offers browser installation and hides installation help after install", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByText("Add to home screen", { exact: true }).click();
  await expect(page.getByText(/open in Safari/)).toBeVisible();
  await expect(page.getByText(/open in Chrome/)).toBeVisible();
  expect(
    await page.evaluate(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true });
      Object.assign(event, {
        prompt: async () => {
          document.documentElement.dataset.installPromptShown = "true";
          return { outcome: "dismissed" };
        },
      });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  ).toBe(true);
  await page.getByRole("button", { name: "Install Sonic Pulse" }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-install-prompt-shown",
    "true",
  );
  await expect(
    page.getByRole("button", { name: "Install Sonic Pulse" }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Add to home screen", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await expect(
    page.getByText("Add to home screen", { exact: true }),
  ).toHaveCount(0);
});

test("hides installation help when launched from the iOS home screen", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { value: true });
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Start pulse" })).toBeVisible();
  await expect(
    page.getByText("Add to home screen", { exact: true }),
  ).toHaveCount(0);
});
