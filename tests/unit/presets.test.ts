import { describe, it, expect, vi, afterEach } from "vitest";
import {
  sanitizeSound,
  readSound,
  readPresets,
  PRESETS,
  DEFAULT_SOUND,
  applyPreset,
  headroom,
} from "../../src/audio/presets";
afterEach(() => vi.unstubAllGlobals());
describe("persisted sound and presets", () => {
  it("clamps untrusted persisted gain and restores missing bands", () => {
    expect(
      sanitizeSound({
        volume: 400,
        bass: -50,
        punch: Infinity,
        eq: [99, -99, NaN],
        muted: "false",
      }),
    ).toEqual({ ...DEFAULT_SOUND, volume: 100, eq: [12, -12, 0, 0, 0] });
  });
  it("handles malformed storage without breaking startup", () => {
    vi.stubGlobal("localStorage", { getItem: () => "{broken" });
    expect(readSound()).toEqual(DEFAULT_SOUND);
    expect(readPresets()).toEqual([]);
  });
  it("rejects invalid custom presets and preserves valid ones", () => {
    vi.stubGlobal("localStorage", {
      getItem: () =>
        JSON.stringify([
          { ...PRESETS[0], id: "custom-good" },
          { ...PRESETS[0], id: "custom-bad", eq: [99, 0, 0, 0, 0] },
          { ...PRESETS[0], id: "custom-null", bass: null },
        ]),
    });
    expect(readPresets().map((p) => p.id)).toEqual(["custom-good"]);
  });
  it("applying a preset preserves volume and mute without mutating factory values", () => {
    const sound = applyPreset(
      { ...DEFAULT_SOUND, volume: 24, muted: true },
      PRESETS[0],
    );
    sound.eq[0] = 12;
    expect(sound.volume).toBe(24);
    expect(sound.muted).toBe(true);
    expect(PRESETS[0].eq[0]).toBe(2);
  });
  it("provides enough headroom for the sum of positive boosts", () => {
    const sound = {
      ...DEFAULT_SOUND,
      eq: [12, 12, 12, 12, 12],
      bassOn: true,
      bass: 12,
    };
    expect(headroom(sound) * 10 ** (72 / 20)).toBeLessThan(1);
    expect(headroom({ ...sound, eqOn: false, bassOn: false })).toBeCloseTo(
      10 ** (-1 / 20),
    );
  });
});

describe('v0.1 migration',()=>{
 it('preserves existing audio preferences',()=>{vi.stubGlobal('localStorage',{getItem:(key:string)=>key==='mot-sound'?JSON.stringify({eq:[3,1,0,-2,2],bass:4,punch:25,bassEnabled:true,eqEnabled:false}):key==='mot-volume'?'0.4':null});expect(readSound()).toMatchObject({volume:40,eq:[3,1,0,-2,2],bass:4,bassOn:true,eqOn:false,punch:25,punchOn:true});});
 it('does not resurrect legacy presets after the new list was cleared',()=>{vi.stubGlobal('localStorage',{getItem:(key:string)=>key==='motr-presets'?'[]':JSON.stringify([{...PRESETS[0],id:'custom-old'}])});expect(readPresets()).toEqual([]);});
});
