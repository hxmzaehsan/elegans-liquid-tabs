"use client";

import { useState } from "react";
import { Tabs } from "elegans-tabs";

const views = ["Overview", "Activity", "Files", "Settings"] as const;

export function BasicExample() {
  const [view, setView] = useState<(typeof views)[number]>("Overview");

  return (
    <Tabs
      items={views}
      value={view}
      onValueChange={setView}
      ariaLabel="Workspace view"
    />
  );
}
