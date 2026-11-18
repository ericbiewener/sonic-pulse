import { clamp, normalizeSettings, type PulseSettings } from './settings'

export interface PulseSnapshot {
  bpm: number
  targetBpm: number
  beat: number
  beatPhase: number
  elapsed: number
  stage: 'steady' | 'hold' | 'glide'
  remaining: number
  stageProgress: number
}

/** All rhythm timing lives in the audio rendering thread, independent of UI timers. */
export class PulseSynth {
  private settings: PulseSettings
  private bpm: number
  private targetBpm: number
  private fromBpm: number
  private beat = 0
  private beatPhase = 1
  private samples = 0
  private pulseAge = 1
  private oscillatorPhase = 0
  private frequency: number
  private gain = 0
  private stage: PulseSnapshot['stage'] = 'steady'
  private stageSamples = 0
  private stageDuration = 1
  private readonly smoothing: number

  constructor(
    private readonly sampleRate: number,
    settings: PulseSettings,
    private readonly random: () => number = Math.random,
  ) {
    this.settings = normalizeSettings(settings)
    this.bpm = this.settings.mode === 'manual' ? this.settings.bpm : this.pickBpm()
    this.targetBpm = this.bpm
    this.fromBpm = this.bpm
    this.frequency = this.settings.pitch
    this.smoothing = 1 - Math.exp(-1 / (0.01 * sampleRate))
    if (this.settings.mode === 'random') this.beginHold()
  }

  update(settings: PulseSettings): void {
    const next = normalizeSettings(settings)
    const previous = this.settings
    this.settings = next
    if (next.mode === 'manual') {
      this.bpm = next.bpm
      this.targetBpm = next.bpm
      this.stage = 'steady'
    } else if (
      previous.mode !== next.mode || previous.minBpm !== next.minBpm ||
      previous.maxBpm !== next.maxBpm || previous.minHold !== next.minHold ||
      previous.maxHold !== next.maxHold || previous.smooth !== next.smooth ||
      previous.glide !== next.glide
    ) {
      this.bpm = clamp(this.bpm, next.minBpm, next.maxBpm)
      this.targetBpm = this.bpm
      this.beginHold()
    }
  }

  private pickBpm(): number {
    const { minBpm, maxBpm } = this.settings
    // Exclude the current integer tempo so each new section is a real change.
    if (maxBpm === minBpm) return minBpm
    const current = Math.round(this.bpm)
    if (current >= minBpm && current <= maxBpm) {
      const candidate = minBpm + Math.floor(this.random() * (maxBpm - minBpm))
      return candidate >= current ? candidate + 1 : candidate
    }
    return minBpm + Math.floor(this.random() * (maxBpm - minBpm + 1))
  }

  private beginHold(): void {
    this.stage = 'hold'
    this.stageSamples = 0
    const duration = this.settings.minHold + this.random() * (this.settings.maxHold - this.settings.minHold)
    this.stageDuration = Math.max(1, Math.round(duration * this.sampleRate))
  }

  private advanceTempo(): void {
    if (this.stage === 'steady') return
    if (this.stageSamples >= this.stageDuration) {
      if (this.stage === 'glide') {
        this.bpm = this.targetBpm
        this.beginHold()
      } else {
        this.targetBpm = this.pickBpm()
        if (this.settings.smooth && this.targetBpm !== this.bpm) {
          this.fromBpm = this.bpm
          this.stage = 'glide'
          this.stageSamples = 0
          this.stageDuration = Math.max(1, Math.round(this.settings.glide * this.sampleRate))
        } else {
          this.bpm = this.targetBpm
          this.beginHold()
        }
      }
    }
    if (this.stage === 'glide') {
      const progress = this.stageSamples / this.stageDuration
      const eased = progress * progress * (3 - 2 * progress)
      this.bpm = this.fromBpm + (this.targetBpm - this.fromBpm) * eased
    }
    this.stageSamples++
  }

  render(output: Float32Array): void {
    for (let index = 0; index < output.length; index++) {
      this.advanceTempo()
      if (this.beatPhase >= 1) {
        this.beatPhase -= 1
        this.beat++
        this.pulseAge = 0
        this.oscillatorPhase = 0
      }

      this.frequency += (this.settings.pitch - this.frequency) * this.smoothing
      this.gain += (this.settings.volume / 100 * 0.5 - this.gain) * this.smoothing
      const duration = 0.12
      const envelope = this.pulseAge < duration
        ? Math.min(1, this.pulseAge / 0.005) * (1 - this.pulseAge / duration) ** 3
        : 0
      output[index] = Math.sin(this.oscillatorPhase * 2 * Math.PI) * envelope * this.gain
      this.oscillatorPhase = (this.oscillatorPhase + this.frequency / this.sampleRate) % 1
      this.pulseAge += 1 / this.sampleRate
      this.beatPhase += this.bpm / (60 * this.sampleRate)
      this.samples++
    }
  }

  snapshot(): PulseSnapshot {
    return {
      bpm: this.bpm,
      targetBpm: this.targetBpm,
      beat: this.beat,
      beatPhase: this.beatPhase % 1,
      elapsed: this.samples / this.sampleRate,
      stage: this.stage,
      remaining: this.stage === 'steady' ? 0 : Math.max(0, (this.stageDuration - this.stageSamples) / this.sampleRate),
      stageProgress: this.stage === 'steady' ? 0 : this.stageSamples / this.stageDuration,
    }
  }
}
