# Bases View Pack

Reusable custom Obsidian Bases views for the Life RPG vault.

This plugin adds visual view types that can be selected inside `.base` files. Each view renders from the Base query result, so the filters, folders, properties, and limits in the `.base` file decide what data is shown.

## Requirements

- Obsidian with Bases support.
- The plugin folder enabled at `.obsidian/plugins/bases-view-pack`.
- Base files configured with matching frontmatter properties.

If Obsidian does not expose the Bases view API, the plugin shows a notice and does not register the custom views.

## Registered Views

### Area HP Radar

View type: `bases-view-pack-radar-chart`

Shows an SVG radar chart for area or skill health. It is intended for dashboards where each row has a label, a current value, and optionally a max value/status.

Options:

- `labelProperty`: property used for each radar axis label. Default: `note.area`.
- `valueProperty`: numeric value for the radar radius. Default: `note.hp`.
- `maxProperty`: optional max value. Default: `note.max_hp`.
- `statusProperty`: optional status text. Default: `note.status`.

Useful for:

- Area HP dashboards.
- Skill balance checks.
- Quickly seeing which life areas need attention.

### Calendar Heatmap

View type: `bases-view-pack-heatmap`

Shows a GitHub-style contribution heatmap from daily notes or other date-based notes. It supports rolling date ranges, grouped settings, color schemes, value scaling, weekday labels, legends, and multiple layouts.

Option groups:

- `Data`
  - `dateProperty`: date source. Default: `file.name`.
  - `trackProperty`: value source for cell intensity. Default: `note.game_daily_score`.
  - `trackType`: `number`, `count`, or `boolean`. Boolean mode treats true/yes/1/on/done/completed/checked values as active days and uses a 0/1 color scale.
- `Date Range`
  - `referenceDate`: optional `YYYY-MM-DD` anchor date.
  - `startDate`: optional fixed start date.
  - `endDate`: optional fixed end date.
  - `rangeMode`: fallback range mode, including `rolling-year`.
  - `days`: number of days to show when not using a fixed range.
- `Layout & Display`
  - `layout`: horizontal or vertical.
  - `viewMode`: week grid, separated week grid, or month grid.
  - `showDayLabels`: shows MON, WED, and FRI on the left.
  - `showMonthLabels`, `showYearLabels`, `showLegend`.
  - `shadeWeekends`: gives Saturday and Sunday cells a subtle background difference.
  - `shadeMonths`: lightly staggers alternating month backgrounds so month boundaries are easier to see.
- `Value Range`
  - `minValue`, `maxValue`.
- `Appearance`
  - `shape`: rounded, square, or circle.
  - `colorScheme`: green, primary, blue, purple, orange, red, gray, or custom.
  - `customColors`: comma-separated colors for custom schemes.
  - `reverseColors`.

Notes:

- `rolling-year` shows the last year ending on `referenceDate` or today.
- `startDate` and `endDate` override the fallback range mode when both are set.
- Date fields are text fields because the public Bases view option API does not currently expose a native calendar date picker.
- `trackProperty` is the active value source. Legacy value/signal properties are not used by this view.

Useful for:

- Daily score history.
- Exercise, habit, study, or focus tracking.
- Seeing consistency and missed periods at a glance.

### Metric Bars

View type: `bases-view-pack-metric-bars`

Shows horizontal bars for numeric rows. The view sorts labels naturally, includes valid zero values, and opens the source note when a row is clicked.

Options:

- `labelProperty`: row label. Default: `file.name`.
- `valueProperty`: numeric value. Default: `note.game_weekly_score`.
- `detailProperty`: optional secondary text shown beside the value.
- `limit`: max rows to render. Default: `16`.

Useful for:

- Weekly score trend.
- Skill XP bars.
- Comparing numeric totals across notes.

Example:

```base
views:
  - type: bases-view-pack-metric-bars
    name: Weekly Score Trend
    labelProperty: file.name
    valueProperty: game_weekly_score
    detailProperty: game_weekly_recovery_days
    limit: 16
```

### Bar Chart

View type: `bases-view-pack-bar-chart`

Shows a vertical SVG bar chart with axes, optional grid lines, labels, values, color schemes, and an optional reference value. This is the chart-style version of numeric comparison; use Metric Bars when you want a compact list and Bar Chart when you want a dashboard visualization.

Options:

- `Data`: label property, date property, value property, optional reference value, and row limit.
- `Date Range`: fixed `startDate`/`endDate`, rolling year, custom last X days, all dates, and optional `referenceDate`.
- `Y Axis`: automatic range or custom `yMin`/`yMax`.
- `Layout & Display`: grid, labels, and values.
- `Appearance`: accent, green, blue, purple, orange, or red color schemes.

Date parsing supports daily names like `2026-05-06`, weekly names like `2026-W19`, and normal date strings.

Useful for:

- Weekly score charts.
- Comparing XP or totals by skill, week, or project.
- Showing progress against a target/reference value.

### Line Chart

View type: `bases-view-pack-line-chart`

Shows a chronological SVG line chart with clickable points, optional grid lines, labels, values, color schemes, and an optional reference value.

Options:

- `Data`: label property, date property, value property, optional reference value, and row limit.
- `Date Range`: fixed `startDate`/`endDate`, rolling year, custom last X days, all dates, and optional `referenceDate`.
- `Y Axis`: automatic range or custom `yMin`/`yMax`.
- `Layout & Display`: grid, labels, points, and values.
- `Appearance`: point shape and color scheme.

Point shapes:

- `circle`
- `filled-circle`
- `x`
- `cross`
- `triangle`
- `square`
- `diamond`

Date parsing supports daily names like `2026-05-06`, weekly names like `2026-W19`, and normal date strings.

Useful for:

- Weekly or daily score trends.
- Progress over time.
- Checking whether a metric is staying above or below a reference target.

### Area Chart

View type: `bases-view-pack-area-chart`

Shows a chronological SVG area chart with a filled value region, clickable points, optional grid lines, labels, values, color schemes, configurable fill opacity, and an optional reference value.

Options:

- `Data`: label property, date property, value property, optional reference value, and row limit.
- `Date Range`: fixed `startDate`/`endDate`, rolling year, custom last X days, all dates, and optional `referenceDate`.
- `Y Axis`: automatic range or custom `yMin`/`yMax`.
- `Layout & Display`: grid, labels, points, and values.
- `Appearance`: point shape, fill opacity, and color scheme.

Useful for:

- Filled weekly or daily score trends.
- Showing volume or intensity over time.
- Making trend dashboards easier to scan than a line-only chart.

### Overlay Chart

View type: `bases-view-pack-overlay-chart`

Shows a multi-series SVG chart with support for two independent Y axes (left and right). Each series can be rendered as a line, bar, area, or scatter plot. This is the most flexible chart for comparing multiple metrics with different scales (e.g., mood score vs. step count).

Options:

- `Global Data`: label property, date property, and row limit.
- `Series 1-4`: property, plot type (line, bar, area, scatter), axis assignment (left/right), color, and point shape.
- `Y Axes`: automatic range or custom min/max for both left and right axes.
- `Date Range`: fixed range, rolling year, or custom days.
- `Layout & Display`: grid, labels, points, and values.

Useful for:

- Correlating different metrics (e.g., recovery days vs. weekly score).
- Combining bar and line charts in a single view.
- Visualizing up to 4 different data series at once.

### Scatter Chart

View type: `bases-view-pack-scatter-chart`

Shows an SVG scatter plot from two numeric properties, with clickable points, optional grid lines, axis labels, value labels, point shapes, point size, color schemes, and date-range filtering.

Options:

- `Data`: label property, date property, X axis type, X property, Y property, and row limit.
- `Date Range`: fixed `startDate`/`endDate`, rolling year, custom last X days, all dates, and optional `referenceDate`.
- `X Axis`: automatic range or custom `xMin`/`xMax`.
- `Y Axis`: automatic range or custom `yMin`/`yMax`.
- `Layout & Display`: grid, axis labels, and values.
- `Appearance`: point shape, point size, and color scheme.

Useful for:

- Comparing mood against anxiety.
- Finding relationships between two habit or health metrics.
- Spotting clusters and outliers.

The X axis can use either a numeric property or a date property. Set `xAxisType` to `date` and `xProperty` to `file.name` or another date-like property to get a date-based scatter plot similar to a line chart's time axis.

### Bubble Chart

View type: `bases-view-pack-bubble-chart`

Shows an SVG bubble plot from three numeric properties (X, Y, and Size), with clickable bubbles, optional grid lines, axis labels, bubble radius scaling, color schemes, and date-range filtering.

Options:

- `Dimensions`: label property, date property, X axis type (numeric or date), X property, Y property, size property, and row limit.
- `X/Y Axis`: automatic range or custom min/max.
- `Bubble Size`: configurable min/max radius.
- `Date Range`: fixed range, rolling year, or custom days.
- `Layout & Display`: grid, axis labels, and values.
- `Appearance`: color scheme.

Useful for:

- Visualizing three variables at once (e.g., Anxiety vs. Mood, with bubble size representing Daily Score).
- Identifying patterns across multiple dimensions of health or productivity.

### Pie Chart

View type: `bases-view-pack-pie-chart`

Shows an SVG pie or donut chart from one numeric property, with clickable slices, optional legend, slice labels, values, color schemes, and date-range filtering.

Options:

- `Data`: label property, date property, value property, detail property, and row limit.
- `Date Range`: fixed `startDate`/`endDate`, rolling year, custom last X days, all dates, and optional `referenceDate`.
- `Value Range`: all values or custom `minValue`/`maxValue`.
- `Layout & Display`: sort mode, legend, slice labels, and values.
- `Appearance`: center cutout and color scheme.

Useful for:

- Skill XP distribution.
- Comparing how one metric is split across categories.
- Compact dashboard summaries where exact proportions matter more than chronology.

### Polar Area Chart

View type: `bases-view-pack-polar-area-chart`

Shows an SVG polar area chart (coxcomb chart) where the radius of each segment represents a numeric value. It is similar to a radar chart but uses filled slices, making it easier to compare volumes.

Options:

- `Data`: label property, date property, value property, and row limit.
- `Date Range`: all dates, rolling year, or custom days.
- `Layout & Display`: grid, labels, and values.
- `Appearance`: color scheme (balanced, warm, cool, neutral).

Useful for:

- Comparing relative proportions of metrics where a full pie chart might be too cluttered.
- Visualizing Area HP or Skill levels in a circular layout.

### Timeline

View type: `bases-view-pack-timeline`

Shows a dated vertical timeline with clickable entries, month headers, optional status pills, and compact metadata. It is intended for quest completions, milestones, rewards, or any note set where each row has one important date.

Options:

- `Data`: label property, date property, detail property, meta property, status property, and row limit.
- `Date Range`: fixed `startDate`/`endDate`, rolling year, custom last X days, all dates, and optional `referenceDate`.
- `Layout & Display`: newest/oldest sorting, month headers, status visibility, and meta visibility.
- `Appearance`: comfortable or compact density, plus neutral or status-based accent colors.

Useful for:

- Completed quest history.
- Reward claim history.
- Skill milestones or submissions over time.

### Linear Calendar

View type: `bases-view-pack-linear-calendar`

Shows a ranged month-by-month calendar where each month is one row and each note becomes an event bar from a start date to an end date. It is intended for quests, milestones, submissions, or any item with a start and finish window.

Options:

- `Data`: label property, start property, end property, detail property, and status property.
- `Date Range`: rolling year, last X months, or fixed `startDate`/`endDate`, plus optional `referenceDate`.
- `Layout & Display`: day-of-month columns or weekday-aligned columns, month headers, column headers, legend, and compact mode.
- `Appearance`: optional status-based colors.

Useful for:

- Quest spans.
- Timelines where duration matters, not just one date.
- Month-row planning views similar to Lovely Bases linear calendar layouts.

### Momentum Cards

View type: `bases-view-pack-momentum-cards`

Shows compact cards for notes that need recovery attention. It is designed for the Recover Momentum dashboard and works best with daily notes that calculate a momentum signal.

Options:

- `dateProperty`: date shown on the card. Default: `file.name`.
- `signalProperty`: momentum signal or status. Default: `note.game_momentum_signal`.
- `areaProperty`: affected area. Default: `note.game_main_area`.
- `actionProperty`: suggested or main action. Default: `note.game_main_quest`.
- `scoreProperty`: score shown on the card. Default: `note.game_daily_score`.
- `limit`: max cards to render. Default: `12`.

Useful for:

- Recover Momentum dashboard.
- Finding low-score or high-risk days.
- Reviewing what needs attention without scanning a full table.

### Quest Cards

View type: `bases-view-pack-quest-cards`

Shows interactive quest cards with status badges, difficulty indicators, and XP rewards. It is designed for active quest dashboards where items have rich metadata.

Options:

- `Data`: name, area, skill, difficulty, XP, and status properties, plus row limit.
- `Layout & Display`: display title.

Useful for:

- Active quest boards.
- Skill-specific quest lists.
- Dashboard views where cards are preferred over tables.

### Reward Cards

View type: `bases-view-pack-reward-cards`

Shows interactive reward cards with tier badges, category meta, and token costs. It is intended for reward shop views.

Options:

- `Data`: name, tier, cost, status, and category properties, plus row limit.
- `Layout & Display`: display title.

Useful for:

- Reward shop dashboards.
- Visualizing available items or claims in a grid format.

## Current Source Layout

```text
bases-view-pack/
  manifest.json
  main.js
  main.ts
  package.json
  styles.css
  tsconfig.json
  versions.json
  src/
    main.js
    shared.js
    views/
      AreaChart/
        index.js
      BarChart/
        index.js
      Bars/
        index.js
      BubbleChart/
        index.js
      HeatmapCalendar/
        index.js
      LineChart/
        index.js
      LinearCalendar/
        index.js
      Momentum/
        index.js
      OverlayChart/
        index.js
      PieChart/
        index.js
      PolarAreaChart/
        index.js
      Quests/
        index.js
      Radar/
        index.js
      Rewards/
        index.js
      ScatterChart/
        index.js
      Timeline/
        index.js
```

Each view owns its registration, options, and renderer inside `src/views/<ViewName>/index.js`. Shared helpers live in `src/shared.js`.

The root `main.js` is the file Obsidian loads. It is kept self-contained for local loading reliability. When editing source files under `src/`, regenerate or rebuild `main.js` before testing in Obsidian.

## Property IDs

The views accept both Base property IDs and note-style IDs where possible.

Examples:

- `game_weekly_score`
- `note.game_weekly_score`
- `file.name`
- `file.path`

If a bare note property is used, the shared resolver also tries the `note.` version. This helps existing `.base` files keep working while still supporting the Bases property picker.

## Empty States

Each view renders an empty message instead of crashing when the Base query returns no matching rows or the selected property does not contain usable values.

Common causes:

- The Base filter points at the wrong folder.
- The selected property does not exist on the target notes.
- The property exists but is not numeric for radar, bars, or heatmap intensity.
- The date property cannot be parsed for the heatmap.

## Validation

The plugin was checked with:

```text
node --check main.js
node --check src/main.js
node --check src/shared.js
node --check src/views/AreaChart/index.js
node --check src/views/BarChart/index.js
node --check src/views/Bars/index.js
node --check src/views/BubbleChart/index.js
node --check src/views/HeatmapCalendar/index.js
node --check src/views/LineChart/index.js
node --check src/views/LinearCalendar/index.js
node --check src/views/Momentum/index.js
node --check src/views/OverlayChart/index.js
node --check src/views/PieChart/index.js
node --check src/views/PolarAreaChart/index.js
node --check src/views/Quests/index.js
node --check src/views/Radar/index.js
node --check src/views/Rewards/index.js
node --check src/views/ScatterChart/index.js
node --check src/views/Timeline/index.js
```

A mock Obsidian load registered:

```text
bases-view-pack-radar-chart: Area HP Radar
bases-view-pack-heatmap: Calendar Heatmap
bases-view-pack-area-chart: Area Chart
bases-view-pack-bar-chart: Bar Chart
bases-view-pack-bubble-chart: Bubble Chart
bases-view-pack-line-chart: Line Chart
bases-view-pack-metric-bars: Metric Bars
bases-view-pack-momentum-cards: Momentum Cards
bases-view-pack-overlay-chart: Overlay Chart
bases-view-pack-pie-chart: Pie Chart
bases-view-pack-polar-area-chart: Polar Area Chart
bases-view-pack-quest-cards: Quest Cards
bases-view-pack-reward-cards: Reward Cards
bases-view-pack-scatter-chart: Scatter Chart
bases-view-pack-timeline: Timeline
bases-view-pack-linear-calendar: Linear Calendar
```

## Development Notes

- Keep view type IDs stable. Existing `.base` files depend on them.
- Prefer adding new views under `src/views/<NewView>/index.js`.
- Keep view settings in the `options()` definition so they are editable from the Bases UI.
- Use Obsidian CSS variables in `styles.css` so views follow the active theme.
- Do not remove `bases-view-pack-heatmap`; current Base files use that view type.
- The plugin has `package.json` build scripts, but dependencies are not installed in this vault copy by default.
