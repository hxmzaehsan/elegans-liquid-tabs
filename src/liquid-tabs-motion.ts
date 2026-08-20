import type { LiquidMoveOptions } from "./types.js";

export type LiquidTabsMoveOptions = Pick<
  LiquidMoveOptions,
  "springiness" | "wobble" | "stretch"
>;

export const DEFAULT_LIQUID_TABS_MOVE = {
  springiness: 0.1,
  wobble: 0.7,
  stretch: 0.8,
  trail: 0,
} as const satisfies LiquidMoveOptions;

export function liquidMoveForTravel(
  move: LiquidTabsMoveOptions | undefined,
  travel: number,
): LiquidMoveOptions {
  return { ...DEFAULT_LIQUID_TABS_MOVE, ...move, trail: 0, travel };
}

export function railOvershootForTravel(travel: number) {
  const clamped = Number.isFinite(travel)
    ? Math.min(1, Math.max(0, travel))
    : 0;
  return clamped * 6;
}

export function railScaleForWidth(overshoot: number, width: number) {
  if (!Number.isFinite(overshoot) || !Number.isFinite(width) || width <= 0) {
    return 1;
  }
  return 1 + Math.max(0, overshoot) / width;
}
