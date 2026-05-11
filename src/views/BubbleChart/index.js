const {
  clamp,
  createBaseVisualView,
  dropdownOption,
  formatNumber,
  isWithinDateRange,
  optionGroup,
  parseDateValue,
  propertyOption,
  resolveDateRange,
  sliderOption,
  sortRows,
  startOfDay,
  textOption,
  toggleOption,
  toNumber,
  buildTicks,
} = require("../../shared");

const VIEW_BUBBLE_CHART = "bases-view-pack-bubble-chart";

function registerBubbleChartView(plugin, BasesViewClass, registerView) {
  const BaseVisualView = createBaseVisualView(BasesViewClass);

  class BubbleChartView extends BaseVisualView {
    constructor(app, controller, parentEl) {
      super(app, controller, parentEl, VIEW_BUBBLE_CHART, "bases-view-pack-bubble-chart-view");
    }

    onDataUpdated() {
      const labelProperty = this.getOption("labelProperty", "file.name");
      const dateProperty = this.getOption("dateProperty", "file.name");
      const xAxisType = this.getOption("xAxisType", "number");
      const xProperty = this.getOption("xProperty", "track_anxiety");
      const yProperty = this.getOption("yProperty", "track_mood");
      const sizeProperty = this.getOption("sizeProperty", "game_daily_score");
      
      const limit = clamp(toNumber(this.getOption("limit", "80")) || 80, 2, 300);
      const rangeMode = this.getOption("rangeMode", "rolling-year");
      const startDate = parseDateValue(this.getOption("startDate", ""));
      const endDate = parseDateValue(this.getOption("endDate", ""));
      const referenceDate = parseDateValue(this.getOption("referenceDate", "")) || startOfDay(new Date());
      const days = clamp(toNumber(this.getOption("days", "365")) || 365, 1, 3660);
      
      const xMode = this.getOption("xAxisMode", "auto");
      const xMin = toNumber(this.getOption("xMin", ""));
      const xMax = toNumber(this.getOption("xMax", ""));
      
      const yMode = this.getOption("yAxisMode", "auto");
      const yMin = toNumber(this.getOption("yMin", ""));
      const yMax = toNumber(this.getOption("yMax", ""));

      const minRadius = clamp(toNumber(this.getOption("minRadius", "4")) || 4, 1, 40);
      const maxRadius = clamp(toNumber(this.getOption("maxRadius", "24")) || 24, 2, 80);
      
      const colorScheme = this.getOption("colorScheme", "accent");
      const showGrid = this.getOption("showGrid", "true") === "true";
      const showLabels = this.getOption("showLabels", "true") === "true";
      const showValues = this.getOption("showValues", "false") === "true";
      const displayTitle = this.getOption("displayTitle", "");

      const range = resolveDateRange(rangeMode, startDate, endDate, referenceDate, days);
      const entries = this.getEntries();

      const processedRows = entries
        .map(entry => {
          const xRaw = this.getValue(entry, xProperty);
          const xDate = parseDateValue(xRaw);
          const xVal = xAxisType === "date" ? (xDate ? xDate.getTime() : null) : toNumber(xRaw);
          
          const yVal = toNumber(this.getValue(entry, yProperty));
          const sizeVal = toNumber(this.getValue(entry, sizeProperty));
          const date = parseDateValue(this.getValue(entry, dateProperty));

          return {
            entry,
            label: this.getValue(entry, labelProperty) || (entry.file && entry.file.basename) || "Untitled",
            date,
            x: xVal,
            y: yVal,
            size: sizeVal,
            hasValue: xVal !== null && yVal !== null && sizeVal !== null
          };
        })
        .filter(row => row.hasValue)
        .filter(row => isWithinDateRange(row.date, range))
        .sort(sortRows)
        .slice(-limit);

      if (processedRows.length < 2) {
        this.renderEmpty(`At least 2 numeric rows with ${xProperty}, ${yProperty}, and ${sizeProperty} are needed.`);
        return;
      }

      this.rootEl.empty();
      const panel = this.rootEl.createDiv({ cls: "bases-view-pack-panel bases-view-pack-chart-panel" });
      panel.createDiv({ cls: "bases-view-pack-title", text: displayTitle || "Bubble Chart" });
      
      const width = 760;
      const height = 480;
      const margin = { 
        top: 40, 
        right: 40, 
        bottom: showLabels ? 70 : 40, 
        left: 60 
      };
      const plotWidth = width - margin.left - margin.right;
      const plotHeight = height - margin.top - margin.bottom;

      const svg = createSvg(panel, width, height, "bases-view-pack-bubble-chart");
      svg.setAttribute("data-color-scheme", colorScheme);

      // Resolve Ranges
      const xBounds = resolveSimpleRange(processedRows.map(r => r.x), xMode, xMin, xMax);
      const yBounds = resolveSimpleRange(processedRows.map(r => r.y), yMode, yMin, yMax);
      const sizeValues = processedRows.map(r => r.size);
      const sizeMin = Math.min(...sizeValues);
      const sizeMax = Math.max(...sizeValues);
      const sizeRange = sizeMax - sizeMin || 1;

      const xFor = (val) => margin.left + (clamp(val, xBounds.min, xBounds.max) - xBounds.min) / (xBounds.max - xBounds.min || 1) * plotWidth;
      const yFor = (val) => margin.top + (yBounds.max - clamp(val, yBounds.min, yBounds.max)) / (yBounds.max - yBounds.min || 1) * plotHeight;
      const radiusFor = (val) => minRadius + (clamp(val, sizeMin, sizeMax) - sizeMin) / sizeRange * (maxRadius - minRadius);

      // Draw Axes and Grid
      addSvg(svg, "line", { x1: margin.left, y1: margin.top + plotHeight, x2: width - margin.right, y2: margin.top + plotHeight, class: "bases-view-pack-chart-axis" });
      addSvg(svg, "line", { x1: margin.left, y1: margin.top, x2: margin.left, y2: margin.top + plotHeight, class: "bases-view-pack-chart-axis" });

      const xTicks = buildTicks(xBounds.min, xBounds.max, 5);
      xTicks.forEach(tick => {
        const x = xFor(tick);
        if (showGrid) addSvg(svg, "line", { x1: x, y1: margin.top, x2: x, y2: margin.top + plotHeight, class: "bases-view-pack-chart-grid" });
        const text = addSvg(svg, "text", { x, y: margin.top + plotHeight + 20, class: "bases-view-pack-chart-tick", "text-anchor": "middle" });
        text.textContent = formatTick(tick, xAxisType);
      });

      const yTicks = buildTicks(yBounds.min, yBounds.max, 5);
      yTicks.forEach(tick => {
        const y = yFor(tick);
        if (showGrid) addSvg(svg, "line", { x1: margin.left, y1: y, x2: width - margin.right, y2: y, class: "bases-view-pack-chart-grid" });
        const text = addSvg(svg, "text", { x: margin.left - 8, y: y + 4, class: "bases-view-pack-chart-tick", "text-anchor": "end" });
        text.textContent = formatNumber(tick);
      });

      // Draw Bubbles
      processedRows.forEach(row => {
        const cx = xFor(row.x);
        const cy = yFor(row.y);
        const r = radiusFor(row.size);

        const group = addSvg(svg, "g", { class: "bases-view-pack-chart-bubble-group", tabindex: "0" });
        group.setAttribute("role", "button");
        group.addEventListener("click", (evt) => this.openEntry(row.entry, evt));

        addSvg(group, "circle", { cx, cy, r, class: "bases-view-pack-chart-bubble" });
        
        const title = addSvg(group, "title");
        title.textContent = `${row.label}\n${xProperty}: ${formatTick(row.x, xAxisType)}\n${yProperty}: ${formatNumber(row.y)}\n${sizeProperty}: ${formatNumber(row.size)}`;

        if (showValues) {
          const text = addSvg(group, "text", { x: cx, y: cy - r - 6, class: "bases-view-pack-chart-value", "text-anchor": "middle" });
          text.textContent = formatNumber(row.size);
        }
      });

      // Axis Labels
      if (showLabels) {
        const xLabel = addSvg(svg, "text", { x: margin.left + plotWidth / 2, y: height - 10, class: "bases-view-pack-chart-axis-label", "text-anchor": "middle" });
        xLabel.textContent = xAxisType === "date" ? "Date" : xProperty.replace(/^note\./, "");
        
        const yLabel = addSvg(svg, "text", { x: 15, y: margin.top + plotHeight / 2, class: "bases-view-pack-chart-axis-label", "text-anchor": "middle", transform: `rotate(-90 15 ${margin.top + plotHeight / 2})` });
        yLabel.textContent = yProperty.replace(/^note\./, "");
      }
    }
  }

  registerView(VIEW_BUBBLE_CHART, {
    name: "Bubble Chart",
    icon: "lucide-circle-dot",
    factory: (controller, containerEl) => new BubbleChartView(plugin.app, controller, containerEl),
    options: () => [
      optionGroup("Dimensions", [
        propertyOption("labelProperty", "Label property", "file.name"),
        propertyOption("dateProperty", "Date property", "file.name"),
        dropdownOption("xAxisType", "X axis type", "number", { number: "Numeric", date: "Date" }),
        propertyOption("xProperty", "X axis property", "note.track_anxiety"),
        propertyOption("yProperty", "Y axis property", "note.track_mood"),
        propertyOption("sizeProperty", "Bubble size property", "note.game_daily_score"),
        sliderOption("limit", "Entry limit", 80, 2, 300, 1),
      ]),
      optionGroup("X Axis", [
        dropdownOption("xAxisMode", "Range mode", "auto", { auto: "Automatic", custom: "Custom" }),
        textOption("xMin", "Min value", "", "Auto when blank"),
        textOption("xMax", "Max value", "", "Auto when blank"),
      ]),
      optionGroup("Y Axis", [
        dropdownOption("yAxisMode", "Range mode", "auto", { auto: "Automatic", custom: "Custom" }),
        textOption("yMin", "Min value", "", "Auto when blank"),
        textOption("yMax", "Max value", "", "Auto when blank"),
      ]),
      optionGroup("Bubble Size", [
        sliderOption("minRadius", "Minimum radius", 4, 1, 40, 1),
        sliderOption("maxRadius", "Maximum radius", 24, 2, 80, 1),
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
      optionGroup("Layout & Style", [
        textOption("displayTitle", "Display title", "", "Default: Bubble Chart"),
        toggleOption("showGrid", "Show grid", true),
        toggleOption("showLabels", "Show axis labels", true),
        toggleOption("showValues", "Show size values", false),
        dropdownOption("colorScheme", "Color scheme", "accent", {
          accent: "Accent",
          green: "Green",
          blue: "Blue",
          purple: "Purple",
          orange: "Orange",
          red: "Red",
          pink: "Pink",
          yellow: "Yellow",
        }),
      ]),
    ],
  });
}

function resolveSimpleRange(values, mode, customMin, customMax) {
  const autoMin = Math.min(0, ...values);
  const autoMax = Math.max(1, ...values);
  let min = mode === "custom" && customMin !== null ? customMin : autoMin;
  let max = mode === "custom" && customMax !== null ? customMax : autoMax;
  if (min === max) max = min + 1;
  if (min > max) [min, max] = [max, min];
  return { min, max };
}

function formatTick(val, type) {
  if (type !== "date") return formatNumber(val);
  const d = new Date(val);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

module.exports = {
  VIEW_BUBBLE_CHART,
  registerBubbleChartView,
};
