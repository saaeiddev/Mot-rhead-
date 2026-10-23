import { test, expect } from "@playwright/test";
import path from "node:path";
test("unsupported Bluetooth opens actionable guidance from both connection buttons", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "bluetooth", {
      configurable: true,
      value: undefined,
    });
  });
  await page.goto("./");
  await page
    .getByRole("button", { name: "CONNECT HEADPHONES", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "CONNECT YOUR HEADPHONES." });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("status")).toContainText(
    "Bluetooth device access unavailable",
  );
  await expect(dialog).toContainText("Bluetooth settings");
  await expect(dialog).toContainText("audio output");
  await expect(dialog).not.toContainText("BLE connected:");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await dialog.getByRole("button", { name: "BACK TO MY MUSIC" }).click();
  await expect(dialog).not.toBeVisible();
  await page.goto("./#more");
  await page
    .getByRole("button", { name: "CONNECTION GUIDE", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText(
    "Bluetooth device access unavailable",
  );
});
test("cancelled BLE chooser remains visible and can be retried", async ({
  page,
}) => {
  // Only the permission chooser is mocked; no real hardware connection is claimed.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "bluetooth", {
      configurable: true,
      value: {
        requestDevice: () => {
          if (!navigator.userActivation.isActive)
            throw new Error("Missing user activation");
          return Promise.reject(new DOMException("cancel", "NotFoundError"));
        },
      },
    });
  });
  await page.goto("./");
  await page
    .getByRole("button", { name: "CONNECT BLE DEVICE", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "CONNECT YOUR HEADPHONES." });
  await expect(dialog.getByRole("status")).toContainText("No device selected");
  await expect(dialog).not.toContainText("BLE connected:");
  await dialog
    .getByRole("button", { name: "TRY BLE CONNECTION AGAIN" })
    .click();
  await expect(dialog.getByRole("status")).toContainText("No device selected");
});
test("navigation, mobile layout, presets and import persistence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: "READY TO MAKE NOISE." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open sound lab", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "FEEL THE BEAT." }),
  ).toBeVisible();
  await page.getByLabel("60 Hz", { exact: true }).press("ArrowRight");
  await expect(page.getByLabel("60 Hz", { exact: true })).toHaveValue("1");
  await page.getByRole("button", { name: "Save preset", exact: true }).click();
  await page.getByLabel("Preset name", { exact: true }).fill("Night ride");
  await page.getByRole("button", { name: "SAVE PRESET", exact: true }).click();
  await page.goto("./#presets");
  await page.getByRole("button", { name: /Custom/ }).click();
  await expect(page.getByRole("heading", { name: "Night ride" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Custom/ }).click();
  await expect(page.getByRole("heading", { name: "Night ride" })).toBeVisible();
  await page
    .locator("input[type=file]")
    .setInputFiles(path.resolve("public/assets/demo-beat.wav"));
  await expect(
    page.getByRole("button", { name: /demo-beat Local audio/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: /demo-beat Local audio/ }),
  ).toBeVisible();
  for (const route of ["home", "sound", "presets", "controls", "more"]) {
    await page.goto("./#" + route);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});
test("real DSP response, mute, bypass, volume, punch and headroom", async ({
  page,
}) => {
  await page.goto("./tests/audio.html");
  await page.getByRole("button", { name: "Run audio tests" }).click();
  await expect(page.locator("#results")).toHaveAttribute(
    "data-complete",
    "true",
  );
  const result = await page.locator("#results").innerText();
  expect(result).not.toContain("FAIL");
  expect(result.match(/PASS/g)?.length).toBe(7);
});
