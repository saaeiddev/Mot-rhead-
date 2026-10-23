# Verification record

## Performed in the development environment

- Strict TypeScript compilation and Vite production build completed successfully.
- 12 Vitest tests passed: legacy sound and custom-preset migration, corrupt preference recovery, custom preset validation, immutable preset application, conservative gain headroom, missing Bluetooth API, cancelled selection, absent battery service, actual-value notification handling, disconnect cleanup, and late GATT connection timeout cleanup. BLE tests use explicit mocks, not physical hardware.
- Seven browser OfflineAudioContext renders passed using the application's actual DSP graph:
  - Bass changed low/high frequency balance (ratio 2.31).
  - A -12 dB 60 Hz shelf cut changed RMS from 0.1224 to 0.0614.
  - EQ bypass restored baseline (difference under 0.000001).
  - 50% volume produced amplitude ratio 0.500.
  - Mute settled to peak below 0.000001.
  - Punch changed burst-signal dynamics (RMS 0.1570 vs 0.1741).
  - Maximum EQ/bass settings produced finite output with peak below 1.
- Cloud Chromium UI: original demo playback, imported WAV playback, actual progressing seek position, custom EQ adjustment, custom preset creation, and custom preset persistence after reload observed.
- Desktop and mobile reference layouts visually inspected. All five screens checked at 320, 768 and 1024 px iframe viewports without horizontal overflow. Tablet navigation accessible labels corrected and verified after QA.
- Generated manifest/service worker have the repository base path; the build bundles local visual assets and fonts.

## Published release

GitHub Actions run 39907785521 passed all unit, production-build, and desktop/mobile Playwright checks and deployed successfully. The public HTTPS app was opened, its original demo playback advanced, and the Sound screen was visually verified. See `live-release.jpg`.

## Boundaries

No physical Bluetooth headphones were connected. No native iPhone Safari, Android device, macOS Safari or hardware Media Session tests were performed. Do not interpret browser emulation as native device testing. Headphone audio routing is controlled by the OS.

The cloud preview is HTTP and does not expose Web Bluetooth or a production service worker. Offline installation is configured and build-validated, but its final HTTPS behavior requires a deployed site. Browser extension metadata errors seen in the cloud browser originate from its extension, not the application.

Playwright tests are included in the deployment workflow. They are a separate gate from the cloud-browser checks above; consult the GitHub Actions run for the actual CI result.

## Connection feedback fix

GitHub Actions run 39908679776 passed 13 unit tests, the production build and all eight desktop/mobile browser tests. New regression coverage checks visible guidance when the Bluetooth API is absent and retry after a mocked chooser cancellation. The public HTTPS Home connection button was clicked and its guidance dialog visually verified (`connection-fix.jpg`). The already-open PWA required a second reload after its service worker updated. No physical Bluetooth hardware was tested.
