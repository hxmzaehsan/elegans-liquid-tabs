"use client";

import {
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { LiquidContext, type LiquidRegistration } from "./context";
import { LiquidFilter } from "./filter";
import { LiquidSession, type LiquidSurfaceFrame } from "./session";
import type {
  LiquidMotionPreset,
  LiquidMoveOptions,
  LiquidShadow,
  LiquidSize,
} from "./types";

const EMPTY_SIZE: LiquidSize = { width: 1, height: 1 };

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return reduced;
}

type LiquidProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  blur?: number;
  contrast?: number;
  fill?: string;
  edgeHighlight?: string;
  edgeShade?: string;
  shadow?: LiquidShadow | readonly LiquidShadow[];
  filterPadding?: number;
  motion?: LiquidMotionPreset;
  reduced?: boolean;
  children?: ReactNode;
  onSurfaceFrame?: (frame: LiquidSurfaceFrame) => void;
};

export function LiquidRoot({
  blur = 7,
  contrast = 20,
  fill = "currentColor",
  edgeHighlight,
  edgeShade,
  shadow = {
    x: 0,
    y: 2,
    blur: 7,
    color: "rgba(0, 0, 0, 0.12)",
  },
  filterPadding = 28,
  motion = "poised",
  reduced: reducedProp = false,
  className,
  style,
  children,
  onSurfaceFrame,
  ...rest
}: LiquidProps) {
  const groupRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<SVGGElement>(null);
  const [session, setSession] = useState<LiquidSession | null>(null);
  const [size, setSize] = useState<LiquidSize>(EMPTY_SIZE);
  const prefersReducedMotion = usePrefersReducedMotion();
  const reduced = reducedProp || prefersReducedMotion;
  const filterId = `elegans-liquid-${useId().replaceAll(":", "")}`;
  const shadows = Array.isArray(shadow) ? shadow : [shadow];

  useLayoutEffect(() => {
    const group = groupRef.current;
    const layer = layerRef.current;
    if (!group || !layer) return;

    const nextSession = new LiquidSession({
      group,
      shapeLayer: layer,
      motion,
      reduced,
      onSurfaceFrame,
    });
    setSession(nextSession);

    const measure = () => {
      const rect = group.getBoundingClientRect();
      setSize((current) => {
        if (current.width === rect.width && current.height === rect.height) {
          return current;
        }
        return { width: rect.width, height: rect.height };
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(group);

    return () => {
      observer.disconnect();
      nextSession.dispose();
    };
    // The live session is updated by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => session?.setMotion(motion), [session, motion]);
  useLayoutEffect(() => session?.setReduced(reduced), [session, reduced]);
  useLayoutEffect(
    () => session?.setOnSurfaceFrame(onSurfaceFrame),
    [session, onSurfaceFrame],
  );

  const api = useMemo(
    () =>
      session
        ? {
            attach: (host: HTMLElement, move?: LiquidMoveOptions) =>
              session.attach(host, move),
            wake: () => session.wake(),
          }
        : null,
    [session],
  );

  return (
    <div
      {...rest}
      ref={groupRef}
      className={className}
      data-liquid-engine="svg-filter"
      style={{
        position: "relative",
        isolation: "isolate",
        overflow: "visible",
        ...style,
      } satisfies CSSProperties}
    >
      <svg
        className="elegans-liquid-silhouette"
        aria-hidden="true"
        width="100%"
        height="100%"
        viewBox={`0 0 ${Math.max(1, size.width)} ${Math.max(1, size.height)}`}
        preserveAspectRatio="none"
      >
        <defs>
          <LiquidFilter
            id={filterId}
            blur={blur}
            contrast={contrast}
            fill={fill}
            edgeHighlight={edgeHighlight}
            edgeShade={edgeShade}
            shadows={shadows}
            padding={filterPadding}
            size={size}
          />
        </defs>
        <g ref={layerRef} filter={`url(#${filterId})`} />
      </svg>
      <LiquidContext.Provider value={api}>
        <div className="elegans-liquid-content">{children}</div>
      </LiquidContext.Provider>
    </div>
  );
}

type LiquidItemProps = {
  move?: LiquidMoveOptions;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export function LiquidItem({
  move,
  className,
  style,
  children,
}: LiquidItemProps) {
  const api = useContext(LiquidContext);
  const hostRef = useRef<HTMLDivElement>(null);
  const registrationRef = useRef<LiquidRegistration | null>(null);
  const moveRef = useRef(move);

  if (api === undefined) {
    throw new Error("Liquid.Item must be rendered inside Liquid.");
  }

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || !api) return;
    const registration = api.attach(host, moveRef.current);
    registrationRef.current = registration;
    return () => {
      registration.dispose();
      registrationRef.current = null;
    };
  }, [api]);

  useLayoutEffect(() => {
    moveRef.current = move;
    registrationRef.current?.update(move);
  }, [move]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host || !api) return;
    const observer = new ResizeObserver(() => api.wake());
    observer.observe(host);
    return () => observer.disconnect();
  }, [api]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ display: "inline-block", background: "transparent", ...style }}
    >
      {children}
    </div>
  );
}

export const Liquid = Object.assign(LiquidRoot, { Item: LiquidItem });
