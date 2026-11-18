export function PulseDial({ bpm, playing, phase, mode, range }: {
  bpm: number; playing: boolean; phase: number; mode: 'manual' | 'random'; range?: [number, number]
}) {
  return <div className={`pulse-dial ${playing ? 'is-playing' : ''}`}>
    <div className="dial-halo" style={{ opacity: playing ? 0.18 + (1 - phase) * 0.12 : 0.1 }} />
    <svg className="dial-ticks" viewBox="0 0 320 320" aria-hidden="true">
      <circle cx="160" cy="160" r="120" className="dial-inner-ring" />
      {Array.from({ length: 72 }, (_, index) => {
        const angle = index / 72 * Math.PI * 2 - Math.PI / 2
        const inner = index % 6 === 0 ? 137 : 143
        const active = playing && index / 72 <= phase
        return <line key={index} x1={160 + Math.cos(angle) * inner} y1={160 + Math.sin(angle) * inner}
          x2={160 + Math.cos(angle) * 150} y2={160 + Math.sin(angle) * 150}
          className={active ? 'tick active' : 'tick'} />
      })}
      <circle cx="160" cy="40" r="4" className="dial-marker"
        transform={`rotate(${playing ? phase * 360 : 0} 160 160)`} />
    </svg>
    <div className="dial-center">
      <span className="eyebrow">{range ? 'TEMPO RANGE' : playing ? 'CURRENT TEMPO' : 'YOUR TEMPO'}</span>
      <output className={`bpm-value ${range ? 'tempo-range' : ''}`} aria-label="Current tempo">{range ? `${range[0]}–${range[1]}` : Math.round(bpm)}</output>
      <span className="bpm-unit">beats per minute</span>
      <span className="dial-mode"><i />{mode === 'manual' ? 'Steady rhythm' : 'Evolving rhythm'}</span>
    </div>
  </div>
}
