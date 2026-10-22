import { useEffect, useRef } from 'react'
type Props = { analyser: AnalyserNode | null; playing: boolean; compact?: boolean }
export default function Visualizer({ analyser, playing, compact = false }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let frame = 0
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
    let last = 0
    const draw = (timestamp: number) => {
      if (reduceMotion && timestamp - last < 90) { frame = requestAnimationFrame(draw); return }
      last = timestamp
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const width = canvas.clientWidth || 500
      const height = canvas.clientHeight || 180
      if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
        canvas.width = Math.round(width * ratio)
        canvas.height = Math.round(height * ratio)
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      ctx.clearRect(0, 0, width, height)
      if (data && playing && analyser) analyser.getByteFrequencyData(data)
      const count = compact ? 42 : 64
      const gap = compact ? 3 : 4
      const barWidth = Math.max(1, (width - (count - 1) * gap) / count)
      ctx.fillStyle = '#111111'
      for (let i = 0; i < count; i++) {
        const index = Math.min((data?.length || 1) - 1, Math.floor(Math.pow(i / count, 1.6) * (data?.length || 1) * 0.78))
        const intensity = data && playing ? data[index] / 255 : 0
        const h = Math.max(3, intensity * height * 0.88)
        ctx.fillRect(i * (barWidth + gap), (height - h) / 2, barWidth, h)
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [analyser, playing, compact])
  return <canvas ref={ref} className={'visualizer ' + (compact ? 'compact' : '')} role="img" aria-label={playing ? 'Live audio frequency spectrum' : 'Audio spectrum idle'} />
}
