"use client";

import {
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import {
  controlMotionFor,
  normalizedTravelForSelection,
  selectionSignature,
} from "./motion";
import {
  liquidMoveForTravel,
  railScaleForWidth,
  type LiquidTabsMoveOptions,
} from "./liquid-tabs-motion";
import { Liquid } from "./liquid";
import type { LiquidSurfaceFrame } from "./session";
import "./liquid-tabs.css";

type IndicatorGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const INITIAL_GEOMETRY: IndicatorGeometry = {
  x: 3,
  y: 3,
  width: 68,
  height: 30,
};
const LIQUID_TABS_MOTION = "poised" as const;

export type LiquidTabsProps<T extends string> = {
  items: readonly T[];
  value: T;
  onValueChange: (value: T) => void;
  ariaLabel: string;
  panelId?: string;
  idBase?: string;
  move?: LiquidTabsMoveOptions;
  reduced?: boolean;
  className?: string;
};

export function LiquidTabs<T extends string>({
  items,
  value,
  onValueChange,
  ariaLabel,
  panelId,
  idBase: providedId,
  move,
  reduced = false,
  className,
}: LiquidTabsProps<T>) {
  const rowRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const firstMeasure = useRef(true);
  const generatedId = useId().replaceAll(":", "");
  const idBase = providedId ?? generatedId;
  const [indicator, setIndicator] =
    useState<IndicatorGeometry>(INITIAL_GEOMETRY);
  const selectedIndex = items.indexOf(value);
  const currentSelectionSignature = selectionSignature(value, items);
  const [committedSelection, setCommittedSelection] = useState({
    signature: currentSelectionSignature,
    index: selectedIndex,
    travel: 0,
    railDirection: "right" as "left" | "right",
  });
  const selectionChanged =
    committedSelection.signature !== currentSelectionSignature;
  const nextTravel =
    selectionChanged
      ? normalizedTravelForSelection(
          committedSelection.index,
          value,
          items,
        )
      : committedSelection.travel;
  const nextRailDirection = selectionChanged
    ? selectedIndex < committedSelection.index
      ? "left"
      : "right"
    : committedSelection.railDirection;
  if (selectionChanged) {
    setCommittedSelection({
      signature: currentSelectionSignature,
      index: selectedIndex,
      travel: nextTravel,
      railDirection: nextRailDirection,
    });
  }
  const controlMotion = useMemo(
    () => controlMotionFor(LIQUID_TABS_MOTION, reduced, nextTravel),
    [reduced, nextTravel],
  );
  const liquidMove = useMemo(
    () => liquidMoveForTravel(move, nextTravel),
    [move, nextTravel],
  );

  const measure = useCallback(() => {
    const row = rowRef.current;
    const active = tabRefs.current[items.indexOf(value)];
    if (!row || !active) return;

    const rowRect = row.getBoundingClientRect();
    const tabRect = active.getBoundingClientRect();
    const next = {
      x: tabRect.left - rowRect.left,
      y: tabRect.top - rowRect.top,
      width: tabRect.width,
      height: tabRect.height,
    };

    if (firstMeasure.current && indicatorRef.current) {
      firstMeasure.current = false;
      const elements = [indicatorRef.current];

      for (const element of elements) element.style.transition = "none";

      indicatorRef.current.style.width = `${next.width}px`;
      indicatorRef.current.style.height = `${next.height}px`;
      indicatorRef.current.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;

      indicatorRef.current.getBoundingClientRect();
      for (const element of elements) element.style.removeProperty("transition");
    }

    setIndicator((current) => {
      if (
        current.x === next.x &&
        current.y === next.y &&
        current.width === next.width &&
        current.height === next.height
      ) {
        return current;
      }
      return next;
    });
  }, [items, value]);

  useLayoutEffect(() => {
    measure();
    const row = rowRef.current;
    if (!row) return;
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    for (const tab of tabRefs.current) {
      if (tab) observer.observe(tab);
    }
    return () => observer.disconnect();
  }, [measure]);

  const select = (next: T, focus = false) => {
    onValueChange(next);
    if (focus) tabRefs.current[items.indexOf(next)]?.focus();
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % items.length;
    if (event.key === "ArrowLeft") {
      nextIndex = (index - 1 + items.length) % items.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    select(items[nextIndex], true);
  };

  const updateRailForSurface = useCallback(
    ({ visualLeft, visualRight }: LiquidSurfaceFrame) => {
      const row = rowRef.current;
      const control = row?.closest<HTMLElement>(".liquid-tabs-control");
      if (!row || !control) return;

      const width = row.getBoundingClientRect().width;
      const sideGap = 3;
      let yieldDistance = 0;

      yieldDistance =
        nextRailDirection === "right"
          ? Math.max(0, visualRight + sideGap - width)
          : Math.max(0, sideGap - visualLeft);

      control.style.setProperty(
        "--liquid-rail-scale",
        String(railScaleForWidth(yieldDistance, width)),
      );
    },
    [nextRailDirection],
  );

  const transitionStyle = {
    "--liquid-control-duration": `${controlMotion.duration}ms`,
    "--liquid-control-ease": controlMotion.easing,
  } as CSSProperties;

  return (
    <Liquid
      className={`liquid-tabs-control${className ? ` ${className}` : ""}`}
      style={transitionStyle}
      data-liquid-rail-direction={nextRailDirection}
      blur={6}
      contrast={18}
      fill="var(--liquid-tab-fill)"
      shadow={[]}
      filterPadding={30}
      motion={LIQUID_TABS_MOTION}
      reduced={reduced}
      onSurfaceFrame={updateRailForSurface}
    >
      <div ref={rowRef} className="liquid-tabs-row" role="tablist" aria-label={ariaLabel}>
        <Liquid.Item className="liquid-tabs-indicator-host" move={liquidMove}>
          <span
            ref={indicatorRef}
            className="liquid-tabs-indicator-proxy"
            style={{
              width: indicator.width,
              height: indicator.height,
              transform: `translate3d(${indicator.x}px, ${indicator.y}px, 0)`,
            }}
          />
        </Liquid.Item>

        {items.map((item, index) => {
          const selected = item === value;
          const tabId = `${idBase}-${item.toLowerCase().replaceAll(" ", "-")}`;
          return (
            <button
              key={item}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              id={tabId}
              type="button"
              role="tab"
              aria-controls={panelId}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(item)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              {item}
            </button>
          );
        })}
      </div>
    </Liquid>
  );
}
