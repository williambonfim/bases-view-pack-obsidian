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

const VIEW_LINE_CHART = "bases-view-pack-line-chart";

function registerLineChartView(plugin, BasesViewClass, registerView) {
  const BaseVisualView = createBaseVisualView(BasesViewClass);

  class LineChartView extends BaseVisualView {
    constructor(app, controller, parentEl) {
      super(app, controller, parentEl, VIEW_LINE_CHART, "bases-view-pack-line-chart-view");
    }

    onDataUpdated() {
      const labelProperty = this.getOption("labelProperty", "file.name");
      const dateProperty = this.getOption("dateProperty", "file.name");
      const valueProperty = this.getOption("valueProperty", "game_weekly_score");
      const referenceValue = toNumber(this.getOption("referenceValue", ""));
      const rangeMode = this.getOption("rangeMode", "rolling-year");
      const startDate = parseLineDateValue(this.getOption("startDate", ""));
      const endDate = parseLineDateValue(this.getOption("endDate", ""));
      const referenceDate = parseLineDateValue(this.getOption("referenceDate", "")) || startOfLineDay(new Date());
      const days = clamp(toNumber(this.getOption("days", "365")) || 365, 1, 3660);
      const yAxisMode = this.getOption("yAxisMode", "auto");
      const customMin = toNumber(this.getOption("yMin", ""));
      const customMax = toNumber(this.getOption("yMax", ""));
      const limit = clamp(toNumber(this.getOption("limit", "16")) || 16, 2, 120);
      const showGrid = this.getOption("showGrid", "true") === "true";
      const showLabels = this.getOption("showLabels", "true") === "true";
      const showPoints = this.getOption("showPoints", "true") === "true";
      const showValues = this.getOption("showValues", "false") === "true";
      const pointShape = this.getOption("pointShape", "circle");
      const colorScheme = this.getOption("colorScheme", "accent");
      const displayTitle = this.getOption("displayTitle", "");
      const range = resolveLineDateRange(rangeMode, startDate, endDate, referenceDate, days);
      const rows = this.getEntries()
        .map((entry) => {
          const rawValue = this.getValue(entry, valueProperty);
          const value = toNumber(rawValue);
          const date = parseLineDateValue(this.getValue(entry, dateProperty));
          return {
            entry,
            label: this.getValue(entry, labelProperty) || (entry.file && entry.file.basename) || "Untitled",
            date,
            value,
            hasValue: value !== null,
          };
        })
        .filter((row) => row.hasValue)
        .filter((row) => isWithinLineDateRange(row.date, range))
        .sort(sortLineRows)
        .slice(-limit);

      if (rows.length < 2) {
        this.renderEmpty(`At least two numeric rows are needed for ${valueProperty}.`);
        return;
      }

      this.rootEl.empty();
      const panel = this.rootEl.createDiv({ cls: "bases-view-pack-panel bases-view-pack-chart-panel" });
      panel.createDiv({ cls: "bases-view-pack-title", text: displayTitle || "Line Chart" });
      const svg = createLineSvg(panel, 760, 420, "bases-view-pack-line-chart");
      svg.setAttribute("data-color-scheme", colorScheme);

      const width = 760;
      const height = 420;
      const margin = { top: 30, right: 24, bottom: showLabels ? 76 : 34, left: 54 };
      const plotWidth = width - margin.left - margin.right;
      const plotHeight = height - margin.top - margin.bottom;
      const values = rows.map((row) => row.value);
      const yBounds = resolveLineValueRange(values, referenceValue, yAxisMode, customMin, customMax);
      const valueRange = yBounds.max - yBounds.min || 1;
      const xFor = (index) => rows.length === 1 ? margin.left : margin.left + index / (rows.length - 1) * plotWidth;
      const yFor = (value) => {
        const clampedValue = clamp(value, yBounds.min, yBounds.max);
        return margin.top + (yBounds.max - clampedValue) / valueRange * plotHeight;
      };

      addLineSvg(svg, "line", {
        x1: margin.left,
        y1: margin.top + plotHeight,
        x2: width - margin.right,
        y2: margin.top + plotHeight,
        class: "bases-view-pack-chart-axis",
      });
      addLineSvg(svg, "line", {
        x1: margin.left,
        y1: margin.top,
        x2: margin.left,
        y2: margin.top + plotHeight,
        class: "bases-view-pack-chart-axis",
      });

      if (showGrid) {
        for (const tick of buildLineTicks(yBounds.min, yBounds.max, 5)) {
          const y = yFor(tick);
          addLineSvg(svg, "line", {
            x1: margin.left,
            y1: y,
            x2: width - margin.right,
            y2: y,
            class: "bases-view-pack-chart-grid",
          });
          const text = addLineSvg(svg, "text", {
            x: margin.left - 8,
            y: y + 4,
            class: "bases-view-pack-chart-tick",
            "text-anchor": "end",
          });
          text.textContent = formatLineNumber(tick);
        }
      }

      if (referenceValue !== null) {
        const y = yFor(referenceValue);
        addLineSvg(svg, "line", {
          x1: margin.left,
          y1: y,
          x2: width - margin.right,
          y2: y,
          class: "bases-view-pack-chart-reference-line",
        });
        const text = addLineSvg(svg, "text", {
          x: width - margin.right,
          y: y - 6,
          class: "bases-view-pack-chart-reference-label",
          "text-anchor": "end",
        });
        text.textContent = `Target ${formatLineNumber(referenceValue)}`;
      }

      const points = rows.map((row, index) => ({
        row,
        x: xFor(index),
        y: yFor(row.value),
      }));
      addLineSvg(svg, "polyline", {
        points: points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" "),
        class: "bases-view-pack-chart-line",
      });

      points.forEach((point) => {
        const group = addLineSvg(svg, "g", { class: "bases-view-pack-chart-point-group", tabindex: "0" });
        group.setAttribute("role", "button");
        group.addEventListener("click", (evt) => this.openEntry(point.row.entry, evt));
        group.addEventListener("keydown", (evt) => {
          if (evt.key === "Enter" || evt.key === " ") {
            evt.preventDefault();
            this.openEntry(point.row.entry, evt);
          }
        });
        const title = addLineSvg(group, "title");
        title.textContent = `${point.row.label}: ${formatLineNumber(point.row.value)}`;
        if (showPoints) {
          renderLinePointShape(group, point.x, point.y, pointShape);
        }
        if (showValues) {
          const valueText = addLineSvg(group, "text", {
            x: point.x,
            y: point.y - 10,
            class: "bases-view-pack-chart-value",
            "text-anchor": "middle",
          });
          valueText.textContent = formatLineNumber(point.row.value);
        }
        if (showLabels) {
          const labelText = addLineSvg(group, "text", {
            x: point.x,
            y: margin.top + plotHeight + 24,
            class: "bases-view-pack-chart-label",
            "text-anchor": "end",
            transform: `rotate(-38 ${point.x} ${margin.top + plotHeight + 24})`,
          });
          labelText.textContent = shortLineLabel(point.row.label);
        }
      });
    }
  }

  registerView(VIEW_LINE_CHART, {
    name: "Line Chart",
    icon: "lucide-chart-line",
    factory: (controller, containerEl) => new LineChartView(plugin.app, controller, containerEl),
    options: () => [
      optionGroup("Data", [
        propertyOption("labelProperty", "Label property", "file.name"),
        propertyOption("dateProperty", "Date property", "file.name"),
        propertyOption("valueProperty", "Value property", "note.game_weekly_score"),
        textOption("referenceValue", "Reference value", "", "Optional target number"),
        sliderOption("limit", "Limit", 16, 2, 120, 1),
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
        textOption("displayTitle", "Display title", "", "Default: Line Chart"),
        toggleOption("showGrid", "Show grid", true),
        toggleOption("showLabels", "Show labels", true),
        toggleOption("showPoints", "Show points", true),
        toggleOption("showValues", "Show values", false),
      ]),
      optionGroup("Appearance", [
        dropdownOption("pointShape", "Point shape", "circle", {
          circle: "Circle",
          "filled-circle": "Filled circle",
          x: "X",
          cross: "Cross",
          triangle: "Triangle",
          square: "Square",
          diamond: "Diamond",
        }),
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

function createLineSvg(parent, width, height, cls) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("class", cls);
  parent.appendChild(svg);
  return svg;
}

function addLineSvg(parent, tag, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    el.setAttribute(key, String(value));
  }
  parent.appendChild(el);
  return el;
}

function buildLineTicks(min, max, count) {
  const ticks = [];
  const range = max - min || 1;
  const step = range / Math.max(1, count - 1);
  for (let index = 0; index < count; index++) {
    ticks.push(min + step * index);
  }
  return ticks;
}

function formatLineNumber(value) {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value) >= 100) return String(Math.round(value));
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

function shortLineLabel(value) {
  const text = String(value || "");
  return text.length > 18 ? `${text.slice(0, 16)}...` : text;
}

function renderLinePointShape(parent, x, y, shape) {
  const size = 5;
  if (shape === "filled-circle") {
    addLineSvg(parent, "circle", { cx: x, cy: y, r: size, class: "bases-view-pack-chart-point is-filled" });
    return;
  }
  if (shape === "x") {
    addLineSvg(parent, "line", { x1: x - size, y1: y - size, x2: x + size, y2: y + size, class: "bases-view-pack-chart-point-mark" });
    addLineSvg(parent, "line", { x1: x + size, y1: y - size, x2: x - size, y2: y + size, class: "bases-view-pack-chart-point-mark" });
    return;
  }
  if (shape === "cross") {
    addLineSvg(parent, "line", { x1: x - size, y1: y, x2: x + size, y2: y, class: "bases-view-pack-chart-point-mark" });
    addLineSvg(parent, "line", { x1: x, y1: y - size, x2: x, y2: y + size, class: "bases-view-pack-chart-point-mark" });
    return;
  }
  if (shape === "triangle") {
    addLineSvg(parent, "polygon", {
      points: `${x},${y - size - 1} ${x + size + 1},${y + size} ${x - size - 1},${y + size}`,
      class: "bases-view-pack-chart-point-shape",
    });
    return;
  }
  if (shape === "square") {
    addLineSvg(parent, "rect", { x: x - size, y: y - size, width: size * 2, height: size * 2, rx: 2, class: "bases-view-pack-chart-point-shape" });
    return;
  }
  if (shape === "diamond") {
    addLineSvg(parent, "polygon", {
      points: `${x},${y - size - 2} ${x + size + 2},${y} ${x},${y + size + 2} ${x - size - 2},${y}`,
      class: "bases-view-pack-chart-point-shape",
    });
    return;
  }
  addLineSvg(parent, "circle", { cx: x, cy: y, r: size, class: "bases-view-pack-chart-point" });
}

function parseLineDateValue(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const dateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) return startOfLineDay(new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3])));
  const weekMatch = text.match(/^(\d{4})-W(\d{2})/i);
  if (weekMatch) return lineIsoWeekStart(Number(weekMatch[1]), Number(weekMatch[2]));
  const monthMatch = text.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) return startOfLineDay(new Date(Number(monthMatch[1]), Number(monthMatch[2]) - 1, 1));
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : startOfLineDay(parsed);
}

function startOfLineDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function lineIsoWeekStart(year, week) {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const day = simple.getDay() || 7;
  if (day <= 4) simple.setDate(simple.getDate() - day + 1);
  else simple.setDate(simple.getDate() + 8 - day);
  return startOfLineDay(simple);
}

function addLineDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfLineDay(next);
}

function resolveLineDateRange(mode, startDate, endDate, referenceDate, days) {
  if (startDate && endDate) return { start: startDate, end: endDate };
  if (mode === "all") return null;
  const end = endDate || referenceDate;
  const span = mode === "rolling-year" ? 365 : days;
  return { start: addLineDays(end, -(span - 1)), end };
}

function isWithinLineDateRange(date, range) {
  if (!range) return true;
  if (!date) return false;
  return date >= range.start && date <= range.end;
}

function sortLineRows(a, b) {
  if (a.date && b.date) return a.date.getTime() - b.date.getTime();
  return String(a.label).localeCompare(String(b.label), undefined, { numeric: true });
}

function resolveLineValueRange(values, referenceValue, mode, customMin, customMax) {
  const autoMin = Math.min(0, ...values, referenceValue ?? 0);
  const autoMax = Math.max(1, ...values, referenceValue ?? 1);
  let min = mode === "custom" && customMin !== null ? customMin : autoMin;
  let max = mode === "custom" && customMax !== null ? customMax : autoMax;
  if (min === max) max = min + 1;
  if (min > max) [min, max] = [max, min];
  return { min, max };
}

module.exports = {
  VIEW_LINE_CHART,
  registerLineChartView,
};
