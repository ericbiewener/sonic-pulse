import { test, expect } from '@playwright/test'

test('plays real audio, changes tempo and pitch live, mutes, stops, and restarts', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  // Observe actual worklet samples through an AnalyserNode, without replacing the engine.
  await page.addInitScript(() => {
    const OriginalContext = window.AudioContext
    const capture = { contexts: [] as AudioContext[], analysers: [] as AnalyserNode[] }
    Object.assign(window, { __audioCapture: capture })
    window.AudioContext = class extends OriginalContext {
      constructor(options?: AudioContextOptions) {
        super(options)
        capture.contexts.push(this)
        const analyser = this.createAnalyser()
        analyser.fftSize = 8192
        capture.analysers.push(analyser)
        const createGain = this.createGain.bind(this)
        this.createGain = () => {
          const gain = createGain()
          gain.connect(analyser)
          return gain
        }
      }
    }
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Start pulse' }).click()
  await expect(page.getByRole('button', { name: 'Stop pulse' })).toBeVisible()
  await expect.poll(() => page.getByTestId('beat-count').textContent()).not.toBe('0000')
  const peak = () => page.evaluate(() => {
    const capture = (window as unknown as { __audioCapture: { analysers: AnalyserNode[] } }).__audioCapture
    const analyser = capture.analysers.at(-1)!
    const samples = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(samples)
    return Math.max(...samples.map(Math.abs))
  })
  await expect.poll(peak, { timeout: 5000 }).toBeGreaterThan(0.005)

  const tempo = page.getByRole('spinbutton', { name: 'Tempo in BPM' })
  await tempo.fill('150')
  await tempo.press('Enter')
  await expect(page.getByLabel('Current tempo')).toHaveText('150')
  await page.getByRole('button', { name: 'High 880 Hz' }).click()
  await expect(page.getByRole('spinbutton', { name: 'Pitch in Hz' })).toHaveValue('880')
  await expect(page.getByLabel('Current tempo')).toHaveText('150')
  await page.getByRole('button', { name: 'Mute audio', exact: true }).click()
  await expect.poll(peak).toBeLessThan(0.00001)
  await page.getByRole('button', { name: 'Unmute audio', exact: true }).click()
  await expect.poll(peak).toBeGreaterThan(0.005)

  // Audio rendering continues while the main thread is completely blocked.
  const before = Number(await page.getByTestId('beat-count').textContent())
  await page.evaluate(() => { const end = performance.now() + 1600; while (performance.now() < end) { /* Simulate a busy/background UI. */ } })
  await expect.poll(async () => Number(await page.getByTestId('beat-count').textContent())).toBeGreaterThanOrEqual(before + 3)
  await page.getByRole('button', { name: 'Stop pulse' }).click()
  await expect(page.getByRole('button', { name: 'Start pulse' })).toBeVisible()
  const stopped = await page.getByTestId('beat-count').textContent()
  await page.waitForTimeout(800)
  await expect(page.getByTestId('beat-count')).toHaveText(stopped!)
  await page.getByRole('button', { name: 'Start pulse' }).click()
  await expect(page.getByRole('button', { name: 'Stop pulse' })).toBeVisible()
  await expect.poll(peak).toBeGreaterThan(0.005)
  await page.getByRole('button', { name: 'Stop pulse' }).click()
  await expect(page.getByRole('button', { name: 'Start pulse' })).toBeVisible()
  const contextStates = await page.evaluate(() => (window as unknown as { __audioCapture: { contexts: AudioContext[] } }).__audioCapture.contexts.map(context => context.state))
  expect(contextStates).toEqual(['closed', 'closed'])
  expect(errors).toEqual([])
})

test('random tempo respects ranges, transitions live, and carries its tempo into manual mode', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Random', exact: true }).click()
  for (const [name, value] of [['Minimum tempo', '100'], ['Maximum tempo', '101'], ['Minimum hold', '1'], ['Maximum hold', '1']]) {
    const field = page.getByRole('spinbutton', { name, exact: true })
    await field.fill(value)
    await field.press('Enter')
  }
  await page.getByRole('switch', { name: 'Smooth transitions' }).click()
  await expect(page.getByRole('slider', { name: 'Glide time' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Start pulse' }).click()
  const current = page.getByLabel('Current tempo')
  await expect(current).toHaveText(/^(100|101)$/)
  const initial = await current.textContent()
  await expect.poll(() => current.textContent(), { timeout: 4000 }).not.toBe(initial)
  await expect(current).toHaveText(/^(100|101)$/)
  await page.getByRole('switch', { name: 'Smooth transitions' }).click()
  await expect(page.getByText(/Gliding to/)).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: 'Manual', exact: true }).click()
  const manualBpm = await current.textContent()
  await page.waitForTimeout(2000)
  await expect(current).toHaveText(manualBpm!)
  await expect(page.getByRole('button', { name: 'Stop pulse' })).toBeVisible()
})

test('persists settings without autoplay, validates numbers, and fits the viewport', async ({ page }) => {
  await page.goto('/')
  const pitch = page.getByRole('spinbutton', { name: 'Pitch in Hz' })
  await pitch.fill('2500')
  await pitch.press('Enter')
  await expect(pitch).toHaveValue('2000')
  const tempo = page.getByRole('spinbutton', { name: 'Tempo in BPM' })
  await tempo.fill('')
  await tempo.press('Enter')
  await expect(tempo).toHaveValue('90')
  await page.getByRole('button', { name: 'Random', exact: true }).click()
  await page.getByRole('spinbutton', { name: 'Minimum tempo', exact: true }).fill('200')
  await page.getByRole('spinbutton', { name: 'Minimum tempo', exact: true }).press('Enter')
  await expect(page.getByRole('spinbutton', { name: 'Maximum tempo', exact: true })).toHaveValue('200')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Random', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('spinbutton', { name: 'Pitch in Hz' })).toHaveValue('2000')
  await expect(page.getByRole('spinbutton', { name: 'Minimum tempo', exact: true })).toHaveValue('200')
  await expect(page.getByRole('button', { name: 'Start pulse' })).toBeVisible()
  await expect(page.getByTestId('beat-count')).toHaveText('0000')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('recovers from damaged settings and reports audio interruptions', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sonic-pulse:settings:v1', '{broken')
    const OriginalContext = window.AudioContext
    window.AudioContext = class extends OriginalContext {
      constructor(options?: AudioContextOptions) { super(options); Object.assign(window, { __context: this }) }
    }
  })
  await page.goto('/')
  await expect(page.getByRole('spinbutton', { name: 'Tempo in BPM' })).toHaveValue('90')
  await page.getByRole('button', { name: 'Start pulse' }).click()
  await expect(page.getByRole('button', { name: 'Stop pulse' })).toBeVisible()
  await page.evaluate(() => (window as unknown as { __context: AudioContext }).__context.suspend())
  await expect(page.getByRole('button', { name: 'Resume pulse' })).toBeVisible()
  await page.getByRole('button', { name: 'Resume pulse' }).click()
  await expect(page.getByRole('button', { name: 'Stop pulse' })).toBeVisible()
})
