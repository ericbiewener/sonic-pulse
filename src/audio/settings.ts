export type PulseMode = "manual" | "random";

export interface PulseSettings {
  mode: PulseMode;
  bpm: number;
  pitch: number;
  volume: number;
  minBpm: number;
  maxBpm: number;
  minHold: number;
  maxHold: number;
  smooth: boolean;
  glide: number;
}

export const DEFAULT_SETTINGS: PulseSettings = {
  mode: "manual",
  bpm: 90,
  pitch: 40,
  volume: 100,
  minBpm: 60,
  maxBpm: 140,
  minHold: 4,
  maxHold: 10,
  smooth: true,
  glide: 3,
};

export const SETTINGS_KEY = "sonic-pulse:settings:v1";
export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function normalizeSettings(value: unknown): PulseSettings {
  const input =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const number = (key: keyof PulseSettings, min: number, max: number) => {
    const value = input[key];
    return typeof value === "number" && Number.isFinite(value)
      ? clamp(value, min, max)
      : (DEFAULT_SETTINGS[key] as number);
  };
  const minBpm = Math.round(number("minBpm", 30, 240));
  const maxBpm = Math.round(number("maxBpm", 30, 240));
  const minHold = number("minHold", 1, 120);
  const maxHold = number("maxHold", 1, 120);
  return {
    mode: input.mode === "random" ? "random" : "manual",
    bpm: Math.round(number("bpm", 30, 240)),
    pitch: Math.round(number("pitch", 40, 2000)),
    volume: number("volume", 0, 100),
    minBpm: Math.min(minBpm, maxBpm),
    maxBpm: Math.max(minBpm, maxBpm),
    minHold: Math.min(minHold, maxHold),
    maxHold: Math.max(minHold, maxHold),
    smooth:
      typeof input.smooth === "boolean"
        ? input.smooth
        : DEFAULT_SETTINGS.smooth,
    glide: number("glide", 0.25, 10),
  };
}

export function loadSettings(): PulseSettings {
  try {
    return normalizeSettings(
      JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null"),
    );
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function pitchNote(frequency: number): string {
  const note = Math.round(69 + 12 * Math.log2(frequency / 440));
  return `${["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"][((note % 12) + 12) % 12]}${Math.floor(note / 12) - 1}`;
}
