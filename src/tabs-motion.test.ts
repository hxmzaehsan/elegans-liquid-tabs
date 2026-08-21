import assert from "node:assert/strict";
import test from "node:test";
import {
  liquidMoveForTravel,
  railOvershootForTravel,
  railScaleForWidth,
  type TabsMoveOptions,
} from "./tabs-motion.ts";

test("Tabs uses the approved motion by default", () => {
  assert.deepEqual(liquidMoveForTravel(undefined, 0.5), {
    springiness: 0.1,
    wobble: 0.7,
    stretch: 0.8,
    trail: 0,
    travel: 0.5,
  });
});

test("Tabs rejects trail at its public boundary", () => {
  assert.deepEqual(
    liquidMoveForTravel(
      { springiness: 0.2, trail: 0.9 } as unknown as TabsMoveOptions,
      1,
    ),
    {
      springiness: 0.2,
      wobble: 0.7,
      stretch: 0.8,
      trail: 0,
      travel: 1,
    },
  );
});

test("rail overshoot preserves the approved side gap", () => {
  assert.equal(railOvershootForTravel(0), 0);
  assert.equal(railOvershootForTravel(0.5), 3);
  assert.equal(railOvershootForTravel(1), 6);
  assert.ok(Math.abs((railScaleForWidth(6, 280) - 1) * 280 - 6) < 1e-9);
});
