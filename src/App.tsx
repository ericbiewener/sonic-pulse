import { useEffect, useRef, useState } from 'react'
import { clamp, loadSettings, normalizeSettings, pitchNote, SETTINGS_KEY, type PulseSettings } from './audio/settings'
import { usePulse } from './audio/use-pulse'
import { NumberField, Slider } from './components/Controls'
import { Icon } from './components/Icon'
import { PulseDial } from './components/PulseDial'

function formatTime(seconds: number) {
  const total = Math.floor(seconds)
  const minutes = Math.floor(total / 60)
  return `${minutes.toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`
}

export default function App() {
  const [settings, setSettings] = useState(loadSettings)
  const { status, snapshot, error, toggle } = usePulse(settings)
  const previousVolume = useRef(settings.volume || 35)
  const taps = useRef<number[]>([])
  const [tapCount, setTapCount] = useState(0)
  const playing = status === 'playing'
  const active = playing || status === 'interrupted'
  const bpm = active && snapshot ? snapshot.bpm : settings.mode === 'manual' ? settings.bpm : (settings.minBpm + settings.maxBpm) / 2

  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)) } catch { /* Audio still works when storage is unavailable. */ }
  }, [settings])

  function update(patch: Partial<PulseSettings>) {
    setSettings(current => normalizeSettings({ ...current, ...patch }))
  }

  function tapTempo() {
    const now = performance.now()
    const previous = taps.current.at(-1)
    taps.current = previous && now - previous < 2500 ? [...taps.current.slice(-5), now] : [now]
    setTapCount(taps.current.length)
    if (taps.current.length > 1) {
      const average = (now - taps.current[0]) / (taps.current.length - 1)
      update({ bpm: Math.round(clamp(60000 / average, 30, 240)) })
    }
  }

  function changeMode(mode: PulseSettings['mode']) {
    taps.current = []
    setTapCount(0)
    update({ mode, ...(mode === 'manual' && active && snapshot ? { bpm: Math.round(snapshot.bpm) } : {}) })
  }

  const stageDescription = !active ? (settings.mode === 'manual' ? 'A steady beat, at your pace.' : 'A new rhythm around every corner.')
    : settings.mode === 'manual' ? 'Steady, until you change it.'
    : snapshot?.stage === 'glide' ? `Gliding to ${Math.round(snapshot.targetBpm)} BPM`
    : `Next tempo in ${Math.ceil(snapshot?.remaining ?? 0)} seconds`

  return <div className="app-shell">
    <header className="site-header">
      <a href="/" className="brand" aria-label="Sonic Pulse home"><span className="brand-icon"><Icon name="pulse" size={25} /></span><span>sonic<span className="brand-light">pulse</span><span className="brand-period">.</span></span></a>
      <span className="header-caption">A SPACE FOR RHYTHM</span>
      <span className={`connection-status ${playing ? 'live' : ''}`}><i />{playing ? 'Audio is live' : status === 'interrupted' ? 'Audio paused' : 'Ready when you are'}</span>
    </header>

    <main>
      <section className="intro">
        <div><p className="eyebrow intro-eyebrow">LESS NOISE. MORE FLOW.</p><h1>Find your rhythm<span>.</span></h1><p className="intro-description">Set a pulse. Let it wander. Stay in the moment.</p></div>
        <div className="endless-note"><Icon name="infinity" size={24} /><span>No finish line.<br /><strong>Just your next beat.</strong></span></div>
      </section>

      <div className="instrument-grid">
        <section className="pulse-panel" aria-label="Pulse player">
          <div className="panel-topline"><span className="eyebrow">THE PULSE</span><span className="small-badge"><Icon name="infinity" size={15} /> CONTINUOUS</span></div>
          <PulseDial bpm={bpm} playing={playing} phase={snapshot?.beatPhase ?? 0} mode={settings.mode}
            range={!active && settings.mode === 'random' ? [settings.minBpm, settings.maxBpm] : undefined} />
          <div className="pulse-message"><span className={playing ? 'message-dot live' : 'message-dot'} />{stageDescription}</div>
          <div className="transport">
            <button className="play-button" onClick={() => void toggle()} disabled={status === 'starting'}>
              <Icon name={playing ? 'stop' : 'play'} size={23} />{status === 'starting' ? 'Starting audio…' : playing ? 'Stop pulse' : status === 'interrupted' ? 'Resume pulse' : 'Start pulse'}
            </button>
            <p className="transport-hint">{status === 'interrupted' ? 'Your device paused audio. Tap resume to continue.' : 'Your pulse keeps going until you stop it.'}</p>
          </div>
          {error && <p className="audio-error" role="alert">{error}</p>}
          <div className="session-stats">
            <div><span className="eyebrow">SESSION</span><span data-testid="session-time">{formatTime(snapshot?.elapsed ?? 0)}</span></div>
            <div><span className="eyebrow">PULSES</span><span data-testid="beat-count">{String(snapshot?.beat ?? 0).padStart(4, '0')}</span></div>
            <div><span className="eyebrow">SIGNAL</span><span className="signal-stat"><Icon name="wave" size={19} /> Sine</span></div>
          </div>
        </section>

        <div className="control-column">
          <section className="control-panel rhythm-panel" aria-labelledby="rhythm-heading">
            <div className="section-heading"><h2 id="rhythm-heading">Make it your rhythm</h2><span className="section-number">01</span></div>
            <div className="mode-picker" role="group" aria-label="Rhythm mode">
              <button aria-pressed={settings.mode === 'manual'} onClick={() => changeMode('manual')}><Icon name="sliders" size={17} />Manual</button>
              <button aria-pressed={settings.mode === 'random'} onClick={() => changeMode('random')}><Icon name="shuffle" size={17} />Random</button>
            </div>

            {settings.mode === 'manual' ? <div className="mode-content">
              <p className="section-description">You set the pace. It stays right there.</p>
              <div className="tempo-label"><label htmlFor="manual-tempo">Tempo</label><span className="unit-label">BPM</span></div>
              <div className="tempo-stepper">
                <button className="step-button" aria-label="Decrease tempo" disabled={settings.bpm <= 30} onClick={() => update({ bpm: settings.bpm - 1 })}>−</button>
                <ManualTempo value={settings.bpm} onChange={bpm => update({ bpm })} />
                <button className="step-button" aria-label="Increase tempo" disabled={settings.bpm >= 240} onClick={() => update({ bpm: settings.bpm + 1 })}>+</button>
              </div>
              <Slider label="Tempo" value={settings.bpm} min={30} max={240} onChange={bpm => update({ bpm })} unit=" BPM" left="30 BPM" right="240 BPM" />
              <button className="tap-button" onClick={tapTempo}>Tap tempo <span>{tapCount === 1 ? 'Tap again to set' : tapCount > 1 ? 'Keep tapping to refine' : 'Set it by feel'}<Icon name="arrow" size={15} /></span></button>
            </div> : <div className="mode-content random-content">
              <p className="section-description">Let your tempo explore a little.</p>
              <div className="control-label"><span>Tempo range</span><span className="unit-label">30–240 BPM</span></div>
              <div className="field-pair">
                <NumberField label="Minimum tempo" value={settings.minBpm} min={30} max={240} unit="BPM" onChange={minBpm => update({ minBpm, maxBpm: Math.max(minBpm, settings.maxBpm) })} />
                <span className="pair-divider">—</span>
                <NumberField label="Maximum tempo" value={settings.maxBpm} min={30} max={240} unit="BPM" onChange={maxBpm => update({ maxBpm, minBpm: Math.min(maxBpm, settings.minBpm) })} />
              </div>
              <div className="control-label hold-label"><span>Hold each tempo</span><span className="unit-label">1–120 SEC</span></div>
              <div className="field-pair">
                <NumberField label="Minimum hold" value={settings.minHold} min={1} max={120} step={0.5} unit="sec" onChange={minHold => update({ minHold, maxHold: Math.max(minHold, settings.maxHold) })} />
                <span className="pair-divider">—</span>
                <NumberField label="Maximum hold" value={settings.maxHold} min={1} max={120} step={0.5} unit="sec" onChange={maxHold => update({ maxHold, minHold: Math.min(maxHold, settings.minHold) })} />
              </div>
              <div className="transition-setting"><div><label htmlFor="smooth-toggle">Smooth transitions</label><p>{settings.smooth ? 'Ease into the next tempo.' : 'Jump straight to the next tempo.'}</p></div>
                <button id="smooth-toggle" className="switch" role="switch" aria-checked={settings.smooth} aria-label="Smooth transitions" onClick={() => update({ smooth: !settings.smooth })}><span /></button>
              </div>
              {settings.smooth && <div className="glide-control"><div className="control-label"><span>Glide time</span><output>{settings.glide} sec</output></div>
                <Slider label="Glide time" value={settings.glide} min={0.25} max={10} step={0.25} unit=" seconds" onChange={glide => update({ glide })} />
              </div>}
              <p className="random-explanation">Each tempo is held for a random interval{settings.smooth ? ', followed by a glide.' : ', then changes instantly.'}</p>
            </div>}
          </section>

          <section className="control-panel sound-panel" aria-labelledby="sound-heading">
            <div className="section-heading"><h2 id="sound-heading">Shape your sound</h2><span className="section-number">02</span></div>
            <div className="pitch-label"><label htmlFor="pitch-value">Pulse pitch</label><div><span className="note-badge">{pitchNote(settings.pitch)}</span><PitchInput value={settings.pitch} onChange={pitch => update({ pitch })} /><span className="unit-label">Hz</span></div></div>
            <Slider label="Pulse pitch" value={settings.pitch} min={40} max={2000} unit=" Hz" onChange={pitch => update({ pitch })} left="DEEP" right="BRIGHT" />
            <div className="pitch-presets" role="group" aria-label="Pitch presets">
              {([{ name: 'Low', pitch: 220 }, { name: 'Mid', pitch: 440 }, { name: 'High', pitch: 880 }]).map(preset => <button key={preset.name} aria-pressed={settings.pitch === preset.pitch} onClick={() => update({ pitch: preset.pitch })}>{preset.name}<span>{preset.pitch} Hz</span></button>)}
            </div>
            <div className="volume-control">
              <button className="mute-button" aria-label={settings.volume ? 'Mute audio' : 'Unmute audio'} aria-pressed={!settings.volume} onClick={() => { if (settings.volume) { previousVolume.current = settings.volume; update({ volume: 0 }) } else update({ volume: previousVolume.current }) }}><Icon name={settings.volume ? 'volume' : 'mute'} size={19} /></button>
              <Slider label="Volume" value={settings.volume} min={0} max={100} unit=" percent" onChange={volume => update({ volume })} />
              <output className="volume-value">{settings.volume}%</output>
            </div>
          </section>
        </div>
      </div>

      <footer className="app-footer"><span><span className="footer-dot" />A small tool for a little more focus.</span><details><summary>About continuous playback</summary><p>Audio runs continuously in either mode, including in background tabs. Keep this page open. Device sleep, mobile screen lock, or browser power saving may pause audio; tap Resume pulse if needed. Your settings are saved on this device.</p></details></footer>
    </main>
  </div>
}

function ManualTempo({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <InlineNumber id="manual-tempo" label="Tempo in BPM" value={value} min={30} max={240} onChange={onChange} />
}

function PitchInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return <InlineNumber id="pitch-value" label="Pitch in Hz" value={value} min={40} max={2000} onChange={onChange} />
}

function InlineNumber({ id, label, value, min, max, onChange }: { id: string; label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  return <input id={id} type="number" aria-label={label} value={draft} min={min} max={max}
    onChange={event => setDraft(event.target.value)} onBlur={() => { const next = draft.trim() && Number.isFinite(Number(draft)) ? clamp(Math.round(Number(draft)), min, max) : value; setDraft(String(next)); onChange(next) }}
    onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} />
}
