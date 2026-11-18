import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, normalizeSettings, pitchNote } from './settings'
import { PulseSynth } from './pulse-synth'

const RATE = 8000
function renderSeconds(synth: PulseSynth, seconds: number) {
  const output = new Float32Array(Math.round(seconds * RATE))
  synth.render(output)
  return output
}

describe('audio output', () => {
  it('produces the requested number of evenly spaced pulses and silence between them', () => {
    const synth = new PulseSynth(RATE, { ...DEFAULT_SETTINGS, bpm: 120, volume: 100 })
    const audio = renderSeconds(synth, 10)
    let pulses = 0
    let lastAudible = -RATE
    for (let i = 0; i < audio.length; i++) {
      if (Math.abs(audio[i]) > 0.001) {
        if (i - lastAudible > RATE * 0.2) pulses++
        lastAudible = i
      }
    }
    expect(pulses).toBe(20)
    expect(audio.slice(RATE * 0.2, RATE * 0.4).every(sample => sample === 0)).toBe(true)
    expect(audio.every(sample => Number.isFinite(sample) && Math.abs(sample) <= 0.5)).toBe(true)
  })

  it('renders the selected sine frequency, and pitch changes do not change tempo', () => {
    const synth = new PulseSynth(RATE, { ...DEFAULT_SETTINGS, bpm: 60, pitch: 440 })
    const audio = renderSeconds(synth, 1)
    let crossings = 0
    for (let i = 1; i < RATE * 0.1; i++) if (audio[i - 1] <= 0 && audio[i] > 0) crossings++
    expect(crossings).toBeCloseTo(44, 0)
    synth.update({ ...DEFAULT_SETTINGS, bpm: 60, pitch: 880 })
    renderSeconds(synth, 5)
    expect(synth.snapshot().bpm).toBe(60)
  })

  it('keeps running without main-thread callbacks and responds to manual changes', () => {
    const synth = new PulseSynth(RATE, { ...DEFAULT_SETTINGS, bpm: 60 })
    // Simulate an hour without retaining its samples or using any timers.
    const block = new Float32Array(RATE)
    for (let second = 0; second < 3600; second++) synth.render(block)
    expect(synth.snapshot().elapsed).toBe(3600)
    expect(synth.snapshot().beat).toBeGreaterThanOrEqual(3600)
    synth.update({ ...DEFAULT_SETTINGS, bpm: 180 })
    const before = synth.snapshot().beat
    renderSeconds(synth, 10)
    expect(synth.snapshot().beat - before).toBe(30)
    expect(block.some(sample => sample !== 0)).toBe(true)
  })

  it('mutes to silence while tempo and pulse counting continue', () => {
    const synth = new PulseSynth(RATE, { ...DEFAULT_SETTINGS, volume: 0 })
    expect(renderSeconds(synth, 2).every(sample => sample === 0)).toBe(true)
    expect(synth.snapshot().beat).toBe(3)
    synth.update({ ...DEFAULT_SETTINGS, volume: 60 })
    expect(renderSeconds(synth, 1).some(sample => sample !== 0)).toBe(true)
  })
})

describe('random tempo', () => {
  it('holds for the selected time and jumps immediately when smoothing is off', () => {
    const synth = new PulseSynth(RATE, { ...DEFAULT_SETTINGS, mode: 'random', minBpm: 60, maxBpm: 120, minHold: 2, maxHold: 2, smooth: false }, () => 0)
    expect(synth.snapshot().bpm).toBe(60)
    renderSeconds(synth, 2)
    expect(synth.snapshot().bpm).toBe(60)
    renderSeconds(synth, 0.01)
    expect(synth.snapshot().bpm).toBe(61)
    expect(synth.snapshot().stage).toBe('hold')
    expect(synth.snapshot().remaining).toBeCloseTo(1.99, 2)
  })

  it('glides continuously, then holds the target for the full hold interval', () => {
    const values = [0, 0, 0.999, 0]
    const synth = new PulseSynth(RATE, { ...DEFAULT_SETTINGS, mode: 'random', minBpm: 60, maxBpm: 120, minHold: 2, maxHold: 2, smooth: true, glide: 2 }, () => values.shift() ?? 0)
    renderSeconds(synth, 3)
    expect(synth.snapshot().stage).toBe('glide')
    expect(synth.snapshot().bpm).toBeCloseTo(90, 1)
    renderSeconds(synth, 1.01)
    expect(synth.snapshot().bpm).toBe(120)
    expect(synth.snapshot().stage).toBe('hold')
    expect(synth.snapshot().remaining).toBeCloseTo(1.99, 2)
  })

  it('keeps random tempos and hold durations in bounds across many transitions', () => {
    const synth = new PulseSynth(RATE, { ...DEFAULT_SETTINGS, mode: 'random', minBpm: 80, maxBpm: 110, minHold: 1, maxHold: 3, glide: 0.5 })
    const block = new Float32Array(RATE / 10)
    const stages = new Set<string>()
    for (let i = 0; i < 3000; i++) {
      synth.render(block)
      const state = synth.snapshot()
      stages.add(state.stage)
      expect(state.bpm).toBeGreaterThanOrEqual(80)
      expect(state.bpm).toBeLessThanOrEqual(110)
      expect(state.remaining).toBeLessThanOrEqual(state.stage === 'glide' ? 0.5 : 3)
    }
    expect(stages).toEqual(new Set(['hold', 'glide']))
  })

  it('supports equal range endpoints and live mode/range changes', () => {
    const synth = new PulseSynth(RATE, { ...DEFAULT_SETTINGS, mode: 'random', minBpm: 100, maxBpm: 100, minHold: 1, maxHold: 1 })
    renderSeconds(synth, 10)
    expect(synth.snapshot().bpm).toBe(100)
    synth.update({ ...DEFAULT_SETTINGS, mode: 'random', minBpm: 150, maxBpm: 160 })
    expect(synth.snapshot().bpm).toBe(150)
    synth.update({ ...DEFAULT_SETTINGS, mode: 'manual', bpm: 75 })
    renderSeconds(synth, 20)
    expect(synth.snapshot().bpm).toBe(75)
    expect(synth.snapshot().stage).toBe('steady')
  })

  it('does not restart the random hold when changing sound controls', () => {
    const settings = { ...DEFAULT_SETTINGS, mode: 'random' as const, minHold: 4, maxHold: 4 }
    const synth = new PulseSynth(RATE, settings)
    renderSeconds(synth, 1)
    const before = synth.snapshot()
    synth.update({ ...settings, pitch: 880, volume: 60 })
    expect(synth.snapshot()).toEqual(before)
  })
})

describe('settings', () => {
  it('repairs malformed storage, non-finite values, inverted ranges and out-of-range input', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    const settings = normalizeSettings({ bpm: NaN, pitch: -100, volume: Infinity, mode: 'invalid', minBpm: 240, maxBpm: 30, minHold: 50, maxHold: 2, smooth: 'false', glide: 0 })
    expect(settings).toEqual({ ...DEFAULT_SETTINGS, pitch: 40, minBpm: 30, maxBpm: 240, minHold: 2, maxHold: 50, glide: 0.25 })
    expect(pitchNote(440)).toBe('A4')
    expect(pitchNote(220)).toBe('A3')
  })
})
