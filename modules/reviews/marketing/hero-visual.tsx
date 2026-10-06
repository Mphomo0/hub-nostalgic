"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { HeroFallback } from "./hero-fallback";

// The 3D scene (three.js) is only downloaded when we decide to show it.
const HeroScene = dynamic(() => import("./hero-scene"), { ssr: false });

/** Decide whether this device should get the 3D scene. */
function canUse3D() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return false;
  if ((nav.deviceMemory ?? 8) < 4 || (nav.hardwareConcurrency ?? 8) < 4) return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function HeroVisual() {
  const [show3D, setShow3D] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Wait until the page content has loaded and the browser is idle.
    const start = () => canUse3D() && setShow3D(true);
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(start, { timeout: 2500 });
    else setTimeout(start, 1200);
  }, []);

  return (
    <div className="relative mx-auto aspect-[9/11] w-full max-w-md">
      <HeroFallback className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${ready ? "opacity-0" : "opacity-100"}`} />
      {show3D && (
        <div className={`absolute inset-0 transition-opacity duration-700 ${ready ? "opacity-100" : "opacity-0"}`} aria-hidden="true">
          <HeroScene onReady={() => setReady(true)} />
        </div>
      )}
    </div>
  );
}
