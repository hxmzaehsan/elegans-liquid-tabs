import {
  isSpringStill,
  resolveMovePhysics,
  resolveTailBridgeGeometry,
  stepSpring,
} from "./motion.js";
import type {
  LiquidMotionPreset,
  LiquidMoveOptions,
  LiquidMovePhysics,
} from "./types.js";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const MAX_FRAME_SECONDS = 0.032;

function followVelocity(current: number, measured: number, seconds: number) {
  const amount = 1 - Math.exp(-24 * seconds);
  return current + (measured - current) * amount;
}

type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
};

type Surface = Box & {
  id: number;
  host: HTMLElement;
  observer: ResizeObserver;
  main: SVGRectElement;
  bridge: SVGPathElement;
  tail: SVGEllipseElement;
  move?: LiquidMoveOptions;
  physics: LiquidMovePhysics;
  centerX: number;
  centerY: number;
  vx: number;
  vy: number;
  vWidth: number;
  vHeight: number;
  vRadius: number;
  tailX: number;
  tailY: number;
  tailVx: number;
  tailVy: number;
};

export type LiquidSurfaceFrame = {
  host: HTMLElement;
  visualLeft: number;
  visualRight: number;
};

type LiquidSessionOptions = {
  group: HTMLElement;
  shapeLayer: SVGGElement;
  motion: LiquidMotionPreset;
  reduced: boolean;
  onSurfaceFrame?: (frame: LiquidSurfaceFrame) => void;
};

function visualElement(host: HTMLElement) {
  return host.firstElementChild instanceof HTMLElement
    ? host.firstElementChild
    : host;
}

function readRadius(element: HTMLElement, width: number, height: number) {
  const raw = getComputedStyle(element).borderTopLeftRadius;
  if (raw.endsWith("%")) {
    return (Number.parseFloat(raw) / 100) * Math.min(width, height);
  }
  return Number.parseFloat(raw) || 0;
}

function measureBox(host: HTMLElement, groupRect: DOMRect): Box {
  const visual = visualElement(host);
  const rect = visual.getBoundingClientRect();
  return {
    x: rect.left - groupRect.left,
    y: rect.top - groupRect.top,
    width: rect.width,
    height: rect.height,
    radius: readRadius(visual, rect.width, rect.height),
  };
}

function createShape<T extends keyof SVGElementTagNameMap>(name: T) {
  return document.createElementNS(SVG_NAMESPACE, name);
}

function setNumber(element: SVGElement, name: string, value: number) {
  element.setAttribute(name, Number.isFinite(value) ? value.toFixed(3) : "0");
}

export class LiquidSession {
  private group: HTMLElement;
  private layer: SVGGElement;
  private motion: LiquidMotionPreset;
  private reduced: boolean;
  private onSurfaceFrame?: (frame: LiquidSurfaceFrame) => void;
  private surfaces = new Map<number, Surface>();
  private nextId = 1;
  private frame = 0;
  private lastNow = 0;
  private totalFrames = 0;
  private awake = false;
  private groupObserver: ResizeObserver;
  private removeListeners: () => void;

  constructor(options: LiquidSessionOptions) {
    this.group = options.group;
    this.layer = options.shapeLayer;
    this.motion = options.motion;
    this.reduced = options.reduced;
    this.onSurfaceFrame = options.onSurfaceFrame;

    this.group.dataset.liquidAwake = "false";

    this.groupObserver = new ResizeObserver(() => this.wake());
    this.groupObserver.observe(this.group);

    const wake = () => this.wake();
    this.group.addEventListener("pointerdown", wake);
    this.group.addEventListener("transitionrun", wake, true);
    this.group.addEventListener("transitionstart", wake, true);
    this.group.addEventListener("transitionend", wake, true);
    this.group.addEventListener("transitioncancel", wake, true);
    this.removeListeners = () => {
      this.group.removeEventListener("pointerdown", wake);
      this.group.removeEventListener("transitionrun", wake, true);
      this.group.removeEventListener("transitionstart", wake, true);
      this.group.removeEventListener("transitionend", wake, true);
      this.group.removeEventListener("transitioncancel", wake, true);
    };
  }

  attach(host: HTMLElement, move?: LiquidMoveOptions) {
    const box = measureBox(host, this.group.getBoundingClientRect());
    const main = createShape("rect");
    const bridge = createShape("path");
    const tail = createShape("ellipse");
    main.setAttribute("fill", "#fff");
    bridge.setAttribute("fill", "#fff");
    tail.setAttribute("fill", "#fff");
    bridge.style.display = "none";
    tail.style.display = "none";
    this.layer.append(bridge, tail, main);

    const id = this.nextId++;
    const observer = new ResizeObserver(() => this.wake());
    observer.observe(host);
    const surface: Surface = {
      ...box,
      id,
      host,
      observer,
      main,
      bridge,
      tail,
      move,
      physics: resolveMovePhysics(this.motion, move),
      centerX: box.x + box.width / 2,
      centerY: box.y + box.height / 2,
      vx: 0,
      vy: 0,
      vWidth: 0,
      vHeight: 0,
      vRadius: 0,
      tailX: box.x + box.width / 2,
      tailY: box.y + box.height / 2,
      tailVx: 0,
      tailVy: 0,
    };
    this.surfaces.set(id, surface);
    this.drawSurface(surface);
    this.wake();

    return {
      update: (nextMove?: LiquidMoveOptions) => {
        surface.move = nextMove;
        surface.physics = resolveMovePhysics(this.motion, nextMove);
        this.wake();
      },
      dispose: () => {
        observer.disconnect();
        main.remove();
        bridge.remove();
        tail.remove();
        this.surfaces.delete(id);
        this.wake();
      },
    };
  }

  setMotion(motion: LiquidMotionPreset) {
    this.motion = motion;
    for (const surface of this.surfaces.values()) {
      surface.physics = resolveMovePhysics(motion, surface.move);
    }
    this.wake();
  }

  setReduced(reduced: boolean) {
    this.reduced = reduced;
    this.wake();
  }

  setOnSurfaceFrame(onSurfaceFrame?: (frame: LiquidSurfaceFrame) => void) {
    this.onSurfaceFrame = onSurfaceFrame;
  }

  wake() {
    if (this.awake) return;
    this.awake = true;
    this.lastNow = 0;
    this.group.dataset.liquidAwake = "true";
    this.frame = requestAnimationFrame(this.tick);
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.groupObserver.disconnect();
    this.removeListeners();
    for (const surface of this.surfaces.values()) {
      surface.observer.disconnect();
      surface.main.remove();
      surface.bridge.remove();
      surface.tail.remove();
    }
    this.surfaces.clear();
    this.awake = false;
    delete this.group.dataset.liquidAwake;
  }

  private tick = (now: number) => {
    const seconds = this.lastNow
      ? Math.min(MAX_FRAME_SECONDS, (now - this.lastNow) / 1000)
      : 1 / 60;
    this.lastNow = now;
    const moving = this.advance(seconds);
    this.totalFrames += 1;

    if (!moving) {
      this.awake = false;
      this.lastNow = 0;
      this.group.dataset.liquidAwake = "false";
      return;
    }

    this.frame = requestAnimationFrame(this.tick);
  };

  private advance(seconds: number) {
    let moving = false;
    const groupRect = this.group.getBoundingClientRect();

    for (const surface of this.surfaces.values()) {
      const target = measureBox(surface.host, groupRect);
      const physics = surface.physics;
      const targetCenterX = target.x + target.width / 2;
      const targetCenterY = target.y + target.height / 2;

      if (this.reduced) {
        surface.centerX = targetCenterX;
        surface.centerY = targetCenterY;
        surface.x = target.x;
        surface.y = target.y;
        surface.width = target.width;
        surface.height = target.height;
        surface.radius = target.radius;
        surface.vx = 0;
        surface.vy = 0;
        surface.vWidth = 0;
        surface.vHeight = 0;
        surface.vRadius = 0;
        surface.tailX = targetCenterX;
        surface.tailY = targetCenterY;
        surface.tailVx = 0;
        surface.tailVy = 0;
        this.drawSurface(surface);
        continue;
      }

      const measuredVWidth = (target.width - surface.width) / seconds;
      const measuredVHeight = (target.height - surface.height) / seconds;
      const measuredVRadius = (target.radius - surface.radius) / seconds;

      [surface.centerX, surface.vx] = stepSpring(
        surface.centerX,
        surface.vx,
        targetCenterX,
        seconds,
        physics.positionStiffness,
        physics.positionDamping,
      );
      [surface.centerY, surface.vy] = stepSpring(
        surface.centerY,
        surface.vy,
        targetCenterY,
        seconds,
        physics.positionStiffness,
        physics.positionDamping,
      );
      surface.vWidth = followVelocity(
        surface.vWidth,
        measuredVWidth,
        seconds,
      );
      surface.vHeight = followVelocity(
        surface.vHeight,
        measuredVHeight,
        seconds,
      );
      surface.vRadius = followVelocity(
        surface.vRadius,
        measuredVRadius,
        seconds,
      );

      // The real DOM defines the destination while the liquid carries its own
      // momentum. Keeping size exact avoids muddy label changes; the sprung
      // centre is what gives the material weight and interruption continuity.
      surface.width = target.width;
      surface.height = target.height;
      surface.radius = target.radius;
      surface.x = surface.centerX - surface.width / 2;
      surface.y = surface.centerY - surface.height / 2;

      [surface.tailX, surface.tailVx] = stepSpring(
        surface.tailX,
        surface.tailVx,
        surface.centerX,
        seconds,
        physics.tailStiffness,
        physics.tailDamping,
      );
      [surface.tailY, surface.tailVy] = stepSpring(
        surface.tailY,
        surface.tailVy,
        surface.centerY,
        seconds,
        physics.tailStiffness,
        physics.tailDamping,
      );

      const lagX = surface.tailX - surface.centerX;
      const lagY = surface.tailY - surface.centerY;
      const lag = Math.hypot(lagX, lagY);
      if (lag > physics.maxTailDistance && lag > 0) {
        surface.tailX =
          surface.centerX + (lagX / lag) * physics.maxTailDistance;
        surface.tailY =
          surface.centerY + (lagY / lag) * physics.maxTailDistance;
      }

      const tailVisible = this.drawSurface(surface);

      const hostIsAnimating = surface.host
        .getAnimations({ subtree: true })
        .some((animation) => animation.playState === "running");
      const mainMoving =
        !isSpringStill(
          surface.centerX - targetCenterX,
          surface.vx,
          physics.settleDistance,
          physics.settleVelocity,
        ) ||
        !isSpringStill(
          surface.centerY - targetCenterY,
          surface.vy,
          physics.settleDistance,
          physics.settleVelocity,
        ) ||
        Math.abs(surface.vWidth) > physics.settleVelocity ||
        Math.abs(surface.vHeight) > physics.settleVelocity ||
        Math.abs(surface.vRadius) > physics.settleVelocity;
      const tailMoving =
        tailVisible &&
        (!isSpringStill(
          surface.tailX - surface.centerX,
          surface.tailVx,
          physics.settleDistance,
          physics.settleVelocity,
        ) ||
          !isSpringStill(
            surface.tailY - surface.centerY,
            surface.tailVy,
            physics.settleDistance,
            physics.settleVelocity,
          ));

      if (hostIsAnimating || mainMoving || tailMoving) {
        moving = true;
        continue;
      }

      // Finish on exact geometry so the resting component is pixel-clean.
      surface.centerX = targetCenterX;
      surface.centerY = targetCenterY;
      surface.x = target.x;
      surface.y = target.y;
      surface.width = target.width;
      surface.height = target.height;
      surface.radius = target.radius;
      surface.vx = 0;
      surface.vy = 0;
      surface.vWidth = 0;
      surface.vHeight = 0;
      surface.vRadius = 0;
      surface.tailX = targetCenterX;
      surface.tailY = targetCenterY;
      surface.tailVx = 0;
      surface.tailVy = 0;
      this.drawSurface(surface);
    }

    return moving;
  }

  private drawSurface(surface: Surface) {
    const physics = surface.physics;
    const centerX = surface.centerX;
    const centerY = surface.centerY;
    const speed = Math.hypot(surface.vx, surface.vy);
    const directionX = speed > 0.01 ? surface.vx / speed : 0;
    const directionY = speed > 0.01 ? surface.vy / speed : 0;
    const stretch = Math.min(
      physics.maxStretch,
      (speed / 420) * physics.maxStretch,
    );
    const stretchX = 1 + stretch;
    // Preserve most of the surface's apparent mass as it stretches. A purely
    // horizontal scale makes a tab swell like rubber; this counter-compression
    // keeps the travelling shape reading as liquid instead.
    const stretchY = 1 / (1 + stretch * 0.65);
    const angle = speed > 0.01 ? (Math.atan2(surface.vy, surface.vx) * 180) / Math.PI : 0;
    const lead = Math.min(surface.width, surface.height) * stretch * 0.12;
    const visualCenterX = centerX + directionX * lead;
    const visualCenterY = centerY + directionY * lead;
    const radians = (angle * Math.PI) / 180;
    const halfWidth = (surface.width * stretchX) / 2;
    const halfHeight = (surface.height * stretchY) / 2;
    const visualHalfWidth =
      Math.abs(Math.cos(radians)) * halfWidth +
      Math.abs(Math.sin(radians)) * halfHeight;

    this.onSurfaceFrame?.({
      host: surface.host,
      visualLeft: visualCenterX - visualHalfWidth,
      visualRight: visualCenterX + visualHalfWidth,
    });

    setNumber(surface.main, "x", surface.x);
    setNumber(surface.main, "y", surface.y);
    setNumber(surface.main, "width", Math.max(0, surface.width));
    setNumber(surface.main, "height", Math.max(0, surface.height));
    setNumber(surface.main, "rx", Math.max(0, surface.radius));
    setNumber(surface.main, "ry", Math.max(0, surface.radius));
    surface.main.setAttribute(
      "transform",
      `translate(${visualCenterX.toFixed(3)} ${visualCenterY.toFixed(3)}) rotate(${angle.toFixed(3)}) scale(${stretchX.toFixed(4)} ${stretchY.toFixed(4)}) translate(${(-centerX).toFixed(
        3,
      )} ${(-centerY).toFixed(3)})`,
    );

    const lagX = surface.tailX - visualCenterX;
    const lagY = surface.tailY - visualCenterY;
    const lag = Math.hypot(lagX, lagY);
    const lagActivity = Math.min(
      1,
      Math.max(0, (lag - 1.5) / Math.max(1, physics.maxTailDistance * 0.5)),
    );
    const speedActivity = Math.min(1, Math.max(0, (speed - 35) / 360));
    const tailActivity = Math.max(lagActivity, speedActivity * 0.72);
    const tailRadius =
      (Math.min(surface.width, surface.height) / 2) *
      physics.tailRadius *
      tailActivity;

    if (tailRadius < 0.35) {
      surface.bridge.style.display = "none";
      surface.tail.style.display = "none";
      return false;
    }

    const bridge = resolveTailBridgeGeometry(lag, tailRadius, tailActivity);
    const tailAngle =
      lag > 0.01 ? (Math.atan2(lagY, lagX) * 180) / Math.PI : angle;
    const distance = Math.max(0.001, lag);
    const directionToMainX = -lagX / distance;
    const directionToMainY = -lagY / distance;
    const perpendicularX = -directionToMainY;
    const perpendicularY = directionToMainX;
    const startX = surface.tailX;
    const startY = surface.tailY;
    const endX = visualCenterX;
    const endY = visualCenterY;
    const startHalfWidth = bridge.neckHalfWidth;
    const endHalfWidth = bridge.neckHalfWidth * 0.72;
    const controlAX = startX + directionToMainX * distance * 0.34;
    const controlAY = startY + directionToMainY * distance * 0.34;
    const controlBX = startX + directionToMainX * distance * 0.68;
    const controlBY = startY + directionToMainY * distance * 0.68;

    surface.bridge.style.display = "";
    surface.bridge.setAttribute(
      "d",
      [
        `M ${(startX + perpendicularX * startHalfWidth).toFixed(3)} ${(startY + perpendicularY * startHalfWidth).toFixed(3)}`,
        `C ${(controlAX + perpendicularX * startHalfWidth).toFixed(3)} ${(controlAY + perpendicularY * startHalfWidth).toFixed(3)} ${(controlBX + perpendicularX * endHalfWidth).toFixed(3)} ${(controlBY + perpendicularY * endHalfWidth).toFixed(3)} ${(endX + perpendicularX * endHalfWidth).toFixed(3)} ${(endY + perpendicularY * endHalfWidth).toFixed(3)}`,
        `L ${(endX - perpendicularX * endHalfWidth).toFixed(3)} ${(endY - perpendicularY * endHalfWidth).toFixed(3)}`,
        `C ${(controlBX - perpendicularX * endHalfWidth).toFixed(3)} ${(controlBY - perpendicularY * endHalfWidth).toFixed(3)} ${(controlAX - perpendicularX * startHalfWidth).toFixed(3)} ${(controlAY - perpendicularY * startHalfWidth).toFixed(3)} ${(startX - perpendicularX * startHalfWidth).toFixed(3)} ${(startY - perpendicularY * startHalfWidth).toFixed(3)}`,
        "Z",
      ].join(" "),
    );
    surface.tail.style.display = "";
    setNumber(surface.tail, "cx", startX);
    setNumber(surface.tail, "cy", startY);
    setNumber(surface.tail, "rx", bridge.originRadiusX);
    setNumber(surface.tail, "ry", bridge.originRadiusY);
    surface.tail.setAttribute(
      "transform",
      `rotate(${tailAngle.toFixed(3)} ${startX.toFixed(3)} ${startY.toFixed(3)})`,
    );
    return true;
  }
}
