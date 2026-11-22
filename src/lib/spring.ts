// A spring (a mass on a spring, mass 1) written as a CSS easing curve, so the browser can run it.
// Used by the button press (press-animation.tsx) and the login code boxes (login-form.tsx).

/** The spring's progress from 0 to 1 over `duration` seconds, as linear(...) points. */
export function springEasing(stiffness: number, damping: number, duration: number, steps = 40): string {
  const w0 = Math.sqrt(stiffness);
  const zeta = damping / (2 * w0);
  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * duration;
    let p: number;
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      p = 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t));
    } else {
      // critically damped (or a touch over): no overshoot
      p = 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    }
    points.push(i === steps ? "1" : p.toFixed(4));
  }
  return `linear(${points.join(", ")})`;
}

/** The spring, or a close cubic-bezier for browsers without linear() easing. */
export function springOrFallback(stiffness: number, damping: number, duration: number, fallback = "cubic-bezier(0.2, 0.8, 0.2, 1)"): string {
  return typeof CSS !== "undefined" && CSS.supports("animation-timing-function", "linear(0, 1)") ? springEasing(stiffness, damping, duration) : fallback;
}

export const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
