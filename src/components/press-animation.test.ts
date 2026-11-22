import { describe, expect, it } from "vitest";
import { springEasing } from "@/lib/spring";
import { pressEasing } from "./press-animation";

describe("press spring", () => {
  const points = pressEasing().slice(7, -1).split(", ").map(Number);
  it("starts at 0, ends at 1", () => {
    expect(points[0]).toBe(0);
    expect(points[points.length - 1]).toBe(1);
  });
  it("overshoots slightly, then settles (stiffness 550, damping 30)", () => {
    const peak = Math.max(...points);
    expect(peak).toBeGreaterThan(1.05);
    expect(peak).toBeLessThan(1.1);
    expect(Math.abs(points[points.length - 2] - 1)).toBeLessThan(0.01);
  });
  it("is quick: most of the way there in a fifth of a second", () => {
    expect(points[Math.round((0.12 / 0.35) * 40)]).toBeGreaterThan(0.9);
  });
});

describe("login code springs", () => {
  const curve = (k: number, d: number, t: number) => springEasing(k, d, t).slice(7, -1).split(", ").map(Number);
  it("characters grow in without overshooting (500/45), mostly in by 175ms", () => {
    const pts = curve(500, 45, 0.32);
    expect(Math.max(...pts)).toBeLessThanOrEqual(1);
    expect(pts[Math.round((0.175 / 0.32) * 40)]).toBeGreaterThan(0.88);
  });
  it("the ring barely overshoots (500/40)", () => {
    const peak = Math.max(...curve(500, 40, 0.36));
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(1.01);
  });
});
