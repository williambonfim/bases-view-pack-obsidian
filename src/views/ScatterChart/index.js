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

const VIEW_SCATTER_CHART = "bases-view-pack-scatter-chart";

function registerScatterChartView(plugin, BasesViewClass, registerView) {
  const BaseVisualView = createBaseVisualView(BasesViewClass);

  class ScatterChartView extends BaseVisualView {
    constructor(app, controller, parentEl) {
      super(app, controller, parentEl, VIEW_SCATTER_CHART, "bases-view-pack-scatter-chart-view");
    }

    onDataUpdated() {
      const labelProperty = this.getOption("labelProperty", "file.name");
      const dateProperty = this.getOption("dateProperty", "file.name");
      const xAxisType = this.getOption("xAxisType", "number");
      const xProperty = this.getOption("xProperty", "track_anxiety");
      const yProperty = this.getOption("yProperty", "track_mood");
      const rangeMode = this.getOption("rangeMode", "rolling-year");
      const startDate = parseDateValue(this.getOption("startDate", ""));
      const endDate = parseDateValue(this.getOption("endDate", ""));
      const referenceDate = parseDateValue(this.getOption("referenceDate", "")) || startOfDay(new Date());
      const days = clamp(toNumber(this.getOption("days", "365")) || 365, 1, 3660);
      const xAxisMode = this.getOption("xAxisMode", "auto");
      const yAxisMode = this.getOption("yAxisMode", "auto");
      const xMin = toNumber(this.getOption("xMin", ""));
      const xMax = toNumber(this.getOption("xMax", ""));
      const yMin = toNumber(this.getOption("yMin", ""));
      const yMax = toNumber(this.getOption("yMax", ""));
      const limit = clamp(toNumber(this.getOption("limit", "120")) || 120, 2, 500);
      const showGrid = this.getOption("showGrid", "true") === "true";
      const showLabels = this.getOption("showLabels", "true") === "true";
      const showValues = this.getOption("showValues", "false") === "true";
      const pointShape = this.getOption("pointShape", "circle");
      const pointSize = clamp(toNumber(this.getOption("pointSize", "5")) || 5, 2, 14);
      const colorScheme = this.getOption("colorScheme", "accent");
      const displayTitle = this.getOption("displayTitle", "");
      const range = resolveDateRange(rangeMode, startDate, endDate, referenceDate, days);
      const rows = this.getEntries()
        .map((entry) => {
          const xRaw = this.getValue(entry, xProperty);
          const xDate = parseDateValue(xRaw);
          const x = xAxisType === "date" ? dateToNumber(xDate) : toNumber(xRaw);
          const y = toNumber(this.getValue(entry, yProperty));
          const date = parseDateValue(this.getValue(entry, dateProperty));
          return {
            entry,
            label: this.getValue(entry, labelProperty) || (entry.file && entry.file.basename) || "Untitled",
            date,
            xDate,
            x,
            y,
            hasValue: x !== null && y !== null,
          };
        })
        .filter((row) => row.hasValue)
        .filter((row) => isWithinDateRange(row.date, range))
        .sort(sortRows)
        .slice(-limit);

      if (rows.length < 2) {
        this.renderEmpty(`At least two numeric rows are needed for ${xProperty} and ${yProperty}.`);
        return;
      }

      this.rootEl.empty();
      const panel = this.rootEl.createDiv({ cls: "bases-view-pack-panel bases-view-pack-chart-panel" });
      panel.createDiv({ cls: "bases-view-pack-title", text: displayTitle || "Scatter Chart" });
      const svg = createSvg(panel, 760, 430, "bases-view-pack-scatter-chart");
      svg.setAttribute("data-color-scheme", colorScheme);

      const width = 760;
      const height = 430;
      const margin = { top: 30, right: 28, bottom: showLabels ? 62 : 42, left: 58 };
      const plotWidth = width - margin.left - margin.right;
      const plotHeight = height - margin.top - margin.bottom;
      const xBounds = resolveValueRange(rows.map((row) => row.x), xAxisMode, xMin, xMax);
      const yBounds = resolveValueRange(rows.map((row) => row.y), yAxisMode, yMin, yMax);
      const xRange = xBounds.max - xBounds.min || 1;
      const yRange = yBounds.max - yBounds.min || 1;
      const xFor = (value) => margin.left + (clamp(value, xBounds.min, xBounds.max) - xBounds.min) / xRange * plotWidth;
      const yFor = (value) => margin.top + (yBounds.max - clamp(value, yBounds.min, yBounds.max)) / yRange * plotHeight;

      renderAxes(svg, margin, width, height, plotWidth, plotHeight, xBounds, yBounds, xFor, yFor, showGrid, xAxisType);

      rows.forEach((row) => {
        const x = xFor(row.x);
        const y = yFor(row.y);
        const group = addSvg(svg, "g", { class: "bases-view-pack-chart-point-group", tabindex: "0" });
        group.setAttribute("role", "button");
        group.addEventListener("click", (evt) => this.openEntry(row.entry, evt));
        group.addEventListener("keydown", (evt) => {
          if (evt.key === "Enter" || evt.key === " ") {
            evt.preventDefault();
            this.openEntry(row.entry, evt);
          }
        });
        const title = addSvg(group, "title");
        title.textContent = `${row.label}: ${formatXValue(row.x, xAxisType)}, ${formatNumber(row.y)}`;
        renderPointShape(group, x, y, pointShape, pointSize);
        if (showValues) {
          const valueText = addSvg(group, "text", { x, y: y - pointSize - 6, class: "bases-view-pack-chart-value", "text-anchor": "middle" });
          valueText.textContent = `${formatXValue(row.x, xAxisType)}, ${formatNumber(row.y)}`;
        }
      });

      if (showLabels) {
        const xLabel = addSvg(svg, "text", { x: margin.left + plotWidth / 2, y: height - 12, class: "bases-view-pack-chart-axis-label", "text-anchor": "middle" });
        xLabel.textContent = xAxisType === "date" ? "Date" : xProperty.replace(/^note\./, "");
        const yLabel = addSvg(svg, "text", { x: 16, y: margin.top + plotHeight / 2, class: "bases-view-pack-chart-axis-label", "text-anchor": "middle", transform: `rotate(-90 16 ${margin.top + plotHeight / 2})` });
        yLabel.textContent = yProperty.replace(/^note\./, "");
      }
    }
  }

  registerView(VIEW_SCATTER_CHART, {
    name: "Scatter Chart",
    icon: "lucide-chart-scatter",
    factory: (controller, containerEl) => new ScatterChartView(plugin.app, controller, containerEl),
    options: () => [
      optionGroup("Data", [
        propertyOption("labelProperty", "Label property", "file.name"),
        propertyOption("dateProperty", "Date property", "file.name"),
        dropdownOption("xAxisType", "X axis type", "number", {
          number: "Numeric property",
          date: "Date property",
        }),
        propertyOption("xProperty", "X property", "note.track_anxiety"),
        propertyOption("yProperty", "Y property", "note.track_mood"),
        sliderOption("limit", "Limit", 120, 2, 500, 1),
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
      optionGroup("X Axis", [
        dropdownOption("xAxisMode", "X axis range", "auto", { auto: "Automatic", custom: "Custom min and max" }),
        textOption("xMin", "X min", "", "Auto when blank"),
        textOption("xMax", "X max", "", "Auto when blank"),
      ]),
      optionGroup("Y Axis", [
        dropdownOption("yAxisMode", "Y axis range", "auto", { auto: "Automatic", custom: "Custom min and max" }),
        textOption("yMin", "Y min", "", "Auto when blank"),
        textOption("yMax", "Y max", "", "Auto when blank"),
      ]),
      optionGroup("Layout & Display", [
        textOption("displayTitle", "Display title", "", "Default: Scatter Chart"),
        toggleOption("showGrid", "Show grid", true),
        toggleOption("showLabels", "Show axis labels", true),
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
        sliderOption("pointSize", "Point size", 5, 2, 14, 1),
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

function renderAxes(svg, margin, width, height, plotWidth, plotHeight, xBounds, yBounds, xFor, yFor, showGrid, xAxisType) {
  addSvg(svg, "line", { x1: margin.left, y1: margin.top + plotHeight, x2: width - margin.right, y2: margin.top + plotHeight, class: "bases-view-pack-chart-axis" });
  addSvg(svg, "line", { x1: margin.left, y1: margin.top, x2: margin.left, y2: margin.top + plotHeight, class: "bases-view-pack-chart-axis" });
  for (const tick of buildTicks(yBounds.min, yBounds.max, 5)) {
    const y = yFor(tick);
    if (showGrid) addSvg(svg, "line", { x1: margin.left, y1: y, x2: width - margin.right, y2: y, class: "bases-view-pack-chart-grid" });
    const text = addSvg(svg, "text", { x: margin.left - 8, y: y + 4, class: "bases-view-pack-chart-tick", "text-anchor": "end" });
    text.textContent = formatNumber(tick);
  }
  for (const tick of buildTicks(xBounds.min, xBounds.max, 5)) {
    const x = xFor(tick);
    if (showGrid) addSvg(svg, "line", { x1: x, y1: margin.top, x2: x, y2: margin.top + plotHeight, class: "bases-view-pack-chart-grid" });
    const text = addSvg(svg, "text", { x, y: height - margin.bottom + 22, class: "bases-view-pack-chart-tick", "text-anchor": "middle" });
    text.textContent = formatXValue(tick, xAxisType);
  }
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
  for (const [key, value] of Object.entries(attrs || {})) el.setAttribute(key, String(value));
  parent.appendChild(el);
  return el;
}

function renderPointShape(parent, x, y, shape, size) {
  if (shape === "filled-circle") return void addSvg(parent, "circle", { cx: x, cy: y, r: size, class: "bases-view-pack-chart-point is-filled" });
  if (shape === "x") {
    addSvg(parent, "line", { x1: x - size, y1: y - size, x2: x + size, y2: y + size, class: "bases-view-pack-chart-point-mark" });
    addSvg(parent, "line", { x1: x + size, y1: y - size, x2: x - size, y2: y + size, class: "bases-view-pack-chart-point-mark" });
    return;
  }
  if (shape === "cross") {
    addSvg(parent, "line", { x1: x - size, y1: y, x2: x + size, y2: y, class: "bases-view-pack-chart-point-mark" });
    addSvg(parent, "line", { x1: x, y1: y - size, x2: x, y2: y + size, class: "bases-view-pack-chart-point-mark" });
    return;
  }
  if (shape === "triangle") return void addSvg(parent, "polygon", { points: `${x},${y - size - 1} ${x + size + 1},${y + size} ${x - size - 1},${y + size}`, class: "bases-view-pack-chart-point-shape" });
  if (shape === "square") return void addSvg(parent, "rect", { x: x - size, y: y - size, width: size * 2, height: size * 2, rx: 2, class: "bases-view-pack-chart-point-shape" });
  if (shape === "diamond") return void addSvg(parent, "polygon", { points: `${x},${y - size - 2} ${x + size + 2},${y} ${x},${y + size + 2} ${x - size - 2},${y}`, class: "bases-view-pack-chart-point-shape" });
  addSvg(parent, "circle", { cx: x, cy: y, r: size, class: "bases-view-pack-chart-point" });
}

function buildTicks(min, max, count) {
  const ticks = [];
  const range = max - min || 1;
  const step = range / Math.max(1, count - 1);
  for (let index = 0; index < count; index++) ticks.push(min + step * index);
  return ticks;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value) >= 100) return String(Math.round(value));
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

function formatXValue(value, xAxisType) {
  if (xAxisType !== "date") return formatNumber(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateValue(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const dateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) return startOfDay(new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3])));
  const weekMatch = text.match(/^(\d{4})-W(\d{2})/i);
  if (weekMatch) return isoWeekStart(Number(weekMatch[1]), Number(weekMatch[2]));
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : startOfDay(parsed);
}

function dateToNumber(date) {
  return date ? date.getTime() : null;
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

function resolveValueRange(values, mode, customMin, customMax) {
  const autoMin = Math.min(0, ...values);
  const autoMax = Math.max(1, ...values);
  let min = mode === "custom" && customMin !== null ? customMin : autoMin;
  let max = mode === "custom" && customMax !== null ? customMax : autoMax;
  if (min === max) max = min + 1;
  if (min > max) [min, max] = [max, min];
  return { min, max };
}

module.exports = {
  VIEW_SCATTER_CHART,
  registerScatterChartView,
};
