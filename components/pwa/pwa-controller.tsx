"use client";

import { useEffect } from "react";

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

const serviceWorkerPath = "/sw.js";

export function PwaController() {
  useEffect(() => {
    const displayModes = [
      window.matchMedia("(display-mode: standalone)"),
      window.matchMedia("(display-mode: fullscreen)"),
      window.matchMedia("(display-mode: minimal-ui)"),
    ];

    const setDisplayMode = () => {
      const isStandalone =
        displayModes.some((query) => query.matches) ||
        (navigator as NavigatorWithStandalone).standalone === true;

      document.documentElement.dataset.displayMode = isStandalone
        ? "standalone"
        : "browser";
    };

    setDisplayMode();
    displayModes.forEach((query) => {
      query.addEventListener("change", setDisplayMode);
    });

    return () => {
      displayModes.forEach((query) => {
        query.removeEventListener("change", setDisplayMode);
      });
    };
  }, []);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator) ||
      !window.isSecureContext
    ) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register(
          serviceWorkerPath,
          { scope: "/" },
        );

        await registration.update();
      } catch (error) {
        console.warn("Nodi service worker registration failed.", error);
      }
    };

    if (document.readyState === "complete") {
      void registerServiceWorker();
      return;
    }

    window.addEventListener("load", registerServiceWorker, { once: true });

    return () => {
      window.removeEventListener("load", registerServiceWorker);
    };
  }, []);

  return null;
}
