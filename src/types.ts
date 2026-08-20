export type LiquidMotionPreset = "poised" | "silk" | "snap";

export type LiquidMovePhysics = {
  positionStiffness: number;
  positionDamping: number;
  sizeStiffness: number;
  sizeDamping: number;
  tailStiffness: number;
  tailDamping: number;
  maxStretch: number;
  maxTailDistance: number;
  tailRadius: number;
  settleDistance: number;
  settleVelocity: number;
  controlDuration: number;
  controlStiffness: number;
  controlDamping: number;
};

export type LiquidMoveOptions = {
  springiness?: number;
  wobble?: number;
  stretch?: number;
  trail?: number;
  /** Normalized travel distance. Liquid Tabs supplies this automatically. */
  travel?: number;
  advanced?: Partial<LiquidMovePhysics>;
};

export type LiquidShadow = {
  x?: number;
  y?: number;
  blur?: number;
  color: string;
  opacity?: number | string;
};

export type LiquidSize = {
  width: number;
  height: number;
};
