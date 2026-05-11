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

const VIEW_PIE_CHART = "bases-view-pack-pie-chart";

function registerPieChartView(plugin, BasesViewClass, registerView) {
  const BaseVisualView = createBaseVisualView(BasesViewClass);

  class PieChartView extends BaseVisualView {
    constructor(app, controller, parentEl) {
      super(app, controller, parentEl, VIEW_PIE_CHART, "bases-view-pack-pie-chart-view");
    }

    onDataUpdated() {
      const labelProperty = this.getOption("labelProperty", "file.name");
      const dateProperty = this.getOption("dateProperty", "file.name");
      const valueProperty = this.getOption("valueProperty", "xp");
      const detailProperty = this.getOption("detailProperty", "");
      const rangeMode = this.getOption("rangeMode", "all");
      const startDate = parsePieDateValue(this.getOption("startDate", ""));
      const endDate = parsePieDateValue(this.getOption("endDate", ""));
      const referenceDate = parsePieDateValue(this.getOption("referenceDate", "")) || startOfPieDay(new Date());
      const days = clamp(toNumber(this.getOption("days", "365")) || 365, 1, 3660);
      const valueMode = this.getOption("valueMode", "auto");
      const minValue = toNumber(this.getOption("minValue", ""));
      const maxValue = toNumber(this.getOption("maxValue", ""));
      const limit = clamp(toNumber(this.getOption("limit", "12")) || 12, 2, 60);
      const showLegend = this.getOption("showLegend", "true") === "true";
      const showLabels = this.getOption("showLabels", "true") === "true";
      const showValues = this.getOption("showValues", "true") === "true";
      const sortMode = this.getOption("sortMode", "value-desc");
      const colorScheme = this.getOption("colorScheme", "balanced");
      const donutCutout = clamp(toNumber(this.getOption("donutCutout", "0")) || 0, 0, 85);
      const displayTitle = this.getOption("displayTitle", "");
      const range = resolvePieDateRange(rangeMode, startDate, endDate, referenceDate, days);

      const rows = this.getEntries()
        .map((entry) => {
          const value = toNumber(this.getValue(entry, valueProperty));
          const date = parsePieDateValue(this.getValue(entry, dateProperty));
          return {
            entry,
            label: this.getValue(entry, labelProperty) || (entry.file && entry.file.basename) || "Untitled",
            date,
            value,
            detail: detailProperty ? this.getValue(entry, detailProperty) : "",
            hasValue: value !== null,
          };
        })
        .filter((row) => row.hasValue)
        .filter((row) => isWithinPieDateRange(row.date, range))
        .filter((row) => isWithinPieValueRange(row.value, valueMode, minValue, maxValue))
        .sort((a, b) => sortPieRows(a, b, sortMode))
        .slice(0, limit);

      if (!rows.length) {
        this.renderEmpty(`No numeric rows match ${valueProperty}.`);
        return;
      }

      const total = rows.reduce((sum, row) => sum + Math.max(0, row.value), 0);
      if (total <= 0) {
        this.renderEmpty(`No positive values match ${valueProperty}.`);
        return;
      }

      this.rootEl.empty();
      const panel = this.rootEl.createDiv({ cls: "bases-view-pack-panel bases-view-pack-chart-panel" });
      panel.createDiv({ cls: "bases-view-pack-title", text: displayTitle || "Pie Chart" });
      const shell = panel.createDiv({ cls: "bases-view-pack-pie-shell" });
      const svgWrap = shell.createDiv({ cls: "bases-view-pack-pie-canvas" });
      const svg = createPieSvg(svgWrap, 420, 320, "bases-view-pack-pie-chart");
      svg.setAttribute("data-color-scheme", colorScheme);

      const cx = 160;
      const cy = 160;
      const radius = 116;
      const innerRadius = radius * donutCutout / 100;
      let angle = -Math.PI / 2;

      rows.forEach((row, index) => {
        const sliceAngle = (Math.max(0, row.value) / total) * Math.PI * 2;
        const nextAngle = angle + sliceAngle;
        const group = addPieSvg(svg, "g", { class: "bases-view-pack-chart-slice-group", tabindex: "0" });
        group.setAttribute("role", "button");
        group.addEventListener("click", (evt) => this.openEntry(row.entry, evt));
        group.addEventListener("keydown", (evt) => {
          if (evt.key === "Enter" || evt.key === " ") {
            evt.preventDefault();
            this.openEntry(row.entry, evt);
          }
        });
        const title = addPieSvg(group, "title");
        title.textContent = `${row.label}: ${formatPieNumber(row.value)} (${formatPiePercent(row.value / total)})`;
        addPieSvg(group, "path", {
          d: describePieArc(cx, cy, radius, innerRadius, angle, nextAngle),
          class: `bases-view-pack-chart-slice slice-${index % 8}`,
        });
        if (showLabels && sliceAngle > 0.28) {
          const mid = angle + sliceAngle / 2;
          const labelPoint = polar(cx, cy, innerRadius ? (radius + innerRadius) / 2 : radius * 0.62, mid);
          const text = addPieSvg(group, "text", {
            x: labelPoint.x,
            y: labelPoint.y,
            class: "bases-view-pack-chart-slice-label",
            "text-anchor": "middle",
          });
          text.textContent = shortPieLabel(row.label);
        }
        angle = nextAngle;
      });

      if (innerRadius > 0) {
        addPieSvg(svg, "circle", { cx, cy, r: innerRadius, class: "bases-view-pack-chart-slice-hole" });
      }
      const totalText = addPieSvg(svg, "text", { x: cx, y: cy - 6, class: "bases-view-pack-chart-total", "text-anchor": "middle" });
      totalText.textContent = formatPieNumber(total);
      const totalLabel = addPieSvg(svg, "text", { x: cx, y: cy + 16, class: "bases-view-pack-chart-total-label", "text-anchor": "middle" });
      totalLabel.textContent = "Total";

      if (showLegend) {
        const legend = shell.createDiv({ cls: "bases-view-pack-pie-legend" });
        rows.forEach((row, index) => {
          const item = legend.createDiv({ cls: "bases-view-pack-pie-legend-item" });
          item.setAttribute("role", "button");
          item.setAttribute("tabindex", "0");
          item.addEventListener("click", (evt) => this.openEntry(row.entry, evt));
          item.addEventListener("keydown", (evt) => {
            if (evt.key === "Enter" || evt.key === " ") {
              evt.preventDefault();
              this.openEntry(row.entry, evt);
            }
          });
          item.createDiv({ cls: `bases-view-pack-pie-swatch slice-${index % 8}` });
          const textBlock = item.createDiv({ cls: "bases-view-pack-pie-legend-text" });
          textBlock.createDiv({ cls: "bases-view-pack-pie-legend-label", text: row.label });
          const meta = [];
          if (showValues) meta.push(formatPieNumber(row.value));
          meta.push(formatPiePercent(row.value / total));
          if (row.detail) meta.push(String(row.detail));
          textBlock.createDiv({ cls: "bases-view-pack-pie-legend-meta", text: meta.join("  ") });
        });
      }
    }
  }

  registerView(VIEW_PIE_CHART, {
    name: "Pie Chart",
    icon: "lucide-chart-pie",
    factory: (controller, containerEl) => new PieChartView(plugin.app, controller, containerEl),
    options: () => [
      optionGroup("Data", [
        propertyOption("labelProperty", "Label property", "file.name"),
        propertyOption("dateProperty", "Date property", "file.name"),
        propertyOption("valueProperty", "Value property", "note.xp"),
        propertyOption("detailProperty", "Detail property", ""),
        sliderOption("limit", "Limit", 12, 2, 60, 1),
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
        textOption("referenceDate", "Reference date", "", "YYYY-MM-DD"),
      ]),
      optionGroup("Value Range", [
        dropdownOption("valueMode", "Value filter", "auto", {
          auto: "All values",
          custom: "Custom min and max",
        }),
        textOption("minValue", "Min value", "", "Auto when blank"),
        textOption("maxValue", "Max value", "", "Auto when blank"),
      ]),
      optionGroup("Layout & Display", [
        textOption("displayTitle", "Display title", "", "Default: Pie Chart"),
        dropdownOption("sortMode", "Sort", "value-desc", {
          "value-desc": "Value descending",
          "value-asc": "Value ascending",
          "label-asc": "Label ascending",
        }),
        toggleOption("showLegend", "Show legend", true),
        toggleOption("showLabels", "Show slice labels", true),
        toggleOption("showValues", "Show values", true),
      ]),
      optionGroup("Appearance", [
        sliderOption("donutCutout", "Center cutout", 0, 0, 85, 1),
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

function createPieSvg(parent, width, height, cls) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("class", cls);
  parent.appendChild(svg);
  return svg;
}

function addPieSvg(parent, tag, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs || {})) el.setAttribute(key, String(value));
  parent.appendChild(el);
  return el;
}

function polar(cx, cy, radius, angle) {
  return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
}

function describePieArc(cx, cy, outerRadius, innerRadius, startAngle, endAngle) {
  const startOuter = polar(cx, cy, outerRadius, startAngle);
  const endOuter = polar(cx, cy, outerRadius, endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  if (innerRadius <= 0) {
    return [
      `M ${cx} ${cy}`,
      `L ${startOuter.x} ${startOuter.y}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
      "Z",
    ].join(" ");
  }
  const endInner = polar(cx, cy, innerRadius, endAngle);
  const startInner = polar(cx, cy, innerRadius, startAngle);
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${endInner.x} ${endInner.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${startInner.x} ${startInner.y}`,
    "Z",
  ].join(" ");
}

function parsePieDateValue(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const dateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) return startOfPieDay(new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3])));
  const weekMatch = text.match(/^(\d{4})-W(\d{2})/i);
  if (weekMatch) return pieIsoWeekStart(Number(weekMatch[1]), Number(weekMatch[2]));
  const monthMatch = text.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) return startOfPieDay(new Date(Number(monthMatch[1]), Number(monthMatch[2]) - 1, 1));
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : startOfPieDay(parsed);
}

function startOfPieDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function pieIsoWeekStart(year, week) {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const day = simple.getDay() || 7;
  if (day <= 4) simple.setDate(simple.getDate() - day + 1);
  else simple.setDate(simple.getDate() + 8 - day);
  return startOfPieDay(simple);
}

function addPieDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfPieDay(next);
}

function resolvePieDateRange(mode, startDate, endDate, referenceDate, days) {
  if (startDate && endDate) return { start: startDate, end: endDate };
  if (mode === "all") return null;
  const end = endDate || referenceDate;
  const span = mode === "rolling-year" ? 365 : days;
  return { start: addPieDays(end, -(span - 1)), end };
}

function isWithinPieDateRange(date, range) {
  if (!range) return true;
  if (!date) return false;
  return date >= range.start && date <= range.end;
}

function isWithinPieValueRange(value, mode, minValue, maxValue) {
  if (mode !== "custom") return true;
  if (minValue !== null && value < minValue) return false;
  if (maxValue !== null && value > maxValue) return false;
  return true;
}

function sortPieRows(a, b, sortMode) {
  if (sortMode === "value-asc") return a.value - b.value;
  if (sortMode === "label-asc") return String(a.label).localeCompare(String(b.label), undefined, { numeric: true });
  return b.value - a.value;
}

function formatPieNumber(value) {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value) >= 100) return String(Math.round(value));
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

function formatPiePercent(value) {
  return `${Math.round(value * 100)}%`;
}

function shortPieLabel(value) {
  const text = String(value || "");
  return text.length > 14 ? `${text.slice(0, 12)}...` : text;
}

module.exports = {
  VIEW_PIE_CHART,
  registerPieChartView,
};
