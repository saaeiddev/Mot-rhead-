export const FREQUENCIES = [60, 250, 1000, 4000, 12000] as const;
export interface Sound {
  volume: number;
  muted: boolean;
  eq: number[];
  eqOn: boolean;
  bass: number;
  bassOn: boolean;
  punch: number;
  punchOn: boolean;
}
export interface Preset {
  id: string;
  name: string;
  description: string;
  eq: number[];
  bass: number;
  punch: number;
}
export const DEFAULT_SOUND: Sound = {
  volume: 65,
  muted: false,
  eq: [0, 0, 0, 0, 0],
  eqOn: true,
  bass: 0,
  bassOn: false,
  punch: 0,
  punchOn: false,
};
export const PRESETS: Preset[] = [
  {
    id: "street",
    name: "Street",
    description: "BOLD. RAW. REAL.",
    eq: [2, -1, 2, 1, 1],
    bass: 2,
    punch: 30,
  },
  {
    id: "bass",
    name: "Bass",
    description: "DEEPER LOWS. BIGGER ENERGY.",
    eq: [5, 2, -1, 0, 1],
    bass: 5,
    punch: 20,
  },
  {
    id: "chill",
    name: "Chill",
    description: "SMOOTH VIBES. ALL DAY.",
    eq: [2, 1, 0, -2, -1],
    bass: 1,
    punch: 0,
  },
  {
    id: "battle",
    name: "Battle",
    description: "HIGH INTENSITY. BUILT TO MOVE.",
    eq: [3, -2, 2, 3, 1],
    bass: 3,
    punch: 65,
  },
];
const finite = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.max(min, Math.min(max, v))
    : fallback;
export function sanitizeSound(value: unknown): Sound {
  const s = (value && typeof value === "object" ? value : {}) as Partial<Sound>;
  return {
    volume: finite(s.volume, 0, 100, 65),
    muted: typeof s.muted === "boolean" ? s.muted : false,
    eq: FREQUENCIES.map((_, i) => finite(s.eq?.[i], -12, 12, 0)),
    eqOn: typeof s.eqOn === "boolean" ? s.eqOn : true,
    bass: finite(s.bass, 0, 12, 0),
    bassOn: typeof s.bassOn === "boolean" ? s.bassOn : false,
    punch: finite(s.punch, 0, 100, 0),
    punchOn: typeof s.punchOn === "boolean" ? s.punchOn : false,
  };
}
export function applyPreset(sound: Sound, preset: Preset): Sound {
  return sanitizeSound({
    ...sound,
    eq: [...preset.eq],
    eqOn: true,
    bass: preset.bass,
    bassOn: preset.bass > 0,
    punch: preset.punch,
    punchOn: preset.punch > 0,
  });
}
export function readSound(): Sound {
  try {
    const current = localStorage.getItem("motr-sound");
    if (current !== null) return sanitizeSound(JSON.parse(current));
    const legacy = JSON.parse(localStorage.getItem("mot-sound") || "null");
    if (!legacy || typeof legacy !== "object") return sanitizeSound(null);
    const volume = JSON.parse(localStorage.getItem("mot-volume") || "0.65");
    return sanitizeSound({...legacy, volume: typeof volume === "number" ? volume * 100 : 65,
      eqOn: legacy.eqEnabled, bassOn: legacy.bassEnabled, punchOn: legacy.punch > 0});
  } catch { return { ...DEFAULT_SOUND, eq: [...DEFAULT_SOUND.eq] }; }
}
export function readPresets(): Preset[] {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem("motr-presets") ?? localStorage.getItem("mot-custom") ?? "[]",
    );
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (p): p is Preset =>
          !!p &&
          typeof p.id === "string" &&
          p.id.startsWith("custom-") &&
          typeof p.name === "string" &&
          Array.isArray(p.eq) &&
          p.eq.length === 5 &&
          p.eq.every(
            (n: unknown) =>
              typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 12,
          ) &&
          typeof p.bass === "number" &&
          p.bass >= 0 &&
          p.bass <= 12 &&
          typeof p.punch === "number" &&
          p.punch >= 0 &&
          p.punch <= 100,
      )
      .slice(0, 50)
      .map((p) => ({
        ...p,
        name: p.name.slice(0, 40),
        description: "YOUR SOUND. YOUR RULES.",
      }));
  } catch {
    return [];
  }
}
// Conservative headroom: compensate the sum of positive boosts before filtering.
export function headroom(sound: Sound): number {
  const boost =
    (sound.eqOn ? sound.eq.reduce((s, x) => s + Math.max(0, x), 0) : 0) +
    (sound.bassOn ? sound.bass : 0);
  return Math.pow(10, -(boost + 1) / 20);
}
