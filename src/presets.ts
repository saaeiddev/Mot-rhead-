export type SoundSettings = {
  eq: [number, number, number, number, number]
  bass: number
  punch: number
  bassEnabled: boolean
  eqEnabled: boolean
}
export type SoundPreset = SoundSettings & { id: string; name: string; description: string; custom?: boolean }
export const DEFAULTS: SoundSettings = { eq: [0, 0, 0, 0, 0], bass: 0, punch: 0, bassEnabled: false, eqEnabled: true }
export const FACTORY_PRESETS: SoundPreset[] = [
  { id: 'street', name: 'STREET', description: 'Built for city sound.', eq: [3, 1, 2, 3, 1], bass: 3, punch: 35, bassEnabled: true, eqEnabled: true },
  { id: 'bass', name: 'BASS', description: 'Feel every low end.', eq: [6, 4, -1, 0, 1], bass: 6, punch: 40, bassEnabled: true, eqEnabled: true },
  { id: 'chill', name: 'CHILL', description: 'Ease into the flow.', eq: [2, 1, 0, -1, 2], bass: 2, punch: 12, bassEnabled: true, eqEnabled: true },
  { id: 'battle', name: 'BATTLE', description: 'Move with the punch.', eq: [3, -1, 3, 4, 3], bass: 3, punch: 65, bassEnabled: true, eqEnabled: true }
]
export const clamp = (value: number, min: number, max: number) => Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min
export function sanitizeSettings(value: Partial<SoundSettings>): SoundSettings {
  return {
    eq: ([0, 1, 2, 3, 4].map(i => clamp(Number(value.eq?.[i] ?? 0), -12, 12))) as SoundSettings['eq'],
    bass: clamp(Number(value.bass ?? 0), 0, 12),
    punch: clamp(Number(value.punch ?? 0), 0, 100),
    bassEnabled: value.bassEnabled === true,
    eqEnabled: value.eqEnabled !== false
  }
}
export function readSaved<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback } catch { return fallback }
}
export function saveSettings(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage unavailable */ }
}
