import assert from "node:assert/strict";
import test from "node:test";
import { controlMotionFor, normalizedTravelForIndexes, normalizedTravelForSelection, resolveMovePhysics, resolveTailBridgeGeometry, selectionSignature } from "./motion.ts";

test("long moves carry more stretch and trail than adjacent moves", () => {
  const adjacent = resolveMovePhysics("poised", { travel: 0 });
  const long = resolveMovePhysics("poised", { travel: 1 });

  assert.ok(adjacent.maxStretch < long.maxStretch);
  assert.ok(adjacent.maxTailDistance < long.maxTailDistance);
  assert.ok(adjacent.tailRadius < long.tailRadius);
  assert.ok(long.maxTailDistance > 200);
  assert.ok(long.tailRadius > 0.75);
  assert.ok(long.tailStiffness < adjacent.tailStiffness);
});

test("adjacent tab feedback settles faster than long jumps", () => {
  const adjacent = controlMotionFor("poised", false, 0);
  const medium = controlMotionFor("poised", false, 0.5);
  const long = controlMotionFor("poised", false, 1);

  assert.ok(adjacent.duration < medium.duration);
  assert.ok(medium.duration < long.duration);
  assert.equal(adjacent.duration, 150);
  assert.equal(medium.duration, 285);
  assert.equal(long.duration, 420);
});

test("tab travel normalizes adjacent, medium, and full-row changes", () => {
  assert.equal(normalizedTravelForIndexes(0, 1, 4), 0);
  assert.equal(normalizedTravelForIndexes(0, 2, 4), 0.5);
  assert.equal(normalizedTravelForIndexes(0, 3, 4), 1);
  assert.equal(normalizedTravelForIndexes(0, 1, 2), 0);
});

test("controlled selection changes derive travel from committed indexes", () => {
  const items = ["Overview", "Activity", "Files", "Settings"] as const;

  assert.equal(normalizedTravelForSelection(0, "Activity", items), 0);
  assert.equal(normalizedTravelForSelection(0, "Files", items), 0.5);
  assert.equal(normalizedTravelForSelection(0, "Settings", items), 1);
});

test("item reordering derives travel from the selected value's new index", () => {
  const reordered = ["Settings", "Overview", "Activity", "Files"] as const;

  assert.equal(normalizedTravelForSelection(3, "Settings", reordered), 1);
});

test("selection identity detects same-index value and item-order changes", () => {
  const items = ["Overview", "Activity", "Files", "Settings"] as const;
  const reordered = ["Overview", "Files", "Activity", "Settings"] as const;

  assert.notEqual(
    selectionSignature("Activity", items),
    selectionSignature("Files", items),
  );
  assert.notEqual(
    selectionSignature("Activity", items),
    selectionSignature("Activity", reordered),
  );
  assert.equal(
    selectionSignature("Activity", items),
    selectionSignature("Activity", [...items]),
  );
});

test("the trailing material keeps a weighted origin and a narrow neck", () => {
  const bridge = resolveTailBridgeGeometry(220, 12, 1);

  assert.ok(bridge.originRadiusX > bridge.originRadiusY);
  assert.equal(bridge.originRadiusY, 12);
  assert.ok(bridge.neckHalfWidth > 4);
  assert.ok(bridge.neckHalfWidth < 5.1);
});
