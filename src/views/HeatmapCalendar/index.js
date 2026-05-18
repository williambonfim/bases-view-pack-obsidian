const {
  clamp,
  createBaseVisualView,
  dropdownOption,
  optionGroup,
  propertyOption,
  sliderOption,
  textOption,
  toBooleanText,
  toNumber,
  toggleOption,
} = require("../../shared");

const VIEW_HEATMAP_CALENDAR = "bases-view-pack-heatmap";

function registerHeatmapCalendarView(plugin, BasesViewClass, registerView) {
  const BaseVisualView = createBaseVisualView(BasesViewClass);

  class HeatmapCalendarView extends BaseVisualView {
    constructor(app, controller, parentEl) {
      super(app, controller, parentEl, VIEW_HEATMAP_CALENDAR, "bases-view-pack-heatmap-view");
    }

    onDataUpdated() {
      const dateProperty = this.getOption("dateProperty", "file.name");
      const trackProperty = this.getOption("trackProperty", "note.game_daily_score");
      const rangeMode = this.getOption("rangeMode", "rolling-year").toLowerCase();
      const days = rangeMode === "rolling-year" ? 365 : clamp(toNumber(this.getOption("days", "365")) || 365, 28, 371);
      const startDateOption = normalizeDate(this.getOption("startDate", ""));
      const endDateOption = normalizeDate(this.getOption("endDate", ""));
      const trackType = this.getOption("trackType", "number").toLowerCase();
      const maxValueOption = toNumber(this.getOption("maxValue", ""));
      const minValueOption = toNumber(this.getOption("minValue", ""));
      const colorScheme = this.getOption("colorScheme", "green").toLowerCase();
      const customColors = parseColorList(this.getOption("customColors", ""));
      const reverseColors = toBooleanText(this.getOption("reverseColors", "false"));
      const showLegend = toBooleanText(this.getOption("showLegend", "true"));
      const showDayLabels = toBooleanText(this.getOption("showDayLabels", "true"));
      const showMonthLabels = toBooleanText(this.getOption("showMonthLabels", "true"));
      const showYearLabels = toBooleanText(this.getOption("showYearLabels", "false"));
      const shadeWeekends = toBooleanText(this.getOption("shadeWeekends", "false"));
      const shadeMonths = toBooleanText(this.getOption("shadeMonths", "false"));
      const shape = this.getOption("shape", "rounded").toLowerCase();
      const layout = this.getOption("layout", "horizontal").toLowerCase();
      const viewMode = this.getOption("viewMode", "week-grid").toLowerCase();
      const overflowWarningColor = this.getOption("overflowWarningColor", "#d29922");
      const displayTitle = this.getOption("displayTitle", "");
      const referenceDate = parseDate(this.getOption("referenceDate", todayKey()));
      const hasStaticRange = Boolean(startDateOption && endDateOption);
      const rangeStart = hasStaticRange ? parseDate(startDateOption) : addDays(referenceDate, -(days - 1));
      const rangeEnd = hasStaticRange ? parseDate(endDateOption) : new Date(referenceDate);
      const entries = this.getEntries();

      if (!entries.length) {
        this.renderEmpty("No rows match this Base.");
        return;
      }

      const rows = entries
        .map((entry) => ({
          entry,
          date: normalizeDate(this.getValue(entry, dateProperty)),
          rawValue: this.getValue(entry, trackProperty),
        }))
        .filter((row) => row.date)
        .filter((row) => {
          const current = parseDate(row.date);
          return current >= rangeStart && current <= rangeEnd;
        })
        .sort((a, b) => a.date.localeCompare(b.date));

      this.rootEl.empty();
      const panel = this.rootEl.createDiv({ cls: "bases-view-pack-heatmap-shell" });
      panel.createDiv({ cls: "bases-view-pack-title", text: displayTitle || "Activity Heatmap" });
      panel.setAttribute("data-shape", shape);
      panel.setAttribute("data-layout", layout);
      panel.setAttribute("data-view-mode", viewMode);
      panel.style.setProperty("--bases-view-pack-heatmap-empty", getHeatmapEmptyColor(customColors, colorScheme));
      panel.style.setProperty("--bases-view-pack-heatmap-overflow", overflowWarningColor);
      const palette = buildHeatmapPalette(customColors, colorScheme, reverseColors);
      palette.forEach((color, index) => {
        panel.style.setProperty(`--bases-view-pack-heatmap-level-${index + 1}`, color);
      });

      const entriesByDate = aggregateHeatmapRows(rows, trackType);
      const start = startOfWeek(rangeStart);
      const end = endOfWeek(rangeEnd);
      const weekCount = diffWeeks(start, end) + 1;
      const maxValue = trackType === "boolean" ? 1 : maxValueOption || Math.max(1, ...Array.from(entriesByDate.values()).map((row) => row.value));
      const minValue = trackType === "boolean" ? 0 : minValueOption ?? 0;
      setResponsiveHeatmapVars(panel, this.rootEl, weekCount, showDayLabels, viewMode);
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => setResponsiveHeatmapVars(panel, this.rootEl, weekCount, showDayLabels, viewMode));
      }
      const lovely = panel.createDiv({ cls: "lovely-bases flex flex-col gap-2" });
      const heatmap = lovely.createDiv({ cls: "bases-view-pack-heatmap" });

      if (viewMode === "month-grid") {
        renderMonthGrid(heatmap, rangeStart, rangeEnd, entriesByDate, trackType, minValue, maxValue, showDayLabels, { shadeWeekends, shadeMonths }, this.openEntry.bind(this));
        if (showLegend) renderLegend(lovely, entriesByDate);
        renderDiagnostics(panel, rows, entriesByDate, dateProperty, trackProperty, trackType, days);
        return;
      }

      if (showYearLabels) {
        renderYearLabels(heatmap, start, weekCount, showDayLabels);
      }
      if (showMonthLabels) {
        renderMonthLabels(heatmap, start, weekCount, showDayLabels);
      }

      const body = heatmap.createDiv({ cls: "bases-view-pack-heatmap-body flex gap-2 items-center" });
      if (showDayLabels) {
        const weekdays = body.createDiv({ cls: "bases-view-pack-heatmap-weekdays flex flex-col gap-1 w-32" });
        ["MON", "", "WED", "", "FRI", "", ""].forEach((label) => {
          weekdays.createDiv({ cls: "bases-view-pack-heatmap-weekday text-xs", text: label });
        });
      } else {
        body.addClass("is-no-day-labels");
      }

      renderWeekGrid(body, start, end, entriesByDate, trackType, minValue, maxValue, viewMode, { shadeWeekends, shadeMonths }, this.openEntry.bind(this));

      if (showLegend) renderLegend(lovely, entriesByDate);
      renderDiagnostics(panel, rows, entriesByDate, dateProperty, trackProperty, trackType, days);
    }
  }

  const spec = {
    name: "Calendar Heatmap",
    icon: "lucide-calendar-days",
    factory: (controller, containerEl) => new HeatmapCalendarView(plugin.app, controller, containerEl),
    options: () => [
      optionGroup("Data", [
        propertyOption("dateProperty", "Date property", "file.name"),
        propertyOption("trackProperty", "Track property", "note.game_daily_score"),
        dropdownOption("trackType", "Track type", "number", {
          number: "Number",
          count: "Count entries",
          boolean: "True / false",
        }),
      ]),
      optionGroup("Date Range", [
        textOption("startDate", "Start date", "", "YYYY-MM-DD"),
        textOption("endDate", "End date", "", "YYYY-MM-DD"),
        dropdownOption("rangeMode", "Fallback range mode", "rolling-year", {
          "rolling-year": "Rolling year",
          days: "Custom days",
        }),
        sliderOption("days", "Days to show", 365, 28, 371, 1),
        textOption("referenceDate", "Reference date", "", "YYYY-MM-DD"),
      ]),
      optionGroup("Layout & Display", [
        textOption("displayTitle", "Display title", "", "Default: Activity Heatmap"),
        dropdownOption("layout", "Layout", "horizontal", {
          horizontal: "Horizontal",
          vertical: "Vertical",
        }),
        dropdownOption("viewMode", "View mode", "week-grid", {
          "week-grid": "Week grid",
          "week-grid-month-separated": "Week grid, month separated",
          "month-grid": "Month grid",
        }),
        toggleOption("showDayLabels", "Show weekday labels", true),
        toggleOption("showMonthLabels", "Show month labels", true),
        toggleOption("showYearLabels", "Show year labels", false),
        toggleOption("shadeWeekends", "Shade weekends", false),
        toggleOption("shadeMonths", "Shade alternating months", false),
        toggleOption("showLegend", "Show legend", true),
      ]),
      optionGroup("Value Range", [
        sliderOption("minValue", "Min", 0, -100, 300, 1),
        sliderOption("maxValue", "Max", 150, 1, 300, 1),
      ]),
      optionGroup("Appearance", [
        dropdownOption("shape", "Shape", "rounded", {
          rounded: "Rounded",
          square: "Square",
          circle: "Circle",
        }),
        dropdownOption("colorScheme", "Color scheme", "green", {
          primary: "Primary",
          green: "Green",
          blue: "Blue",
          red: "Red",
          purple: "Purple",
        }),
        toggleOption("reverseColors", "Reverse colors", false),
        textOption("customColors", "Custom colors", "", "#050512, #52eea3"),
        textOption("overflowWarningColor", "Overflow warning color", "#d29922", "#d29922"),
      ]),
    ],
  };

  registerView(VIEW_HEATMAP_CALENDAR, spec);
}

function renderWeekGrid(parent, start, end, entriesByDate, trackType, minValue, maxValue, viewMode, displayOptions, openEntry) {
  const grid = parent.createDiv({ cls: "bases-view-pack-heatmap-grid bases-view-pack-heatmap-week-grid" });
  const weekCount = diffWeeks(start, end) + 1;
  for (let week = 0; week < weekCount; week += 1) {
    const weekStart = addDays(start, week * 7);
    const monthSeparated = viewMode === "week-grid-month-separated" && week > 0 && weekStart.getDate() <= 7;
    const column = grid.createDiv({
      cls: `bases-view-pack-heatmap-week-column${monthSeparated ? " is-month-start" : ""}`,
    });
    for (let index = 0; index < 7; index += 1) {
      const day = addDays(weekStart, index);
      const dayKey = dateKey(day);
      const row = day <= end ? entriesByDate.get(dayKey) : null;
      const intensity = row ? heatLevel(row.value, minValue, maxValue) : 0;
      const clickable = Boolean(row);
      const isOverflow = row && row.value > maxValue;
      if (row) row.isOverflow = isOverflow;
      const displayClasses = heatmapDisplayClasses(day, displayOptions);
      const valueStateClass = row && !row.hasTrackedValue ? "is-no-value-entry" : "";
      const cell = column.createEl("button", {
        cls: `bases-view-pack-heatmap-cell rounded-[4px] ${displayClasses} ${valueStateClass} ${clickable ? "cursor-pointer" : ""} ${heatClass(intensity, isOverflow)}`,
        attr: {
          title: buildHeatmapTitle(dayKey, row, trackType, minValue, maxValue),
          "aria-label": row ? buildHeatmapTitle(dayKey, row, trackType, minValue, maxValue) : `${dayKey}: no data`,
        },
      });
      if (row) {
        cell.onClickEvent((evt) => openEntry(row.entry, evt));
      } else {
        cell.disabled = true;
      }
    }
  }
}

function renderMonthGrid(parent, rangeStart, rangeEnd, entriesByDate, trackType, minValue, maxValue, showDayLabels, displayOptions, openEntry) {
  const months = parent.createDiv({ cls: "bases-view-pack-heatmap-month-grid" });
  const start = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  const end = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
  for (let month = new Date(start); month <= end; month = new Date(month.getFullYear(), month.getMonth() + 1, 1)) {
    const card = months.createDiv({ cls: "bases-view-pack-heatmap-month-card" });
    card.createDiv({
      cls: "bases-view-pack-heatmap-month-card-title",
      text: month.toLocaleDateString(undefined, { month: "short", year: "numeric" }).toUpperCase(),
    });
    if (showDayLabels) {
      const labels = card.createDiv({ cls: "bases-view-pack-heatmap-month-weekdays" });
      ["M", "T", "W", "T", "F", "S", "S"].forEach((label) => labels.createSpan({ text: label }));
    }
    const grid = card.createDiv({ cls: "bases-view-pack-heatmap-month-days" });
    const monthStart = startOfWeek(month);
    const monthEnd = endOfWeek(new Date(month.getFullYear(), month.getMonth() + 1, 0));
    for (let day = new Date(monthStart); day <= monthEnd; day = addDays(day, 1)) {
      const dayKey = dateKey(day);
      const inMonth = day.getMonth() === month.getMonth();
      const inRange = day >= rangeStart && day <= rangeEnd;
      const row = inMonth && inRange ? entriesByDate.get(dayKey) : null;
      const intensity = row ? heatLevel(row.value, minValue, maxValue) : 0;
      const clickable = Boolean(row);
      const isOverflow = row && row.value > maxValue;
      if (row) row.isOverflow = isOverflow;
      const displayClasses = heatmapDisplayClasses(day, displayOptions, month);
      const valueStateClass = row && !row.hasTrackedValue ? "is-no-value-entry" : "";
      const cell = grid.createEl("button", {
        cls: `bases-view-pack-heatmap-cell rounded-[4px] ${displayClasses} ${valueStateClass} ${!inMonth || !inRange ? "is-outside-range" : ""} ${clickable ? "cursor-pointer" : ""} ${heatClass(intensity, isOverflow)}`,
        attr: {
          title: buildHeatmapTitle(dayKey, row, trackType, minValue, maxValue),
          "aria-label": row ? buildHeatmapTitle(dayKey, row, trackType, minValue, maxValue) : `${dayKey}: no data`,
        },
      });
      if (row) {
        cell.onClickEvent((evt) => openEntry(row.entry, evt));
      } else {
        cell.disabled = true;
      }
    }
  }
}

function heatmapDisplayClasses(day, displayOptions, displayMonth) {
  const classes = [];
  if (displayOptions.shadeWeekends && isWeekend(day)) classes.push("is-weekend");
  if (displayOptions.shadeMonths) {
    const monthIndex = displayMonth ? displayMonth.getMonth() : day.getMonth();
    classes.push(monthIndex % 2 === 0 ? "is-month-even" : "is-month-odd");
  }
  return classes.join(" ");
}

function setResponsiveHeatmapVars(panel, rootEl, weekCount, showDayLabels, viewMode) {
  const rootWidth = Math.max(0, rootEl.clientWidth || rootEl.parentElement?.clientWidth || 0);
  const labelWidth = showDayLabels ? 28 : 0;
  const bodyGap = showDayLabels ? 8 : 0;
  const gap = rootWidth <= 470 ? 1 : rootWidth <= 560 ? 1.5 : rootWidth <= 660 ? 2 : rootWidth <= 740 ? 2.5 : 3;
  const monthGapBuffer = viewMode === "week-grid-month-separated" ? gap * 24 : 0;
  const safetyBuffer = showDayLabels ? 24 : 4;
  const available = rootWidth ? rootWidth - labelWidth - bodyGap - safetyBuffer - monthGapBuffer : 0;
  const fitted = available > 0
    ? Math.floor((available - Math.max(0, weekCount - 1) * gap) / weekCount)
    : 11;
  const cellSize = clamp(fitted || 11, 5, showDayLabels ? 10 : 11);
  panel.style.setProperty("--bases-view-pack-heatmap-cell-size", `${cellSize}px`);
  panel.style.setProperty("--bases-view-pack-heatmap-gap", `${gap}px`);
  panel.style.setProperty("--bases-view-pack-heatmap-label-width", `${labelWidth}px`);
}

function renderYearLabels(parent, start, weekCount, showDayLabels) {
  const wrap = parent.createDiv({ cls: "flex mb-2" });
  wrap.createDiv({ cls: showDayLabels ? "w-32" : "bases-view-pack-heatmap-spacer" });
  const row = wrap.createDiv({
    cls: "bases-view-pack-heatmap-years grid gap-1",
    attr: { style: `grid-template-columns: repeat(${weekCount}, var(--bases-view-pack-heatmap-cell-size));` },
  });
  let previousYear = "";
  for (let column = 0; column < weekCount; column += 1) {
    const current = addDays(start, column * 7);
    const year = String(current.getFullYear());
    const label = row.createDiv({ cls: "bases-view-pack-heatmap-year text-xs" });
    if (year !== previousYear) {
      label.setText(year);
      previousYear = year;
    }
  }
}

function renderMonthLabels(parent, start, weekCount, showDayLabels) {
  const wrap = parent.createDiv({ cls: "flex mb-2" });
  wrap.createDiv({ cls: showDayLabels ? "w-32" : "bases-view-pack-heatmap-spacer" });
  const row = wrap.createDiv({
    cls: "bases-view-pack-heatmap-months grid gap-1",
    attr: { style: `grid-template-columns: repeat(${weekCount}, var(--bases-view-pack-heatmap-cell-size));` },
  });
  let previousMonth = "";
  for (let column = 0; column < weekCount; column += 1) {
    const current = addDays(start, column * 7);
    const month = current.toLocaleDateString(undefined, { month: "short" }).toUpperCase();
    const label = row.createDiv({ cls: "bases-view-pack-heatmap-month text-xs" });
    if (month !== previousMonth) {
      label.setText(month);
      previousMonth = month;
    }
  }
}

function renderLegend(parent, entriesByDate) {
  const legend = parent.createDiv({ cls: "bases-view-pack-heatmap-legend flex items-center gap-1" });
  legend.createSpan({ cls: "bases-view-pack-heatmap-legend-label text-xs", text: "Less" });
  ["is-empty", "is-low", "is-mid", "is-high", "is-very-high"].forEach((cls) => {
    legend.createSpan({ cls: `bases-view-pack-heatmap-legend-cell rounded-[4px] ${cls}` });
  });
  if (Array.from(entriesByDate.values()).some((item) => item.isOverflow)) {
    legend.createSpan({ cls: "bases-view-pack-heatmap-legend-separator text-xs", text: "Over" });
    legend.createSpan({ cls: "bases-view-pack-heatmap-legend-cell rounded-[4px] is-overflow" });
  }
  legend.createSpan({ cls: "bases-view-pack-heatmap-legend-label text-xs", text: "More" });
}

function renderDiagnostics(parent, rows, entriesByDate, dateProperty, trackProperty, trackType, days) {
  if (!rows.length) {
    parent.createDiv({
      cls: "bases-view-pack-heatmap-note",
      text: `No dated rows found for ${dateProperty} in the selected ${days}-day range.`,
    });
  } else if (!Array.from(entriesByDate.values()).some((row) => row.value > 0)) {
    const valueType = trackType === "boolean" ? "true values" : "numeric values";
    parent.createDiv({
      cls: "bases-view-pack-heatmap-note",
      text: `Rows found, but ${trackProperty} has no ${valueType} in this range.`,
    });
  }
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

function aggregateHeatmapRows(rows, trackType) {
  const map = new Map();
  for (const row of rows) {
    const nextValue = heatmapTrackedValue(row.rawValue, trackType);
    const hasTrackedValue = heatmapHasTrackedValue(row.rawValue, trackType);
    if (!map.has(row.date)) {
      map.set(row.date, {
        entry: row.entry,
        date: row.date,
        value: nextValue,
        count: 1,
        hasTrackedValue,
        isOverflow: false,
      });
      continue;
    }
    const current = map.get(row.date);
    current.value += nextValue;
    current.count += 1;
    current.hasTrackedValue = current.hasTrackedValue || hasTrackedValue;
  }
  return map;
}

function heatmapTrackedValue(rawValue, trackType) {
  if (trackType === "count") return 1;
  if (trackType === "boolean") return parseHeatmapBoolean(rawValue) ? 1 : 0;
  return toNumber(rawValue) || 0;
}

function parseHeatmapBoolean(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return false;
  return ["true", "yes", "1", "y", "on", "done", "completed", "complete", "checked"].includes(text);
}

function heatmapHasTrackedValue(rawValue, trackType) {
  if (trackType === "count") return true;
  if (trackType === "boolean") return String(rawValue || "").trim() !== "";
  return toNumber(rawValue) !== null;
}

function buildHeatmapTitle(dayKey, row, trackType, minValue, maxValue) {
  if (!row) return `${dayKey}: no data`;
  const valueLabel = heatmapValueLabel(row, trackType);
  const extras = [];
  if (row.value < minValue) extras.push(`below min ${minValue}`);
  if (row.value > maxValue) extras.push(`above max ${maxValue}`);
  return `${row.date}: ${valueLabel}${extras.length ? `, ${extras.join(", ")}` : ""}`;
}

function heatmapValueLabel(row, trackType) {
  if (trackType === "count") return `${row.count} entr${row.count === 1 ? "y" : "ies"}`;
  if (trackType === "boolean") {
    const label = `${row.value} true value${row.value === 1 ? "" : "s"}`;
    return row.count > 1 ? `${label} across ${row.count} entries` : label;
  }
  return `value ${row.value}`;
}

function heatLevel(value, minValue, maxValue) {
  if (value === null || value === undefined || maxValue <= minValue) return 0;
  if (value <= minValue) return 0;
  const ratio = (value - minValue) / (maxValue - minValue);
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}

function parseColorList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getHeatmapEmptyColor(customColors, colorScheme) {
  if (customColors.length > 0) return customColors[0];
  return heatmapScheme(colorScheme).empty;
}

function buildHeatmapPalette(customColors, colorScheme, reverseColors) {
  const colors = customColors.length >= 2
    ? gradientColors(customColors[0], customColors[customColors.length - 1], 4)
    : heatmapScheme(colorScheme).levels.slice();
  return reverseColors ? colors.slice().reverse() : colors;
}

function heatmapScheme(name) {
  const schemes = {
    primary: { empty: "#161b22", levels: ["#0e4429", "#006d32", "#26a641", "#39d353"] },
    green: { empty: "#161b22", levels: ["#0e4429", "#006d32", "#26a641", "#39d353"] },
    blue: { empty: "#0d1117", levels: ["#0a3069", "#0969da", "#54aeff", "#a5d6ff"] },
    red: { empty: "#0d1117", levels: ["#67060c", "#a40e26", "#d1242f", "#ff6a69"] },
    purple: { empty: "#0d1117", levels: ["#4a1d96", "#6f42c1", "#8957e5", "#b392f0"] },
  };
  return schemes[name] || schemes.green;
}

function gradientColors(startHex, endHex, steps) {
  const start = hexToRgb(startHex);
  const end = hexToRgb(endHex);
  if (!start || !end) return heatmapScheme("green").levels.slice();
  const colors = [];
  for (let index = 1; index <= steps; index += 1) {
    const ratio = index / steps;
    colors.push(rgbToHex(
      Math.round(start.r + (end.r - start.r) * ratio),
      Math.round(start.g + (end.g - start.g) * ratio),
      Math.round(start.b + (end.b - start.b) * ratio),
    ));
  }
  return colors;
}

function hexToRgb(hex) {
  const cleaned = String(hex || "").trim().replace(/^#/, "");
  if (![3, 6].includes(cleaned.length)) return null;
  const normalized = cleaned.length === 3
    ? cleaned.split("").map((char) => char + char).join("")
    : cleaned;
  const value = Number.parseInt(normalized, 16);
  if (Number.isNaN(value)) return null;
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((value) => clamp(value, 0, 255).toString(16).padStart(2, "0")).join("")}`;
}

function parseDate(value) {
  const match = normalizeDate(value);
  if (!match) return new Date();
  return new Date(`${match}T00:00:00`);
}

function todayKey() {
  return dateKey(new Date());
}

function startOfWeek(date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfWeek(date) {
  const next = startOfWeek(date);
  next.setDate(next.getDate() + 6);
  return next;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function diffWeeks(start, end) {
  return Math.floor((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function heatClass(value, isOverflow) {
  if (isOverflow) return "is-overflow";
  if (value >= 4) return "is-very-high";
  if (value >= 3) return "is-high";
  if (value >= 2) return "is-mid";
  if (value >= 1) return "is-low";
  return "is-empty";
}

module.exports = {
  VIEW_HEATMAP_CALENDAR,
  registerHeatmapCalendarView,
};
