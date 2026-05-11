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
  resolveValueRange,
  shortLabel,
  sliderOption,
  sortRows,
  startOfDay,
  textOption,
  toggleOption,
  toNumber,
  buildTicks,
} = require("../../shared");

const VIEW_OVERLAY_CHART = "bases-view-pack-overlay-chart";

function registerOverlayChartView(plugin, BasesViewClass, registerView) {
  const BaseVisualView = createBaseVisualView(BasesViewClass);

  class OverlayChartView extends BaseVisualView {
    constructor(app, controller, parentEl) {
      super(app, controller, parentEl, VIEW_OVERLAY_CHART, "bases-view-pack-overlay-chart-view");
    }

    onDataUpdated() {
      const labelProperty = this.getOption("labelProperty", "file.name");
      const dateProperty = this.getOption("dateProperty", "file.name");
      const limit = clamp(toNumber(this.getOption("limit", "20")) || 20, 2, 120);
      const rangeMode = this.getOption("rangeMode", "rolling-year");
      const startDate = parseDateValue(this.getOption("startDate", ""));
      const endDate = parseDateValue(this.getOption("endDate", ""));
      const referenceDate = parseDateValue(this.getOption("referenceDate", "")) || startOfDay(new Date());
      const days = clamp(toNumber(this.getOption("days", "365")) || 365, 1, 3660);
      const showGrid = this.getOption("showGrid", "true") === "true";
      const showLabels = this.getOption("showLabels", "true") === "true";
      const showPoints = this.getOption("showPoints", "true") === "true";
      const showValues = this.getOption("showValues", "false") === "true";
      const displayTitle = this.getOption("displayTitle", "");
      
      const leftAxisMode = this.getOption("leftYAxisMode", "auto");
      const leftCustomMin = toNumber(this.getOption("leftYMin", ""));
      const leftCustomMax = toNumber(this.getOption("leftYMax", ""));
      
      const rightAxisMode = this.getOption("rightYAxisMode", "auto");
      const rightCustomMin = toNumber(this.getOption("rightYMin", ""));
      const rightCustomMax = toNumber(this.getOption("rightYMax", ""));

      const seriesConfigs = [];
      for (let i = 1; i <= 4; i++) {
        const prop = this.getOption(`series${i}Property`, "");
        if (prop) {
          seriesConfigs.push({
            id: i,
            property: prop,
            type: this.getOption(`series${i}Type`, "line"),
            axis: this.getOption(`series${i}Axis`, "left"),
            color: this.getOption(`series${i}Color`, "auto"),
            pointShape: this.getOption(`series${i}Shape`, "circle"),
          });
        }
      }

      if (seriesConfigs.length === 0) {
        this.renderEmpty("Please configure at least one series property in the settings.");
        return;
      }

      const range = resolveDateRange(rangeMode, startDate, endDate, referenceDate, days);
      const entries = this.getEntries();
      
      // Filter and sort entries first
      const sortedEntries = entries
        .map(entry => ({
          entry,
          date: parseDateValue(this.getValue(entry, dateProperty)),
          label: this.getValue(entry, labelProperty) || (entry.file && entry.file.basename) || "Untitled",
        }))
        .filter(row => isWithinDateRange(row.date, range))
        .sort(sortRows)
        .slice(-limit);

      if (sortedEntries.length < 2) {
        this.renderEmpty("At least two dated entries are needed for the overlay chart.");
        return;
      }

      // Extract series data
      const seriesData = seriesConfigs.map(config => {
        const rows = sortedEntries.map(row => {
          const val = toNumber(this.getValue(row.entry, config.property));
          return {
            ...row,
            value: val,
            hasValue: val !== null
          };
        });
        return { config, rows };
      });

      this.rootEl.empty();
      const panel = this.rootEl.createDiv({ cls: "bases-view-pack-panel bases-view-pack-chart-panel" });
      panel.createDiv({ cls: "bases-view-pack-title", text: displayTitle || "Overlay Chart" });
      
      const width = 760;
      const height = 420;
      const hasRightAxis = seriesConfigs.some(c => c.axis === "right");
      const margin = { 
        top: 30, 
        right: hasRightAxis ? 54 : 24, 
        bottom: showLabels ? 76 : 34, 
        left: 54 
      };
      const plotWidth = width - margin.left - margin.right;
      const plotHeight = height - margin.top - margin.bottom;

      const svg = createSvg(panel, width, height, "bases-view-pack-overlay-chart");

      // Resolve Axis Ranges
      const leftValues = seriesData.filter(s => s.config.axis === "left").flatMap(s => s.rows.filter(r => r.hasValue).map(r => r.value));
      const rightValues = seriesData.filter(s => s.config.axis === "right").flatMap(s => s.rows.filter(r => r.hasValue).map(r => r.value));
      
      const leftBounds = resolveValueRange(leftValues, null, leftAxisMode, leftCustomMin, leftCustomMax);
      const rightBounds = hasRightAxis ? resolveValueRange(rightValues, null, rightAxisMode, rightCustomMin, rightCustomMax) : null;

      const xFor = (index) => margin.left + index / (sortedEntries.length - 1) * plotWidth;
      const yFor = (value, axis) => {
        const bounds = axis === "right" ? rightBounds : leftBounds;
        const vRange = bounds.max - bounds.min || 1;
        const clampedValue = clamp(value, bounds.min, bounds.max);
        return margin.top + (bounds.max - clampedValue) / vRange * plotHeight;
      };

      // Draw Axes
      addSvg(svg, "line", { x1: margin.left, y1: margin.top + plotHeight, x2: width - margin.right, y2: margin.top + plotHeight, class: "bases-view-pack-chart-axis" });
      addSvg(svg, "line", { x1: margin.left, y1: margin.top, x2: margin.left, y2: margin.top + plotHeight, class: "bases-view-pack-chart-axis" });
      if (hasRightAxis) {
        addSvg(svg, "line", { x1: width - margin.right, y1: margin.top, x2: width - margin.right, y2: margin.top + plotHeight, class: "bases-view-pack-chart-axis" });
      }

      // Draw Grid and Ticks (using Left Axis as primary for grid)
      if (showGrid) {
        const ticks = buildTicks(leftBounds.min, leftBounds.max, 5);
        ticks.forEach(tick => {
          const y = yFor(tick, "left");
          addSvg(svg, "line", { x1: margin.left, y1: y, x2: width - margin.right, y2: y, class: "bases-view-pack-chart-grid" });
          const text = addSvg(svg, "text", { x: margin.left - 8, y: y + 4, class: "bases-view-pack-chart-tick", "text-anchor": "end" });
          text.textContent = formatNumber(tick);
        });
      } else {
        // Just Ticks
        const ticks = buildTicks(leftBounds.min, leftBounds.max, 5);
        ticks.forEach(tick => {
          const y = yFor(tick, "left");
          const text = addSvg(svg, "text", { x: margin.left - 8, y: y + 4, class: "bases-view-pack-chart-tick", "text-anchor": "end" });
          text.textContent = formatNumber(tick);
        });
      }

      if (hasRightAxis) {
        const ticks = buildTicks(rightBounds.min, rightBounds.max, 5);
        ticks.forEach(tick => {
          const y = yFor(tick, "right");
          const text = addSvg(svg, "text", { x: width - margin.right + 8, y: y + 4, class: "bases-view-pack-chart-tick", "text-anchor": "start" });
          text.textContent = formatNumber(tick);
        });
      }

      // Draw Series
      seriesData.forEach((series, sIndex) => {
        const { config, rows } = series;
        const colorClass = config.color === "auto" ? `series-color-${config.id}` : `color-${config.color}`;
        const group = addSvg(svg, "g", { class: `bases-view-pack-chart-series ${colorClass}` });
        
        const validPoints = rows.map((row, index) => ({
          row,
          x: xFor(index),
          y: row.hasValue ? yFor(row.value, config.axis) : null,
          hasValue: row.hasValue
        })).filter(p => p.hasValue);

        if (validPoints.length < 1) return;

        if (config.type === "line" || config.type === "area") {
          const pathD = validPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
          if (config.type === "area") {
            const baseline = yFor(clamp(0, (config.axis === "right" ? rightBounds : leftBounds).min, (config.axis === "right" ? rightBounds : leftBounds).max), config.axis);
            const areaD = `${pathD} L ${validPoints[validPoints.length-1].x.toFixed(1)} ${baseline.toFixed(1)} L ${validPoints[0].x.toFixed(1)} ${baseline.toFixed(1)} Z`;
            addSvg(group, "path", { d: areaD, class: "bases-view-pack-chart-area-fill", style: "opacity: 0.2;" });
          }
          addSvg(group, "path", { d: pathD, class: "bases-view-pack-chart-line", fill: "none" });
        }

        if (config.type === "bar") {
          const slot = plotWidth / sortedEntries.length;
          const barWidth = Math.max(2, (slot / seriesConfigs.length) * 0.8);
          const barOffset = (sIndex - (seriesConfigs.length - 1) / 2) * barWidth;
          
          rows.forEach((row, index) => {
            if (!row.hasValue) return;
            const x = xFor(index) + barOffset - barWidth / 2;
            const baseline = yFor(clamp(0, (config.axis === "right" ? rightBounds : leftBounds).min, (config.axis === "right" ? rightBounds : leftBounds).max), config.axis);
            const y = row.value >= 0 ? yFor(row.value, config.axis) : baseline;
            const bHeight = Math.max(1, Math.abs(yFor(row.value, config.axis) - baseline));
            
            const barGroup = addSvg(group, "g", { class: "bases-view-pack-chart-bar-group", tabindex: "0" });
            addSvg(barGroup, "rect", { x, y, width: barWidth, height: bHeight, rx: 2, class: "bases-view-pack-chart-bar" });
            
            if (showValues) {
              const vText = addSvg(barGroup, "text", {
                x: x + barWidth / 2,
                y: row.value >= 0 ? y - 8 : y + bHeight + 14,
                class: "bases-view-pack-chart-value",
                "text-anchor": "middle"
              });
              vText.textContent = formatNumber(row.value);
            }

            const title = addSvg(barGroup, "title");
            title.textContent = `${row.label} (${config.property}): ${formatNumber(row.value)}`;
            
            barGroup.addEventListener("click", (evt) => this.openEntry(row.entry, evt));
          });
        }

        if (config.type === "line" || config.type === "area" || config.type === "scatter") {
          validPoints.forEach(p => {
            if (showPoints || config.type === "scatter") {
              const pGroup = addSvg(group, "g", { class: "bases-view-pack-chart-point-group", tabindex: "0" });
              renderPointShape(pGroup, p.x, p.y, config.pointShape);
              
              if (showValues) {
                const vText = addSvg(pGroup, "text", {
                   x: p.x,
                   y: p.y - 10,
                   class: "bases-view-pack-chart-value",
                   "text-anchor": "middle"
                });
                vText.textContent = formatNumber(p.row.value);
             }

              const title = addSvg(pGroup, "title");
              title.textContent = `${p.row.label} (${config.property}): ${formatNumber(p.row.value)}`;
              pGroup.addEventListener("click", (evt) => this.openEntry(p.row.entry, evt));
            }
          });
        }
      });

      // Draw Labels (Common for all series)
      if (showLabels) {
        sortedEntries.forEach((row, index) => {
          const x = xFor(index);
          const y = margin.top + plotHeight + 24;
          const text = addSvg(svg, "text", { 
            x, y, 
            class: "bases-view-pack-chart-label", 
            "text-anchor": "end",
            transform: `rotate(-38 ${x} ${y})`
          });
          text.textContent = shortLabel(row.label);
        });
      }

      // Draw Legend
      const legendGroup = addSvg(svg, "g", { transform: `translate(${margin.left}, 15)` });
      let legendX = 0;
      seriesConfigs.forEach((config, i) => {
        const colorClass = config.color === "auto" ? `series-color-${config.id}` : `color-${config.color}`;
        const item = addSvg(legendGroup, "g", { class: `bases-view-pack-chart-legend-item ${colorClass}` });
        addSvg(item, "rect", { x: legendX, y: -10, width: 12, height: 12, rx: 2, class: "bases-view-pack-chart-legend-box" });
        const text = addSvg(item, "text", { x: legendX + 16, y: 0, class: "bases-view-pack-chart-legend-text" });
        text.textContent = `${config.property} (${config.axis})`;
        legendX += text.getComputedTextLength ? text.getComputedTextLength() + 40 : 120;
      });
    }
  }

  const seriesOptions = (i) => [
    propertyOption(`series${i}Property`, `Series ${i} Property`, ""),
    dropdownOption(`series${i}Type`, `Series ${i} Type`, "line", {
      line: "Line",
      bar: "Bar",
      area: "Area",
      scatter: "Scatter"
    }),
    dropdownOption(`series${i}Axis`, `Series ${i} Axis`, "left", {
      left: "Left",
      right: "Right"
    }),
    dropdownOption(`series${i}Color`, `Series ${i} Color`, "auto", {
      auto: "Automatic",
      accent: "Accent",
      green: "Green",
      blue: "Blue",
      purple: "Purple",
      orange: "Orange",
      red: "Red",
      pink: "Pink",
      yellow: "Yellow"
    }),
    dropdownOption(`series${i}Shape`, `Series ${i} Point Shape`, "circle", {
      circle: "Circle",
      "filled-circle": "Filled circle",
      x: "X",
      cross: "Cross",
      triangle: "Triangle",
      square: "Square",
      diamond: "Diamond",
    })
  ];

  registerView(VIEW_OVERLAY_CHART, {
    name: "Overlay Chart",
    icon: "lucide-layers",
    factory: (controller, containerEl) => new OverlayChartView(plugin.app, controller, containerEl),
    options: () => [
      optionGroup("Global Data", [
        propertyOption("labelProperty", "Label property", "file.name"),
        propertyOption("dateProperty", "Date property", "file.name"),
        sliderOption("limit", "Limit", 20, 2, 120, 1),
      ]),
      optionGroup("Series 1", seriesOptions(1)),
      optionGroup("Series 2", seriesOptions(2)),
      optionGroup("Series 3", seriesOptions(3)),
      optionGroup("Series 4", seriesOptions(4)),
      optionGroup("Left Y Axis", [
        dropdownOption("leftYAxisMode", "Y axis range", "auto", {
          auto: "Automatic",
          custom: "Custom min and max",
        }),
        textOption("leftYMin", "Y min", "", "Auto when blank"),
        textOption("leftYMax", "Y max", "", "Auto when blank"),
      ]),
      optionGroup("Right Y Axis", [
        dropdownOption("rightYAxisMode", "Y axis range", "auto", {
          auto: "Automatic",
          custom: "Custom min and max",
        }),
        textOption("rightYMin", "Y min", "", "Auto when blank"),
        textOption("rightYMax", "Y max", "", "Auto when blank"),
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
      optionGroup("Layout & Display", [
        textOption("displayTitle", "Display title", "", "Default: Overlay Chart"),
        toggleOption("showGrid", "Show grid", true),
        toggleOption("showLabels", "Show labels", true),
        toggleOption("showPoints", "Show points", true),
        toggleOption("showValues", "Show values", false),
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

function renderPointShape(parent, x, y, shape) {
  const size = 4;
  if (shape === "filled-circle") {
    addSvg(parent, "circle", { cx: x, cy: y, r: size, class: "bases-view-pack-chart-point is-filled" });
    return;
  }
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
  if (shape === "triangle") {
    addSvg(parent, "polygon", {
      points: `${x},${y - size - 1} ${x + size + 1},${y + size} ${x - size - 1},${y + size}`,
      class: "bases-view-pack-chart-point-shape",
    });
    return;
  }
  if (shape === "square") {
    addSvg(parent, "rect", { x: x - size, y: y - size, width: size * 2, height: size * 2, rx: 1, class: "bases-view-pack-chart-point-shape" });
    return;
  }
  if (shape === "diamond") {
    addSvg(parent, "polygon", {
      points: `${x},${y - size - 2} ${x + size + 2},${y} ${x},${y + size + 2} ${x - size - 2},${y}`,
      class: "bases-view-pack-chart-point-shape",
    });
    return;
  }
  addSvg(parent, "circle", { cx: x, cy: y, r: size, class: "bases-view-pack-chart-point" });
}

module.exports = {
  VIEW_OVERLAY_CHART,
  registerOverlayChartView,
};
