"use client";
import { useEffect, useRef, useState } from "react";

/** Width of an element, so SVG charts can draw at real size and keep text readable. */
export function useWidth<T extends HTMLElement>(initial = 880) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}
