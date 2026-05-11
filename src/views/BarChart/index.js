const {
  clamp,
  createBaseVisualView,
  dropdownOption,
  optionGroup,
  propertyOption,
  sliderOption,
  textOption,
  toggleOption,
  toNumber,
} = require("../../shared");

const VIEW_BAR_CHART = "bases-view-pack-bar-chart";

function registerBarChartView(plugin, BasesViewClass, registerView) {
  const BaseVisualView = createBaseVisualView(BasesViewClass);

  class BarChartView extends BaseVisualView {
    constructor(app, controller, parentEl) {
      super(app, controller, parentEl, VIEW_BAR_CHART, "bases-view-pack-bar-chart-view");
    }

    onDataUpdated() {
      const labelProperty = this.getOption("labelProperty", "file.name");
      const dateProperty = this.getOption("dateProperty", "file.name");
      const valueProperty = this.getOption("valueProperty", "game_weekly_score");
      const referenceValue = toNumber(this.getOption("referenceValue", ""));
      const rangeMode = this.getOption("rangeMode", "rolling-year");
      const startDate = parseDateValue(this.getOption("startDate", ""));
      const endDate = parseDateValue(this.getOption("endDate", ""));
      const referenceDate = parseDateValue(this.getOption("referenceDate", "")) || startOfDay(new Date());
      const days = clamp(toNumber(this.getOption("days", "365")) || 365, 1, 3660);
      const yAxisMode = this.getOption("yAxisMode", "auto");
      const customMin = toNumber(this.getOption("yMin", ""));
      const customMax = toNumber(this.getOption("yMax", ""));
      const limit = clamp(toNumber(this.getOption("limit", "16")) || 16, 1, 80);
      const showGrid = this.getOption("showGrid", "true") === "true";
      const showLabels = this.getOption("showLabels", "true") === "true";
      const showValues = this.getOption("showValues", "true") === "true";
      const colorScheme = this.getOption("colorScheme", "accent");
      const displayTitle = this.getOption("displayTitle", "");
      const range = resolveDateRange(rangeMode, startDate, endDate, referenceDate, days);
      const rows = this.getEntries()
        .map((entry) => {
          const rawValue = this.getValue(entry, valueProperty);
          const value = toNumber(rawValue);
          const date = parseDateValue(this.getValue(entry, dateProperty));
          return {
            entry,
            label: this.getValue(entry, labelProperty) || (entry.file && entry.file.basename) || "Untitled",
            date,
            value,
            hasValue: value !== null,
          };
        })
        .filter((row) => row.hasValue)
        .filter((row) => isWithinDateRange(row.date, range))
        .sort(sortRows)
        .slice(-limit);

      if (!rows.length) {
        this.renderEmpty(`No numeric rows match ${valueProperty}.`);
        return;
      }

      this.rootEl.empty();
      const panel = this.rootEl.createDiv({ cls: "bases-view-pack-panel bases-view-pack-chart-panel" });
      panel.createDiv({ cls: "bases-view-pack-title", text: displayTitle || "Bar Chart" });
      const svg = createSvg(panel, 760, 420, "bases-view-pack-bar-chart");
      svg.setAttribute("data-color-scheme", colorScheme);

      const width = 760;
      const height = 420;
      const margin = { top: 30, right: 22, bottom: showLabels ? 76 : 34, left: 54 };
      const plotWidth = width - margin.left - margin.right;
      const plotHeight = height - margin.top - margin.bottom;
      const values = rows.map((row) => row.value);
      const yBounds = resolveValueRange(values, referenceValue, yAxisMode, customMin, customMax);
      const valueRange = yBounds.max - yBounds.min || 1;
      const yFor = (value) => {
        const clampedValue = clamp(value, yBounds.min, yBounds.max);
        return margin.top + (yBounds.max - clampedValue) / valueRange * plotHeight;
      };
      const baselineValue = clamp(0, yBounds.min, yBounds.max);
      const baseline = yFor(baselineValue);

      addSvg(svg, "line", {
        x1: margin.left,
        y1: baseline,
        x2: width - margin.right,
        y2: baseline,
        class: "bases-view-pack-chart-axis",
      });
      addSvg(svg, "line", {
        x1: margin.left,
        y1: margin.top,
        x2: margin.left,
        y2: margin.top + plotHeight,
        class: "bases-view-pack-chart-axis",
      });

      if (showGrid) {
        for (const tick of buildTicks(yBounds.min, yBounds.max, 5)) {
          const y = yFor(tick);
          addSvg(svg, "line", {
            x1: margin.left,
            y1: y,
            x2: width - margin.right,
            y2: y,
            class: "bases-view-pack-chart-grid",
          });
          const text = addSvg(svg, "text", {
            x: margin.left - 8,
            y: y + 4,
            class: "bases-view-pack-chart-tick",
            "text-anchor": "end",
          });
          text.textContent = formatNumber(tick);
        }
      }

      if (referenceValue !== null) {
        const y = yFor(referenceValue);
        addSvg(svg, "line", {
          x1: margin.left,
          y1: y,
          x2: width - margin.right,
          y2: y,
          class: "bases-view-pack-chart-reference-line",
        });
        const text = addSvg(svg, "text", {
          x: width - margin.right,
          y: y - 6,
          class: "bases-view-pack-chart-reference-label",
          "text-anchor": "end",
        });
        text.textContent = `Target ${formatNumber(referenceValue)}`;
      }

      const slot = plotWidth / rows.length;
      const barWidth = Math.max(8, Math.min(42, slot * 0.62));
      rows.forEach((row, index) => {
        const x = margin.left + slot * index + (slot - barWidth) / 2;
        const y = row.value >= baselineValue ? yFor(row.value) : baseline;
        const barHeight = Math.max(1, Math.abs(yFor(row.value) - baseline));
        const group = addSvg(svg, "g", { class: "bases-view-pack-chart-bar-group", tabindex: "0" });
        group.setAttribute("role", "button");
        group.addEventListener("click", (evt) => this.openEntry(row.entry, evt));
        group.addEventListener("keydown", (evt) => {
          if (evt.key === "Enter" || evt.key === " ") {
            evt.preventDefault();
            this.openEntry(row.entry, evt);
          }
        });
        const title = addSvg(group, "title");
        title.textContent = `${row.label}: ${formatNumber(row.value)}`;
        addSvg(group, "rect", {
          x,
          y,
          width: barWidth,
          height: barHeight,
          rx: 4,
          class: row.value < 0 ? "bases-view-pack-chart-bar is-negative" : "bases-view-pack-chart-bar",
        });
        if (showValues) {
          const valueText = addSvg(group, "text", {
            x: x + barWidth / 2,
            y: row.value >= 0 ? y - 8 : y + barHeight + 14,
            class: "bases-view-pack-chart-value",
            "text-anchor": "middle",
          });
          valueText.textContent = formatNumber(row.value);
        }
        if (showLabels) {
          const labelText = addSvg(group, "text", {
            x: x + barWidth / 2,
            y: margin.top + plotHeight + 24,
            class: "bases-view-pack-chart-label",
            "text-anchor": "end",
            transform: `rotate(-38 ${x + barWidth / 2} ${margin.top + plotHeight + 24})`,
          });
          labelText.textContent = shortLabel(row.label);
        }
      });
    }
  }

  registerView(VIEW_BAR_CHART, {
    name: "Bar Chart",
    icon: "lucide-chart-column",
    factory: (controller, containerEl) => new BarChartView(plugin.app, controller, containerEl),
    options: () => [
      optionGroup("Data", [
        propertyOption("labelProperty", "Label property", "file.name"),
        propertyOption("dateProperty", "Date property", "file.name"),
        propertyOption("valueProperty", "Value property", "note.game_weekly_score"),
        textOption("referenceValue", "Reference value", "", "Optional target number"),
        sliderOption("limit", "Limit", 16, 1, 80, 1),
      ]),
      optionGroup("Date Range", [
        textOption("startDate", "Start date", "", "YYYY-MM-DD"),
        textOption("endDate", "End date", "", "YYYY-MM-DD"),
        dropdownOption("rangeMode", "Fallback range mode", "rolling-year", {
          "rolling-year": "Rolling year",
          days: "Custom days",
          all: "All dates",
        }),
        sliderOption("days", "Days to show", 365, 1, 3660, 1),
        textOption("referenceDate", "Reference date", "", "YYYY-MM-DD"),
      ]),
      optionGroup("Y Axis", [
        dropdownOption("yAxisMode", "Y axis range", "auto", {
          auto: "Automatic",
          custom: "Custom min and max",
        }),
        textOption("yMin", "Y min", "", "Auto when blank"),
        textOption("yMax", "Y max", "", "Auto when blank"),
      ]),
      optionGroup("Layout & Display", [
        textOption("displayTitle", "Display title", "", "Default: Bar Chart"),
        toggleOption("showGrid", "Show grid", true),
        toggleOption("showLabels", "Show labels", true),
        toggleOption("showValues", "Show values", true),
      ]),
      optionGroup("Appearance", [
        dropdownOption("colorScheme", "Color scheme", "accent", {
          accent: "Accent",
          green: "Green",
          blue: "Blue",
          purple: "Purple",
          orange: "Orange",
          red: "Red",
        }),
      ]),
    ],
  });
}

function createSvg(parent, width, height, cls) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("class", cls);
  parent.appendChild(svg);
  return svg;
}

function addSvg(parent, tag, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    el.setAttribute(key, String(value));
  }
  parent.appendChild(el);
  return el;
}

function buildTicks(min, max, count) {
  const ticks = [];
  const range = max - min || 1;
  const step = range / Math.max(1, count - 1);
  for (let index = 0; index < count; index++) {
    ticks.push(min + step * index);
  }
  return ticks;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value) >= 100) return String(Math.round(value));
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

function shortLabel(value) {
  const text = String(value || "");
  return text.length > 18 ? `${text.slice(0, 16)}...` : text;
}

function parseDateValue(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const dateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) return startOfDay(new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3])));
  const weekMatch = text.match(/^(\d{4})-W(\d{2})/i);
  if (weekMatch) return isoWeekStart(Number(weekMatch[1]), Number(weekMatch[2]));
  const monthMatch = text.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) return startOfDay(new Date(Number(monthMatch[1]), Number(monthMatch[2]) - 1, 1));
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : startOfDay(parsed);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isoWeekStart(year, week) {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const day = simple.getDay() || 7;
  if (day <= 4) simple.setDate(simple.getDate() - day + 1);
  else simple.setDate(simple.getDate() + 8 - day);
  return startOfDay(simple);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

function resolveDateRange(mode, startDate, endDate, referenceDate, days) {
  if (startDate && endDate) return { start: startDate, end: endDate };
  if (mode === "all") return null;
  const end = endDate || referenceDate;
  const span = mode === "rolling-year" ? 365 : days;
  return { start: addDays(end, -(span - 1)), end };
}

function isWithinDateRange(date, range) {
  if (!range) return true;
  if (!date) return false;
  return date >= range.start && date <= range.end;
}

function sortRows(a, b) {
  if (a.date && b.date) return a.date.getTime() - b.date.getTime();
  return String(a.label).localeCompare(String(b.label), undefined, { numeric: true });
}

function resolveValueRange(values, referenceValue, mode, customMin, customMax) {
  const autoMin = Math.min(0, ...values, referenceValue ?? 0);
  const autoMax = Math.max(1, ...values, referenceValue ?? 1);
  let min = mode === "custom" && customMin !== null ? customMin : autoMin;
  let max = mode === "custom" && customMax !== null ? customMax : autoMax;
  if (min === max) max = min + 1;
  if (min > max) [min, max] = [max, min];
  return { min, max };
}

module.exports = {
  VIEW_BAR_CHART,
  registerBarChartView,
};
