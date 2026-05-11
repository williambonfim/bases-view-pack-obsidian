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
  shortLabel,
  sliderOption,
  sortRows,
  startOfDay,
  textOption,
  toggleOption,
  toNumber,
} = require("../../shared");

const VIEW_POLAR_AREA_CHART = "bases-view-pack-polar-area-chart";

function registerPolarAreaChartView(plugin, BasesViewClass, registerView) {
  const BaseVisualView = createBaseVisualView(BasesViewClass);

  class PolarAreaChartView extends BaseVisualView {
    constructor(app, controller, parentEl) {
      super(app, controller, parentEl, VIEW_POLAR_AREA_CHART, "bases-view-pack-polar-area-chart-view");
    }

    onDataUpdated() {
      const labelProperty = this.getOption("labelProperty", "file.name");
      const dateProperty = this.getOption("dateProperty", "file.name");
      const valueProperty = this.getOption("valueProperty", "hp");
      const limit = clamp(toNumber(this.getOption("limit", "12")) || 12, 3, 40);
      const rangeMode = this.getOption("rangeMode", "all");
      const startDate = parseDateValue(this.getOption("startDate", ""));
      const endDate = parseDateValue(this.getOption("endDate", ""));
      const referenceDate = parseDateValue(this.getOption("referenceDate", "")) || startOfDay(new Date());
      const days = clamp(toNumber(this.getOption("days", "365")) || 365, 1, 3660);
      const colorScheme = this.getOption("colorScheme", "balanced");
      const showLabels = this.getOption("showLabels", "true") === "true";
      const showValues = this.getOption("showValues", "true") === "true";
      const showGrid = this.getOption("showGrid", "true") === "true";
      const displayTitle = this.getOption("displayTitle", "");

      const range = resolveDateRange(rangeMode, startDate, endDate, referenceDate, days);
      const rows = this.getEntries()
        .map((entry) => {
          const val = toNumber(this.getValue(entry, valueProperty));
          const dateVal = this.getValue(entry, dateProperty);
          const date = parseDateValue(dateVal);
          return {
            entry,
            label: this.getValue(entry, labelProperty) || (entry.file && entry.file.basename) || "Untitled",
            date,
            value: val,
            hasValue: val !== null,
          };
        })
        .filter((row) => row.hasValue && row.value >= 0)
        .filter((row) => isWithinDateRange(row.date, range))
        .sort(sortRows)
        .slice(-limit);

      if (rows.length < 3) {
        this.renderEmpty(`At least 3 numeric rows (value >= 0) are needed for ${valueProperty}. Check your filters and settings.`);
        return;
      }

      this.rootEl.empty();
      const panel = this.rootEl.createDiv({ cls: "bases-view-pack-panel bases-view-pack-chart-panel" });
      panel.createDiv({ cls: "bases-view-pack-title", text: displayTitle || "Polar Area Chart" });
      
      const width = 560;
      const height = 500; // Increased height for labels
      const centerX = width / 2;
      const centerY = height / 2;
      const maxRadius = Math.min(width, height) / 2 - 60;
      const svg = createSvg(panel, width, height, "bases-view-pack-polar-area-chart");
      svg.setAttribute("data-color-scheme", colorScheme);

      const maxValue = Math.max(...rows.map(r => r.value), 1);
      const angleStep = (Math.PI * 2) / rows.length;

      // Draw Grid Rings
      if (showGrid) {
        for (let i = 1; i <= 4; i++) {
          const r = (maxRadius * i) / 4;
          addSvg(svg, "circle", { cx: centerX, cy: centerY, r, class: "bases-view-pack-chart-grid", fill: "none" });
        }
      }

      // Draw Slices
      rows.forEach((row, i) => {
        const startAngle = i * angleStep - Math.PI / 2;
        const endAngle = (i + 1) * angleStep - Math.PI / 2;
        // Minimum radius of 5 for visibility of zero values
        const radius = Math.max(5, (row.value / maxValue) * maxRadius);
        
        const group = addSvg(svg, "g", { class: "bases-view-pack-chart-slice-group", tabindex: "0" });
        group.setAttribute("role", "button");
        group.addEventListener("click", (evt) => this.openEntry(row.entry, evt));

        const path = buildSlicePath(centerX, centerY, radius, startAngle, endAngle);
        addSvg(group, "path", { d: path, class: `bases-view-pack-chart-slice slice-${i % 8}` });

        const title = addSvg(group, "title");
        title.textContent = `${row.label}: ${formatNumber(row.value)}`;

        // Label and value
        const midAngle = startAngle + angleStep / 2;
        if (showLabels || showValues) {
          const labelDist = radius + 15;
          const lx = centerX + Math.cos(midAngle) * labelDist;
          const ly = centerY + Math.sin(midAngle) * labelDist;
          
          const labelGroup = addSvg(group, "g", { class: "bases-view-pack-chart-label-group" });
          let anchor = "middle";
          if (lx < centerX - 40) anchor = "end";
          else if (lx > centerX + 40) anchor = "start";

          if (showLabels) {
            const text = addSvg(labelGroup, "text", { x: lx, y: ly, "text-anchor": anchor, class: "bases-view-pack-chart-label" });
            text.textContent = shortLabel(row.label);
          }
          if (showValues) {
            const text = addSvg(labelGroup, "text", { x: lx, y: ly + (showLabels ? 14 : 0), "text-anchor": anchor, class: "bases-view-pack-chart-value" });
            text.textContent = formatNumber(row.value);
          }
        }
      });
    }
  }

  registerView(VIEW_POLAR_AREA_CHART, {
    name: "Polar Area Chart",
    icon: "lucide-circle-dashed",
    factory: (controller, containerEl) => new PolarAreaChartView(plugin.app, controller, containerEl),
    options: () => [
      optionGroup("Data", [
        propertyOption("labelProperty", "Label property", "file.name"),
        propertyOption("dateProperty", "Date property", "file.name"),
        propertyOption("valueProperty", "Value property", "hp"),
        sliderOption("limit", "Limit", 12, 3, 40, 1),
      ]),
      optionGroup("Date Range", [
        textOption("startDate", "Start date", "", "YYYY-MM-DD"),
        textOption("endDate", "End date", "", "YYYY-MM-DD"),
        dropdownOption("rangeMode", "Fallback range mode", "all", {
          all: "All dates",
          "rolling-year": "Rolling year",
          days: "Custom days",
        }),
        sliderOption("days", "Days to show", 365, 1, 3660, 1),
      ]),
      optionGroup("Layout & Display", [
        textOption("displayTitle", "Display title", "", "Default: Polar Area Chart"),
        toggleOption("showGrid", "Show grid", true),
        toggleOption("showLabels", "Show labels", true),
        toggleOption("showValues", "Show values", true),
      ]),
      optionGroup("Appearance", [
        dropdownOption("colorScheme", "Color scheme", "balanced", {
          balanced: "Balanced",
          warm: "Warm",
          cool: "Cool",
          neutral: "Neutral",
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

function buildSlicePath(cx, cy, r, startAngle, endAngle) {
  const x1 = cx + Math.cos(startAngle) * r;
  const y1 = cy + Math.sin(startAngle) * r;
  const x2 = cx + Math.cos(endAngle) * r;
  const y2 = cy + Math.sin(endAngle) * r;
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

module.exports = {
  VIEW_POLAR_AREA_CHART,
  registerPolarAreaChartView,
};
