import type { SoundSettings } from './presets'
import { clamp } from './presets'

/** In-app Web Audio processing only. Does not control OS, Spotify, or external playback. */
export class AudioEngine {
  readonly context: AudioContext
  readonly analyser: AnalyserNode
  private eq: BiquadFilterNode[]
  private bass: BiquadFilterNode
  private dynamics: DynamicsCompressorNode
  private safety: DynamicsCompressorNode
  private master: GainNode
  private source: MediaElementAudioSourceNode
  private readonly bands = [60, 250, 1000, 4000, 12000]

  constructor(element: HTMLAudioElement) {
    this.context = new AudioContext()
    this.source = this.context.createMediaElementSource(element)
    this.eq = this.bands.map((frequency, i) => {
      const node = this.context.createBiquadFilter()
      node.type = i === 0 ? 'lowshelf' : i === 4 ? 'highshelf' : 'peaking'
      node.frequency.value = frequency
      if (i > 0 && i < 4) node.Q.value = 1.05
      return node
    })
    this.bass = this.context.createBiquadFilter()
    this.bass.type = 'lowshelf'
    this.bass.frequency.value = 105
    this.dynamics = this.context.createDynamicsCompressor()
    this.safety = this.context.createDynamicsCompressor()
    this.safety.threshold.value = -5
    this.safety.knee.value = 4
    this.safety.ratio.value = 18
    this.safety.attack.value = 0.002
    this.safety.release.value = 0.11
    this.master = this.context.createGain()
    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = 1024
    this.analyser.smoothingTimeConstant = 0.82
    let previous: AudioNode = this.source
    for (const node of this.eq) { previous.connect(node); previous = node }
    previous.connect(this.bass)
    this.bass.connect(this.dynamics)
    this.dynamics.connect(this.safety)
    this.safety.connect(this.master)
    this.master.connect(this.analyser)
    this.analyser.connect(this.context.destination)
  }
  async unlock() { if (this.context.state === 'suspended') await this.context.resume() }
  setSettings(settings: SoundSettings) {
    const t = this.context.currentTime
    const move = (param: AudioParam, value: number) => param.setTargetAtTime(value, t, 0.025)
    settings.eq.forEach((gain, i) => move(this.eq[i].gain, settings.eqEnabled ? clamp(gain, -12, 12) : 0))
    move(this.bass.gain, settings.bassEnabled ? clamp(settings.bass, 0, 12) : 0)
    const intensity = clamp(settings.punch, 0, 100) / 100
    move(this.dynamics.threshold, -5 - intensity * 19)
    move(this.dynamics.ratio, 1 + intensity * 4)
    move(this.dynamics.attack, 0.018 - intensity * 0.013)
    move(this.dynamics.release, 0.16 - intensity * 0.07)
  }
  setVolume(value: number) { this.master.gain.setTargetAtTime(clamp(value, 0, 1), this.context.currentTime, 0.018) }
  async close() { if (this.context.state !== 'closed') await this.context.close() }
}
