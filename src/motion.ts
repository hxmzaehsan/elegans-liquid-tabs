import type {
  LiquidMotionPreset,
  LiquidMoveOptions,
  LiquidMovePhysics,
} from "./types";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const mix = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;
const smoothstep = (value: number) => {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
};

type PresetControls = Required<
  Omit<LiquidMoveOptions, "advanced" | "travel">
> & {
  duration: number;
};

const PRESET_CONTROLS: Record<LiquidMotionPreset, PresetControls> = {
  poised: {
    springiness: 0.7,
    wobble: 0.42,
    stretch: 0.7,
    trail: 0.56,
    duration: 420,
  },
  silk: {
    springiness: 0.48,
    wobble: 0.14,
    stretch: 0.5,
    trail: 0.58,
    duration: 460,
  },
  snap: {
    springiness: 0.9,
    wobble: 0.06,
    stretch: 0.2,
    trail: 0.12,
    duration: 260,
  },
};

function dampingFor(stiffness: number, wobble: number) {
  const dampingRatio = mix(1.04, 0.68, clamp01(wobble));
  return 2 * Math.sqrt(stiffness) * dampingRatio;
}

function positionDampingFor(stiffness: number, wobble: number) {
  const dampingRatio = mix(0.88, 0.54, clamp01(wobble));
  return 2 * Math.sqrt(stiffness) * dampingRatio;
}

export function normalizedTravelForIndexes(
  currentIndex: number,
  nextIndex: number,
  itemCount: number,
) {
  const steps = Math.abs(nextIndex - currentIndex);
  const expressiveSteps = Math.max(1, itemCount - 2);
  return clamp01((steps - 1) / expressiveSteps);
}

export function normalizedTravelForSelection<T>(
  previousIndex: number,
  value: T,
  items: readonly T[],
) {
  return normalizedTravelForIndexes(
    previousIndex,
    items.indexOf(value),
    items.length,
  );
}

export function selectionSignature<T extends string>(
  value: T,
  items: readonly T[],
) {
  return JSON.stringify([value, items]);
}

export function resolveTailBridgeGeometry(
  _lag: number,
  tailRadius: number,
  tailActivity: number,
) {
  const activity = clamp01(tailActivity);
  return {
    originRadiusX: tailRadius * mix(1.05, 1.35, activity),
    originRadiusY: tailRadius,
    neckHalfWidth: Math.min(
      4.8,
      Math.max(0.65, tailRadius * mix(0.38, 0.68, activity)),
    ),
  };
}

export function resolveMovePhysics(
  preset: LiquidMotionPreset,
  options?: LiquidMoveOptions,
): LiquidMovePhysics {
  const base = PRESET_CONTROLS[preset];
  const springiness = clamp01(options?.springiness ?? base.springiness);
  const wobble = clamp01(options?.wobble ?? base.wobble);
  const stretch = clamp01(options?.stretch ?? base.stretch);
  const trail = clamp01(options?.trail ?? base.trail);
  const travel = smoothstep(options?.travel ?? 1);

  const positionStiffness =
    mix(150, 520, springiness) * mix(1.35, 1, travel);
  const sizeStiffness = positionStiffness * mix(0.68, 0.9, springiness);
  const tailStiffness =
    positionStiffness * mix(0.72, 0.2, trail) * mix(1.15, 0.28, travel);
  const baseControlStiffness = mix(170, 470, springiness);

  const resolved: LiquidMovePhysics = {
    positionStiffness,
    positionDamping: positionDampingFor(positionStiffness, wobble),
    sizeStiffness,
    sizeDamping: dampingFor(sizeStiffness, wobble * 0.45),
    tailStiffness,
    tailDamping: dampingFor(tailStiffness, Math.min(0.16, wobble * 0.55)),
    maxStretch: mix(0.035, 0.28, stretch) * mix(0.45, 1.4, travel),
    maxTailDistance: mix(24, 92, trail) * mix(0.25, 3.6, travel),
    tailRadius: mix(0, 0.34, trail) * mix(0.25, 4.2, travel),
    settleDistance: 0.12,
    settleVelocity: 2.8,
    controlDuration: Math.round(mix(150, base.duration, travel)),
    controlStiffness: baseControlStiffness * mix(1.3, 1, travel),
    controlDamping: dampingFor(
      baseControlStiffness * mix(1.3, 1, travel),
      wobble * 0.8,
    ),
  };

  return { ...resolved, ...options?.advanced };
}

export function stepSpring(
  value: number,
  velocity: number,
  target: number,
  seconds: number,
  stiffness: number,
  damping: number,
) {
  const acceleration = stiffness * (target - value) - damping * velocity;
  const nextVelocity = velocity + acceleration * seconds;
  return [value + nextVelocity * seconds, nextVelocity] as const;
}

export function isSpringStill(
  error: number,
  velocity: number,
  distanceEpsilon: number,
  velocityEpsilon: number,
) {
  return Math.abs(error) <= distanceEpsilon && Math.abs(velocity) <= velocityEpsilon;
}

export function createSpringLinearEasing(
  stiffness: number,
  damping: number,
  durationMs: number,
  samples = 42,
) {
  let value = 0;
  let velocity = 0;
  const points = [0];
  const frameSeconds = durationMs / Math.max(1, samples - 1) / 1000;
  const substeps = 4;

  for (let sample = 1; sample < samples; sample += 1) {
    for (let step = 0; step < substeps; step += 1) {
      [value, velocity] = stepSpring(
        value,
        velocity,
        1,
        frameSeconds / substeps,
        stiffness,
        damping,
      );
    }
    points.push(value);
  }

  const finalValue = points.at(-1) || 1;
  const normalized = points.map((point, index) => {
    if (index === points.length - 1) return "1";
    return (point / finalValue).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  });

  return `linear(${normalized.join(", ")})`;
}

export function controlMotionFor(
  preset: LiquidMotionPreset,
  reduced = false,
  travel = 1,
) {
  const physics = resolveMovePhysics(preset, { travel });
  return {
    duration: reduced ? 0 : physics.controlDuration,
    easing: reduced
      ? "linear"
      : createSpringLinearEasing(
          physics.controlStiffness,
          physics.controlDamping,
          physics.controlDuration,
        ),
  };
}
