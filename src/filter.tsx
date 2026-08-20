import { Fragment } from "react";
import type { LiquidShadow, LiquidSize } from "./types";

type LiquidFilterProps = {
  id: string;
  blur: number;
  contrast: number;
  fill: string;
  edgeHighlight?: string;
  edgeShade?: string;
  shadows: readonly LiquidShadow[];
  padding: number;
  size: LiquidSize;
};

export function LiquidFilter({
  id,
  blur,
  contrast,
  fill,
  edgeHighlight,
  edgeShade,
  shadows,
  padding,
  size,
}: LiquidFilterProps) {
  const slope = Math.max(1, contrast);
  // A 50% threshold keeps a lone filtered shape aligned to its measured DOM
  // edge. The blur can still bridge nearby moving shapes, but it no longer
  // inflates the resting silhouette beyond the tab it mirrors.
  const alphaThreshold = 0.5;
  const intercept = 0.5 - slope * alphaThreshold;

  return (
    <filter
      id={id}
      x={-padding}
      y={-padding}
      width={Math.max(1, size.width + padding * 2)}
      height={Math.max(1, size.height + padding * 2)}
      filterUnits="userSpaceOnUse"
      colorInterpolationFilters="sRGB"
    >
      <feGaussianBlur in="SourceAlpha" stdDeviation={blur} result="liquid-soft" />
      <feColorMatrix
        in="liquid-soft"
        type="matrix"
        values={`1 0 0 0 0
                 0 1 0 0 0
                 0 0 1 0 0
                 0 0 0 ${slope} ${intercept}`}
        result="liquid-alpha"
      />
      <feComposite
        in="SourceAlpha"
        in2="liquid-alpha"
        operator="over"
        result="liquid-shape"
      />

      {shadows.map((shadow, index) => {
        const shadowBlur = Math.max(0, shadow.blur ?? 6) / 2;
        return (
          <Fragment key={`${index}-${shadow.color}`}>
            <feGaussianBlur
              in="liquid-shape"
              stdDeviation={shadowBlur}
              result={`shadow-soft-${index}`}
            />
            <feOffset
              in={`shadow-soft-${index}`}
              dx={shadow.x ?? 0}
              dy={shadow.y ?? 2}
              result={`shadow-offset-${index}`}
            />
            <feFlood
              floodColor={shadow.color}
              floodOpacity={shadow.opacity ?? 1}
              result={`shadow-color-${index}`}
            />
            <feComposite
              in={`shadow-color-${index}`}
              in2={`shadow-offset-${index}`}
              operator="in"
              result={`shadow-${index}`}
            />
          </Fragment>
        );
      })}

      <feFlood floodColor={fill} result="liquid-color" />
      <feComposite
        in="liquid-color"
        in2="liquid-shape"
        operator="in"
        result="liquid-fill"
      />

      {edgeShade ? (
        <>
          <feOffset in="liquid-shape" dy={-1} result="edge-shade-shift" />
          <feComposite
            in="liquid-shape"
            in2="edge-shade-shift"
            operator="out"
            result="edge-shade-mask"
          />
          <feFlood floodColor={edgeShade} result="edge-shade-color" />
          <feComposite
            in="edge-shade-color"
            in2="edge-shade-mask"
            operator="in"
            result="edge-shade"
          />
        </>
      ) : null}

      {edgeHighlight ? (
        <>
          <feOffset in="liquid-shape" dy={1} result="edge-light-shift" />
          <feComposite
            in="liquid-shape"
            in2="edge-light-shift"
            operator="out"
            result="edge-light-mask"
          />
          <feFlood floodColor={edgeHighlight} result="edge-light-color" />
          <feComposite
            in="edge-light-color"
            in2="edge-light-mask"
            operator="in"
            result="edge-light"
          />
        </>
      ) : null}

      <feMerge>
        {shadows.map((_, index) => (
          <feMergeNode key={index} in={`shadow-${index}`} />
        ))}
        <feMergeNode in="liquid-fill" />
        {edgeShade ? <feMergeNode in="edge-shade" /> : null}
        {edgeHighlight ? <feMergeNode in="edge-light" /> : null}
      </feMerge>
    </filter>
  );
}
