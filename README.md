# Liquid Tabs

A React segmented control with an elastic travelling active state.

Liquid Tabs works with React 18.2 and newer. It includes keyboard navigation,
focus states, dark mode and reduced-motion support.

## Install

```bash
npm install elegans-liquid-tabs
```

## Use it

```tsx
"use client"

import { useState } from "react"
import { LiquidTabs } from "elegans-liquid-tabs"

const views = ["Overview", "Activity", "Files", "Settings"] as const

export function Example() {
  const [view, setView] = useState<(typeof views)[number]>("Overview")

  return (
    <LiquidTabs
      items={views}
      value={view}
      onValueChange={setView}
      ariaLabel="Workspace view"
      move={{
        springiness: 0.1,
        wobble: 0.7,
        stretch: 0.8,
      }}
    />
  )
}
```

`items`, `value` and `onValueChange` make this a controlled component. Your
application owns the selected value.

Response 10%, Bounce 70% and Stretch 80% are built in. You only need `move`
when you want different values.

## Props

| Prop | Type | Required | Purpose |
| --- | --- | --- | --- |
| `items` | `readonly string[]` | Yes | Tabs shown in the control. |
| `value` | One item from `items` | Yes | The selected tab. |
| `onValueChange` | `(value) => void` | Yes | Runs when the selection changes. |
| `ariaLabel` | `string` | Yes | Describes the tab list for assistive technology. |
| `panelId` | `string` | No | Connects each tab to its tab panel. |
| `idBase` | `string` | No | Sets predictable tab IDs. |
| `move` | `LiquidTabsMoveOptions` | No | Adjusts response, bounce and stretch. |
| `reduced` | `boolean` | No | Disables spatial motion when set to `true`. |
| `className` | `string` | No | Adds a class to the outer control. |

## Styling

The component imports its own CSS. Override these variables on the component
or an ancestor to fit it into an existing design system:

```css
.my-liquid-tabs {
  --liquid-tabs-surface: #ececec;
  --liquid-tab-rest-fill: #ffffff;
  --liquid-tab-motion-fill: #ffffff;
  --liquid-tab-active-ink: #171717;
  --liquid-tab-idle-ink: #6c6c6c;
  --focus-ring: #171717;
}
```

The component follows a surrounding `data-theme="light"` or
`data-theme="dark"` attribute. Without one, it follows the operating system's
colour preference.

## Accessibility

- Arrow Left and Arrow Right move between tabs.
- Home and End move to the first and last tab.
- Focus stays visible for keyboard users.
- `prefers-reduced-motion` removes the spatial transition.
- Add `panelId` when the tabs control a tab panel.

## Licence

MIT
