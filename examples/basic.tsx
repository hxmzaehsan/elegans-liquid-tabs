"use client";

import { useState } from "react";
import { LiquidTabs } from "elegans-liquid-tabs";

const views = ["Overview", "Activity", "Files", "Settings"] as const;

export function BasicExample() {
  const [view, setView] = useState<(typeof views)[number]>("Overview");

  return (
    <LiquidTabs
      items={views}
      value={view}
      onValueChange={setView}
      ariaLabel="Workspace view"
    />
  );
}
