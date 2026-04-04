import { useState, useEffect } from "react";

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
let isGlobalInstallable = false;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    isGlobalInstallable = true;
    window.dispatchEvent(new Event("pwa-prompt-ready"));
  });

  window.addEventListener("appinstalled", () => {
    globalDeferredPrompt = null;
    isGlobalInstallable = false;
    window.dispatchEvent(new Event("pwa-installed"));
  });
}

export function usePWAInstall() {
  const [isInstallable, setIsInstallable] = useState(isGlobalInstallable);
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    );
  });

  useEffect(() => {
    if (globalDeferredPrompt) {
      setIsInstallable(true);
    }

    const handleReady = () => setIsInstallable(true);
    const handleInstalled = () => {
      setIsInstallable(false);
      setIsInstalled(true);
    };

    window.addEventListener("pwa-prompt-ready", handleReady);
    window.addEventListener("pwa-installed", handleInstalled);

    return () => {
      window.removeEventListener("pwa-prompt-ready", handleReady);
      window.removeEventListener("pwa-installed", handleInstalled);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    if (!globalDeferredPrompt) return false;

    try {
      await globalDeferredPrompt.prompt();
      const { outcome } = await globalDeferredPrompt.userChoice;
      
      if (outcome === "accepted") {
        globalDeferredPrompt = null;
        isGlobalInstallable = false;
        window.dispatchEvent(new Event("pwa-installed"));
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      if (globalDeferredPrompt) {
        globalDeferredPrompt = null;
        isGlobalInstallable = false;
        setIsInstallable(false);
      }
    }
  };

  return { isInstallable, isInstalled, install };
}