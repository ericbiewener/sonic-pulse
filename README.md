# Sonic Pulse

A static React + TypeScript app for an endless pulsing rhythm. Built with Vite; audio is synthesized locally with the Web Audio API. No backend, accounts, audio downloads, or API keys are required. Fonts are bundled with the site.

## Run locally

Use Node **26.12.0** (pinned in `.nvmrc`) and **pnpm 12.21.0**. Other Node versions supported by the Cloudflare CLI are listed in `package.json`.

```sh
fnm use
pnpm install
pnpm dev
```

Open the URL Vite prints, then click **Start pulse**. Browsers require a user gesture to start audio. HTTPS or localhost is required for AudioWorklet.

## Controls

- **Manual:** choose 30–240 BPM with the slider, number field, +/- buttons, or Tap tempo. Tempo stays fixed until you change it.
- **Random:** set minimum/maximum BPM and a hold interval of 1–120 seconds. Each tempo is selected uniformly within the range, excluding the previous tempo when possible. Each hold interval is selected independently within its range. Equal endpoints are supported.
- **Smooth transitions:** after holding a tempo, glide to the next one over 0.25–10 seconds. The full hold interval begins after the glide finishes. With smoothing off, tempo changes instantly after the hold.
- **Pitch:** choose 40–2,000 Hz, enter a frequency directly, or use the 220/440/880 Hz presets.
- **Volume:** adjust or mute without stopping the rhythm.

Number fields apply on Enter or blur, and clamp to valid limits. Crossing one endpoint moves the other endpoint to maintain a valid range. All controls work during playback. Switching to Manual retains the currently playing tempo. Changing random timing settings begins a new hold; changing pitch or volume preserves the current hold/glide.

Settings are saved in localStorage. Playback never starts automatically on a reload.

## Continuous playback

The rhythm, random hold timing, tempo interpolation, oscillator, and pulse envelope run inside an **AudioWorklet**, not JavaScript timers on the page. Playback has no duration limit and is independent of UI rendering and background timer throttling. Status messages use acknowledgments so a paused main thread cannot accumulate an unlimited message queue.

The page must remain open. An operating system or browser may suspend audio during device sleep, mobile screen lock, or power saving. The app shows **Resume pulse** when the audio context is suspended. It cannot override device-level suspension.

## Checks

```sh
pnpm check          # TypeScript and audio-engine tests
pnpm build          # Production files in dist/
pnpm test:e2e       # Production browser tests; run build first
pnpm deploy:check  # Build and Cloudflare deployment dry run; does not publish
```

Browser tests use installed Google Chrome with desktop and mobile viewports. If Chrome is unavailable, install it with `pnpm exec playwright install chrome`. Tests check real audio samples, continuity while the UI thread is blocked, tempo transitions, mute, restart, interruption recovery, persistence, input bounds, and layout overflow. Engine tests include an hour of simulated continuous playback.

## Cloudflare

This project uses the **cf CLI**, with its version pinned in `package.json`, and an assets-only Worker configured in [`cloudflare.config.ts`](cloudflare.config.ts). It deploys the prebuilt `dist/` directory without server code or resource bindings.

```sh
cf auth login       # Only needed when this machine is not already authenticated
pnpm deploy:check   # Validate the static deployment
pnpm deploy         # Publish sonic-pulse to the authenticated Cloudflare account
```

On this machine, Cloudflare skills are installed in `~/.agents/skills`, the MCP server is registered in `~/.codex-personal/config.toml`, and both MCP and CLI OAuth login are complete. Restart Codex to load the newly registered MCP server. The user-level instruction to prefer `cf` is in `~/.codex-personal/AGENTS.md`. Credentials are stored by the tools outside this repository.

For Cloudflare Workers Builds, use `pnpm build` as the build command and `pnpm exec cf deploy ./dist` as the deploy command. Use Node 26.12.0 and the committed pnpm lockfile. Supply Cloudflare credentials through the hosting service or CI secrets when needed; do not put them in frontend environment variables. See [Cloudflare agent setup](https://developers.cloudflare.com/agent-setup/prompt.md) and [static directory deployments](https://developers.cloudflare.com/cf/projects/#deploy-a-static-assets-directory).

## Code map

- `src/audio/pulse-synth.ts`: deterministic, independently testable pulse synthesis and tempo timing.
- `src/audio/pulse-worklet.ts`: audio-thread rendering and bounded status reporting.
- `src/audio/use-pulse.ts`: browser audio lifecycle, live updates, interruption handling, and cleanup.
- `src/audio/settings.ts`: defaults, validation, persistence loading, and pitch-note labels.
- `src/App.tsx`, `src/components/`, `src/styles.css`: responsive controls and pulse display.

Production assets are ordinary static files and can also be served by any HTTPS static host.
