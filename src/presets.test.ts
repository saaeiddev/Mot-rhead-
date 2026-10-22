import { describe, expect, it } from 'vitest'
import { clamp, FACTORY_PRESETS, sanitizeSettings } from './presets'
describe('Audio profile safety', () => {
  it('provides four defined presets', () => {
    expect(FACTORY_PRESETS.map(p => p.id)).toEqual(['street', 'bass', 'chill', 'battle'])
    for (const preset of FACTORY_PRESETS) expect(preset.eq).toHaveLength(5)
  })
  it('clamps unsafe audio settings', () => {
    expect(sanitizeSettings({ eq: [200, -200, 0, 0, 0], bass: 100, punch: -3 })).toMatchObject({
      eq: [12, -12, 0, 0, 0], bass: 12, punch: 0
    })
    expect(clamp(NaN, 0, 10)).toBe(0)
  })
})
