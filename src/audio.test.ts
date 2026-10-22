import { afterEach, describe, expect, it, vi } from 'vitest'
import { AudioEngine } from './audio'
import { DEFAULTS } from './presets'

class MockParam {
  value = 0
  setTargetAtTime(value: number) { this.value = value }
}
class MockNode {
  connections: unknown[] = []
  connect(next: unknown) { this.connections.push(next); return next }
}
class MockFilter extends MockNode {
  type: BiquadFilterType = 'peaking'
  frequency = new MockParam()
  Q = new MockParam()
  gain = new MockParam()
}
class MockDynamics extends MockNode {
  threshold = new MockParam()
  knee = new MockParam()
  ratio = new MockParam()
  attack = new MockParam()
  release = new MockParam()
}
class MockAnalyser extends MockNode {
  fftSize = 2048
  smoothingTimeConstant = 0
}
class MockAudioContext {
  static latest: MockAudioContext
  currentTime = 5
  state = 'suspended'
  destination = new MockNode()
  filters: MockFilter[] = []
  compressors: MockDynamics[] = []
  master = new MockNode() as MockNode & { gain: MockParam }
  analyser = new MockAnalyser()
  constructor() {
    MockAudioContext.latest = this
    this.master.gain = new MockParam()
  }
  createMediaElementSource(_el: HTMLAudioElement) { return new MockNode() }
  createBiquadFilter() { const filter = new MockFilter(); this.filters.push(filter); return filter }
  createDynamicsCompressor() { const item = new MockDynamics(); this.compressors.push(item); return item }
  createGain() { return this.master }
  createAnalyser() { return this.analyser }
  async resume() { this.state = 'running' }
  async close() { this.state = 'closed' }
}

afterEach(() => vi.unstubAllGlobals())

describe('real in-app DSP wiring', () => {
  it('builds a signal chain including EQ, bass, dynamics, safety, output and analyser', () => {
    vi.stubGlobal('AudioContext', MockAudioContext)
    const engine = new AudioEngine({} as HTMLAudioElement)
    const context = MockAudioContext.latest
    expect(context.filters).toHaveLength(6)
    expect(context.filters.slice(0, 5).map(item => item.frequency.value))
      .toEqual([60, 250, 1000, 4000, 12000])
    expect(context.compressors).toHaveLength(2)
    expect(context.master.connections).toContain(context.analyser)
    expect(context.analyser.connections).toContain(context.destination)
    expect(engine.analyser).toBe(context.analyser)
  })

  it('applies and bypasses sound controls without editing the original track', async () => {
    vi.stubGlobal('AudioContext', MockAudioContext)
    const engine = new AudioEngine({} as HTMLAudioElement)
    const context = MockAudioContext.latest
    engine.setSettings({ ...DEFAULTS, eq: [12, -12, 5, 4, 1], bassEnabled: true, bass: 8, punch: 75 })
    expect(context.filters.slice(0, 5).map(item => item.gain.value))
      .toEqual([12, -12, 5, 4, 1])
    expect(context.filters[5].gain.value).toBe(8)
    expect(context.compressors[0].ratio.value).toBe(4)
    engine.setSettings({ ...DEFAULTS, eq: [9, 9, 9, 9, 9], eqEnabled: false, bassEnabled: false })
    expect(context.filters.slice(0, 5).map(item => item.gain.value)).toEqual([0, 0, 0, 0, 0])
    expect(context.filters[5].gain.value).toBe(0)
    engine.setVolume(1.7)
    expect(context.master.gain.value).toBe(1)
    engine.setVolume(-5)
    expect(context.master.gain.value).toBe(0)
    await engine.unlock()
    expect(context.state).toBe('running')
    await engine.close()
    expect(context.state).toBe('closed')
  })
})
