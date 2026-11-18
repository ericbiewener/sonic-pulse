import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function InstallApp() {
  const [installed, setInstalled] = useState(isStandalone);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const onDisplayChange = () => setInstalled(isStandalone());
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    displayMode.addEventListener("change", onDisplayChange);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => {
      displayMode.removeEventListener("change", onDisplayChange);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    setPrompt(null);
    try {
      await prompt.prompt();
    } catch {
      // Browser menus remain available if the native prompt cannot be shown.
    }
  }

  if (installed) return null;

  return (
    <footer className="install-app">
      {prompt && (
        <button
          type="button"
          className="install-button"
          onClick={() => void install()}
        >
          Install Sonic Pulse
        </button>
      )}
      <details>
        <summary>Add to home screen</summary>
        <p>
          <strong>iPhone or iPad:</strong> open in Safari, tap Share, then Add
          to Home Screen. Keep Open as Web App enabled if shown, then tap Add.
        </p>
        <p>
          <strong>Android:</strong> open in Chrome, then choose Install app or
          Add to Home screen from the browser menu.
        </p>
      </details>
    </footer>
  );
}
