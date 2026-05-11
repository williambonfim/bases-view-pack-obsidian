const {
  clamp,
  createBaseVisualView,
  propertyOption,
  textOption,
  toNumber,
} = require("../../shared");

const VIEW_RADAR = "bases-view-pack-radar-chart";

function registerRadarView(plugin, BasesViewClass, registerView) {
  const BaseVisualView = createBaseVisualView(BasesViewClass);

  class RadarView extends BaseVisualView {
    constructor(app, controller, parentEl) {
      super(app, controller, parentEl, VIEW_RADAR, "bases-view-pack-radar-view");
    }

    onDataUpdated() {
      const labelProperty = this.getOption("labelProperty", "area");
      const valueProperty = this.getOption("valueProperty", "hp");
      const maxProperty = this.getOption("maxProperty", "max_hp");
      const displayTitle = this.getOption("displayTitle", "");
      const rows = this.getEntries().map((entry) => ({
        entry,
        label: this.getValue(entry, labelProperty) || (entry.file && entry.file.basename) || "Untitled",
        value: clamp(toNumber(this.getValue(entry, valueProperty)) ?? 0, 0, toNumber(this.getValue(entry, maxProperty)) || 100),
        max: toNumber(this.getValue(entry, maxProperty)) || 100,
      }));

      if (!rows.length) {
        this.renderEmpty("No area rows match this Base.");
        return;
      }

      this.rootEl.empty();
      const panel = this.rootEl.createDiv({ cls: "bases-view-pack-panel" });
      panel.createDiv({ cls: "bases-view-pack-title", text: displayTitle || "Area HP Radar" });
      const svg = createSvg(panel, 560, 430, "bases-view-pack-radar-chart");
      const cx = 280;
      const cy = 218;
      const radius = 132;
      const values = rows.map((row) => clamp((row.value / row.max) * 100, 0, 100));

      for (const ring of [25, 50, 75, 100]) {
        addSvg(svg, "polygon", {
          points: values.map((_, index) => radarPoint(index, values.length, cx, cy, radius * ring / 100)).join(" "),
          class: "bases-view-pack-radar-ring",
        });
      }

      rows.forEach((row, index) => {
        const axis = radarCoords(index, rows.length, cx, cy, radius);
        const label = radarCoords(index, rows.length, cx, cy, radius + 24);
        addSvg(svg, "line", { x1: cx, y1: cy, x2: axis.x, y2: axis.y, class: "bases-view-pack-radar-axis" });
        const text = addSvg(svg, "text", {
          x: label.x,
          y: label.y,
          class: row.value < 40 ? "bases-view-pack-radar-label is-low" : "bases-view-pack-radar-label",
          "text-anchor": label.x < cx - 10 ? "end" : label.x > cx + 10 ? "start" : "middle",
        });
        text.textContent = `${shortLabel(row.label)} ${Math.round(row.value)}`;
      });

      addSvg(svg, "polygon", {
        points: values.map((value, index) => radarPoint(index, values.length, cx, cy, radius * value / 100)).join(" "),
        class: "bases-view-pack-radar-area",
      });

      values.forEach((value, index) => {
        const point = radarCoords(index, values.length, cx, cy, radius * value / 100);
        addSvg(svg, "circle", { cx: point.x, cy: point.y, r: 4, class: value < 40 ? "bases-view-pack-radar-dot is-low" : "bases-view-pack-radar-dot" });
      });
    }
  }

  registerView(VIEW_RADAR, {
    name: "Area HP Radar",
    icon: "lucide-radar",
    factory: (controller, containerEl) => new RadarView(plugin.app, controller, containerEl),
    options: () => [
      textOption("displayTitle", "Display title", "", "Default: Area HP Radar"),
      propertyOption("labelProperty", "Label property", "note.area"),
      propertyOption("valueProperty", "Value property", "note.hp"),
      propertyOption("maxProperty", "Max property", "note.max_hp"),
      propertyOption("statusProperty", "Status property", "note.status"),
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

function radarCoords(index, total, centerX, centerY, radius) {
  const angle = (Math.PI * 2 * index / total) - Math.PI / 2;
  return { x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius };
}

function radarPoint(index, total, centerX, centerY, radius) {
  const point = radarCoords(index, total, centerX, centerY, radius);
  return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
}

function shortLabel(text) {
  return String(text)
    .replace("Mental Wellbeing", "Mental")
    .replace("Creativity/Fun", "Creative")
    .replace("Music Studies", "Music")
    .replace("Home & Admin", "Home");
}

module.exports = {
  VIEW_RADAR,
  registerRadarView,
};
