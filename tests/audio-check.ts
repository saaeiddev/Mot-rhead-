import { createGraph, updateGraph } from "../src/audio/engine";
import { DEFAULT_SOUND, type Sound } from "../src/audio/presets";
const results = document.querySelector("#results")!;
async function render(sound: Sound, frequency = 60, impulse = false) {
  const sampleRate = 44100;
  const context = new OfflineAudioContext(1, sampleRate, sampleRate);
  const buffer = context.createBuffer(1, sampleRate, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    data[i] =
      Math.sin(2 * Math.PI * frequency * t) *
      (impulse ? 0.08 + 0.82 * Math.exp(-(t % 0.2) * 40) : 0.18);
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  const graph = createGraph(context, source);
  updateGraph(context, graph, sound);
  source.start();
  const rendered = await context.startRendering();
  const samples = rendered.getChannelData(0).slice(sampleRate / 2);
  return {
    rms: Math.sqrt(samples.reduce((s, v) => s + v * v, 0) / samples.length),
    peak: Math.max(...samples.map(Math.abs)),
    samples,
  };
}
async function run() {
  results.textContent = "Running…";
  const lines: string[] = [];
  const check = (name: string, success: boolean, detail: string) => {
    lines.push(`${success ? "PASS" : "FAIL"} ${name}: ${detail}`);
    results.textContent = lines.join("\n");
  };
  const base = { ...DEFAULT_SOUND, volume: 100 };
  const flat = await render(base);
  const bass = await render({ ...base, bassOn: true, bass: 8 });
  const bassHigh = await render({ ...base, bassOn: true, bass: 8 }, 4000);
  const flatHigh = await render(base, 4000);
  check(
    "Bass changes frequency balance",
    bass.rms / bassHigh.rms > (flat.rms / flatHigh.rms) * 1.8,
    `low/high ratio ${(bass.rms / bassHigh.rms).toFixed(2)}`,
  );
  const cut = await render({ ...base, eq: [-12, 0, 0, 0, 0] });
  check(
    "60 Hz EQ cut changes real output",
    cut.rms < flat.rms * 0.8,
    `flat ${flat.rms.toFixed(4)}, cut ${cut.rms.toFixed(4)}`,
  );
  const bypass = await render({ ...base, eq: [-12, 0, 0, 0, 0], eqOn: false });
  check(
    "EQ bypass restores output",
    Math.abs(bypass.rms - flat.rms) < 0.001,
    `difference ${Math.abs(bypass.rms - flat.rms).toFixed(6)}`,
  );
  const half = await render({ ...base, volume: 50 });
  check(
    "Volume gain is linear",
    Math.abs(half.rms / flat.rms - 0.5) < 0.01,
    `ratio ${(half.rms / flat.rms).toFixed(3)}`,
  );
  const muted = await render({ ...base, muted: true });
  check(
    "Mute silences output",
    muted.peak < 0.0001,
    `peak ${muted.peak.toFixed(6)}`,
  );
  const dry = await render(base, 1000, true);
  const punch = await render(
    { ...base, punchOn: true, punch: 100 },
    1000,
    true,
  );
  check(
    "Punch changes dynamics",
    Math.abs(punch.rms - dry.rms) > 0.005,
    `dry ${dry.rms.toFixed(4)}, punch ${punch.rms.toFixed(4)}`,
  );
  const hot = await render(
    {
      ...base,
      eq: [12, 12, 12, 12, 12],
      bassOn: true,
      bass: 12,
      punchOn: true,
      punch: 100,
    },
    60,
    true,
  );
  check(
    "Extreme boosts stay finite with headroom",
    hot.samples.every(Number.isFinite) && hot.peak < 1,
    `peak ${hot.peak.toFixed(4)}`,
  );
  results.setAttribute("data-complete", "true");
}
document.querySelector("#run")!.addEventListener("click", () =>
  run().catch((e) => {
    results.textContent = "ERROR " + e.message;
  }),
);
