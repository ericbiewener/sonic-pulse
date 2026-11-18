import { PulseSynth } from './pulse-synth'
import type { PulseSettings } from './settings'

declare const sampleRate: number
declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort
}
declare function registerProcessor(name: string, processor: new (options: { processorOptions: PulseSettings }) => AudioWorkletProcessor): void

class PulseProcessor extends AudioWorkletProcessor {
  private synth: PulseSynth
  private framesSinceReport = 0
  private reportPending = false

  constructor(options: { processorOptions: PulseSettings }) {
    super()
    this.synth = new PulseSynth(sampleRate, options.processorOptions)
    this.port.onmessage = (event: MessageEvent) => {
      if (event.data.type === 'settings') this.synth.update(event.data.settings)
      if (event.data.type === 'ack') this.reportPending = false
    }
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const output = outputs[0]?.[0]
    if (output) {
      this.synth.render(output)
      this.framesSinceReport += output.length
      // One outstanding report prevents message buildup in suspended/background tabs.
      if (!this.reportPending && this.framesSinceReport >= sampleRate / 30) {
        this.port.postMessage(this.synth.snapshot())
        this.reportPending = true
        this.framesSinceReport = 0
      }
    }
    return true
  }
}

registerProcessor('sonic-pulse', PulseProcessor)
