import { useEffect, useId, useState, type CSSProperties } from 'react'
import { clamp } from '../audio/settings'

export function Slider({ label, value, min, max, step = 1, onChange, unit = '', left, right }: {
  label: string; value: number; min: number; max: number; step?: number
  onChange: (value: number) => void; unit?: string; left?: string; right?: string
}) {
  const id = useId()
  return <div className="slider-control">
    <input id={id} aria-label={label} aria-valuetext={`${value}${unit}`} type="range"
      min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))}
      style={{ '--fill': `${(value - min) / (max - min) * 100}%` } as CSSProperties} />
    {(left || right) && <div className="range-captions" aria-hidden="true"><span>{left}</span><span>{right}</span></div>}
  </div>
}

export function NumberField({ label, value, min, max, step = 1, unit, onChange }: {
  label: string; value: number; min: number; max: number; step?: number
  unit: string; onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  const id = useId()
  useEffect(() => setDraft(String(value)), [value])

  function commit() {
    const parsed = Number(draft)
    const next = draft.trim() && Number.isFinite(parsed)
      ? clamp(Math.round(parsed / step) * step, min, max)
      : value
    setDraft(String(next))
    onChange(next)
  }

  return <div className="number-field">
    <label htmlFor={id}>{label}</label>
    <div className="number-input-wrap">
      <input id={id} type="number" min={min} max={max} step={step} value={draft}
        onChange={event => setDraft(event.target.value)} onBlur={commit}
        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} />
      <span>{unit}</span>
    </div>
  </div>
}
