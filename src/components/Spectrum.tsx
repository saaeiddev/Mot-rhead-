import { useEffect, useRef } from "react";
import type { AudioEngine } from "../audio/engine";
export function Spectrum({
  engine,
  playing,
  reduced,
}: {
  engine: AudioEngine;
  playing: boolean;
  reduced: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const ctx = element.getContext("2d");
    if (!ctx) return;
    let frame = 0;
    let last = 0;
    const values = new Uint8Array(128);
    const render = (now: number) => {
      if (now - last < (reduced ? 250 : 33)) {
        frame = requestAnimationFrame(render);
        return;
      }
      last = now;
      const width = element.clientWidth;
      const height = element.clientHeight;
      const scale = Math.min(devicePixelRatio || 1, 2);
      if (
        element.width !== Math.round(width * scale) ||
        element.height !== Math.round(height * scale)
      ) {
        element.width = Math.round(width * scale);
        element.height = Math.round(height * scale);
      }
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (playing && engine.graph && !document.hidden)
        engine.graph.analyser.getByteFrequencyData(values);
      else values.fill(0);
      const count = 64;
      const gap = 3;
      const bar = Math.max(1, (width - gap * (count - 1)) / count);
      ctx.fillStyle = "#e9e9e9";
      for (let i = 0; i < count; i++) {
        const index = Math.min(
          127,
          Math.floor(Math.pow(i / (count - 1), 1.65) * 127),
        );
        const h = Math.max(2, (values[index] / 255) * (height - 4));
        ctx.globalAlpha = playing ? 0.45 + values[index] / 460 : 0.18;
        ctx.fillRect(i * (bar + gap), height - h, bar, h);
      }
      ctx.globalAlpha = 1;
      if (playing) frame = requestAnimationFrame(render);
    };
    render(300);
    return () => cancelAnimationFrame(frame);
  }, [engine, playing, reduced]);
  return (
    <canvas
      ref={canvas}
      className="spectrum"
      role="img"
      aria-label={
        playing ? "Live audio frequency spectrum" : "Audio spectrum paused"
      }
    />
  );
}
