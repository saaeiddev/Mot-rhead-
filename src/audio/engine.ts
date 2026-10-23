import { FREQUENCIES, headroom, type Sound } from "./presets";
export interface AudioGraph {
  input: GainNode;
  filters: BiquadFilterNode[];
  bass: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
  limiter: DynamicsCompressorNode;
  volume: GainNode;
  analyser: AnalyserNode;
}
export function createGraph(
  context: BaseAudioContext,
  source: AudioNode,
): AudioGraph {
  const input = context.createGain();
  source.connect(input);
  let previous: AudioNode = input;
  const filters = FREQUENCIES.map((frequency, i) => {
    const filter = context.createBiquadFilter();
    filter.type = i === 0 ? "lowshelf" : i === 4 ? "highshelf" : "peaking";
    filter.frequency.value = frequency;
    filter.Q.value = 0.8;
    previous.connect(filter);
    previous = filter;
    return filter;
  });
  const bass = context.createBiquadFilter();
  bass.type = "lowshelf";
  bass.frequency.value = 110;
  previous.connect(bass);
  const compressor = context.createDynamicsCompressor();
  bass.connect(compressor);
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -1;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.1;
  compressor.connect(limiter);
  const volume = context.createGain();
  limiter.connect(volume);
  const analyser = context.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.8;
  volume.connect(analyser);
  analyser.connect(context.destination);
  return { input, filters, bass, compressor, limiter, volume, analyser };
}
export function updateGraph(
  context: BaseAudioContext,
  graph: AudioGraph,
  sound: Sound,
) {
  const set = (p: AudioParam, v: number) =>
    p.setTargetAtTime(v, context.currentTime, 0.025);
  set(graph.input.gain, headroom(sound));
  graph.filters.forEach((filter, i) =>
    set(filter.gain, sound.eqOn ? sound.eq[i] : 0),
  );
  set(graph.bass.gain, sound.bassOn ? sound.bass : 0);
  const amount = sound.punchOn ? sound.punch / 100 : 0;
  set(graph.compressor.threshold, -8 - amount * 22);
  set(graph.compressor.ratio, 1 + amount * 5);
  set(graph.compressor.knee, 12);
  set(graph.compressor.attack, 0.035);
  set(graph.compressor.release, 0.08 + amount * 0.12);
  set(graph.volume.gain, sound.muted ? 0 : sound.volume / 100);
}
export class AudioEngine {
  context: AudioContext | null = null;
  graph: AudioGraph | null = null;
  constructor(public audio: HTMLAudioElement) {}
  async activate(sound: Sound) {
    if (!this.context) {
      this.context = new AudioContext();
      this.graph = createGraph(
        this.context,
        this.context.createMediaElementSource(this.audio),
      );
    }
    this.update(sound);
    if (this.context.state !== "running") await this.context.resume();
  }
  update(sound: Sound) {
    if (this.context && this.graph)
      updateGraph(this.context, this.graph, sound);
  }
}
