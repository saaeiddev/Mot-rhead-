# MOT-RHEAD — Own The Noise

A responsive, monochrome, hip-hop/streetwear-inspired **headphone sound studio** for local music playback, live five-band Web Audio equalization, bass boost, punch/dynamics, and a real audio spectrum analyzer.

**Status:** implementation on feature branch; automated production build and unit tests run in GitHub Actions. Device-specific hardware and real mobile-browser acceptance testing remain necessary. Bluetooth capabilities are explicitly constrained to real BLE GATT services. No fake headphones or battery stats are shown.

## Features
- Five pages: **HOME**, **SOUND**, **PRESETS**, **CONTROLS**, **MORE**
- Black, white, and greyscale responsive interface; interactive 3D headphone render
- Local file import and playlist, play/pause, seek, next/previous, shuffle, repeat, volume
- Actual Web Audio processing: EQ bands 60 Hz / 250 Hz / 1 kHz / 4 kHz / 12 kHz (±12 dB), bass, punch/dynamics and a safety compressor
- Four built-in EQ profiles: STREET, BASS, CHILL, BATTLE
- Save, load, rename, delete custom presets (local browser storage)
- Spectrum visualizer based on AnalyserNode (not canned animation)
- BLE discovery on compatible browsers, actual GATT battery reads when service is available; no manufacturer-specific hardware controls
- Installable PWA with offline app shell, responsive mobile bottom navigation and reduced-motion CSS
- Real in-app gesture demo; hardware gesture editing not falsely offered

## Important limitations
**This app does not control arbitrary Bluetooth headphones.** Standard audio pairing and output routing happen in system Bluetooth settings. Web Bluetooth accesses BLE GATT services in certain Chromium browsers, not Bluetooth Classic headphone audio profiles. Direct ANC, transparency mode, firmware EQ or physical button remapping require a supported vendor API/protocol. **iOS Safari does not support standard Web Bluetooth**, though local audio processing works in the PWA. The Web Audio EQ works **only on audio imported into this web app**. It cannot intercept Spotify, Apple Music, YouTube or other applications, and it cannot adjust system-wide volume.

A real-device adapter can be implemented later for a specific model if documented vendor GATT services and permissions are available.

## Run locally

Requires Node.js 22+ and npm.

```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal.

## Validate and build

```bash
npm run build
npm test
npm run preview
```

The GitHub Actions CI workflow installs dependencies, compiles a production bundle, and runs unit tests (presets, Web Audio routing and BLE behavior) on pushes to the development branch and pull requests. These unit tests use browser API mocks; they do not replace listening tests or physical-device verification. A separate Pages workflow is configured for `main`. It deploys only after the verified branch is merged and the repository's Pages settings are enabled for **GitHub Actions**.

## GitHub Pages
The application uses `/Mot-rhead-/` as its Vite and service-worker base path. Intended deployment URL:

https://saaeiddev.github.io/Mot-rhead-/

That URL is not proof of a successful deployment until the Pages workflow has completed.

## Interaction notes
1. Pair an audio headset in your phone/desktop system Settings, as usual.
2. Use **+** or **IMPORT MUSIC** in the app to load supported local audio files.
3. Tap Play. Go to SOUND to hear live EQ, bass, punch and volume changes.
4. Choose a preset or save your own on PRESETS.
5. Test in-app playback shortcuts on CONTROLS.
6. On supported desktop/Android Chromium browsers, the BLE button can request nearby *BLE GATT* devices. It **does not** pair or control Bluetooth Classic audio.
7. Custom presets and settings persist in localStorage. Local tracks are temporary object URLs and must be reimported after a reload. No audio files are uploaded.

## Technology
React 19, TypeScript, Vite, React Three Fiber, Three.js, Lucide, Web Audio API, Web Bluetooth BLE GATT API, Vitest, GitHub Actions, native PWA manifest/service worker.

## Authorship
Created by **Amir Saeid Dehghan**. MOT-RHEAD is an independent design concept, not an official Skullcandy product.
