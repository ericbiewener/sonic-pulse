import { useEffect, useRef, useState } from "react";
import type { PulseSnapshot } from "./pulse-synth";
import workletUrl from "./pulse-worklet.ts?worker&url";
import type { PulseSettings } from "./settings";

type PlaybackStatus = "stopped" | "starting" | "playing" | "interrupted";

export function usePulse(settings: PulseSettings) {
  const [status, setStatus] = useState<PlaybackStatus>("stopped");
  const [snapshot, setSnapshot] = useState<PulseSnapshot | null>(null);
  const [error, setError] = useState("");
  const context = useRef<AudioContext | null>(null);
  const node = useRef<AudioWorkletNode | null>(null);
  const outputGain = useRef<GainNode | null>(null);
  const latestSettings = useRef(settings);
  const generation = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    latestSettings.current = settings;
    node.current?.port.postMessage({ type: "settings", settings });
  }, [settings]);

  useEffect(
    () => () => {
      generation.current++;
      const current = context.current;
      if (current) {
        current.onstatechange = null;
        void current.close().catch(() => {});
      }
      node.current?.port.close();
      node.current?.disconnect();
    },
    [],
  );

  async function stop() {
    generation.current++;
    const current = context.current;
    const currentNode = node.current;
    context.current = null;
    node.current = null;
    if (current) {
      current.onstatechange = null;
      // Let the final pulse fade out instead of cutting a waveform mid-cycle.
      outputGain.current?.gain.setTargetAtTime(0, current.currentTime, 0.005);
      await new Promise((resolve) => setTimeout(resolve, 30));
      await current.close().catch(() => {});
    }
    currentNode?.port.close();
    currentNode?.disconnect();
    outputGain.current = null;
    setStatus("stopped");
  }

  async function toggle() {
    if (busy.current) return;
    busy.current = true;
    setError("");
    try {
      if (status === "playing") {
        await stop();
        return;
      }
      if (status === "interrupted" && context.current) {
        await context.current.resume();
        if (context.current.state !== "running")
          throw new Error(
            "Audio is still paused by your device. Try again when audio is available.",
          );
        setStatus("playing");
        return;
      }
      if (!window.AudioContext || !window.isSecureContext) {
        throw new Error(
          "Audio needs a browser with Web Audio support, on HTTPS or localhost.",
        );
      }
      setStatus("starting");
      const currentGeneration = ++generation.current;
      const current = new AudioContext({ latencyHint: "interactive" });
      context.current = current;
      // Resume immediately inside the user gesture, before loading the worklet.
      const resumed = current.resume();
      if (!current.audioWorklet)
        throw new Error(
          "This browser does not support audio worklets. Try a current version of Chrome, Firefox, or Safari.",
        );
      await Promise.all([resumed, current.audioWorklet.addModule(workletUrl)]);
      if (currentGeneration !== generation.current) {
        await current.close().catch(() => {});
        return;
      }
      const pulse = new AudioWorkletNode(current, "sonic-pulse", {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        processorOptions: latestSettings.current,
      });
      node.current = pulse;
      const gain = current.createGain();
      outputGain.current = gain;
      pulse.connect(gain).connect(current.destination);
      pulse.port.onmessage = (event: MessageEvent<PulseSnapshot>) => {
        if (currentGeneration !== generation.current) return;
        setSnapshot(event.data);
        pulse.port.postMessage({ type: "ack" });
      };
      pulse.onprocessorerror = () => {
        setError(
          "The audio engine stopped unexpectedly. Start the pulse to try again.",
        );
        void stop();
      };
      current.onstatechange = () => {
        if (currentGeneration === generation.current) {
          setStatus(current.state === "running" ? "playing" : "interrupted");
        }
      };
      setStatus(current.state === "running" ? "playing" : "interrupted");
    } catch (error) {
      await stop();
      setError(
        error instanceof Error
          ? error.message
          : "Could not start audio. Please try again.",
      );
    } finally {
      busy.current = false;
    }
  }

  return { status, snapshot, error, toggle };
}
