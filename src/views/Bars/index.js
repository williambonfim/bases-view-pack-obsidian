const {
  clamp,
  createBaseVisualView,
  propertyOption,
  sliderOption,
  textOption,
  toNumber,
} = require("../../shared");

const VIEW_BARS = "bases-view-pack-metric-bars";

function registerBarsView(plugin, BasesViewClass, registerView) {
  const BaseVisualView = createBaseVisualView(BasesViewClass);

  class BarsView extends BaseVisualView {
    constructor(app, controller, parentEl) {
      super(app, controller, parentEl, VIEW_BARS, "bases-view-pack-bars-view");
    }

    onDataUpdated() {
      const labelProperty = this.getOption("labelProperty", "file.name");
      const valueProperty = this.getOption("valueProperty", "game_weekly_score");
      const detailProperty = this.getOption("detailProperty", "");
      const limit = clamp(toNumber(this.getOption("limit", "16")) || 16, 1, 80);
      const displayTitle = this.getOption("displayTitle", "");
      const rows = this.getEntries()
        .map((entry) => {
          const rawValue = this.getValue(entry, valueProperty);
          const value = toNumber(rawValue);
          return {
            entry,
            label: this.getValue(entry, labelProperty) || (entry.file && entry.file.basename) || "Untitled",
            value,
            hasValue: value !== null,
            detail: this.getValue(entry, detailProperty),
          };
        })
        .filter((row) => row.hasValue)
        .sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { numeric: true }))
        .slice(-limit);

      if (!rows.length) {
        this.renderEmpty(`No numeric rows match ${valueProperty}.`);
        return;
      }

      this.rootEl.empty();
      const panel = this.rootEl.createDiv({ cls: "bases-view-pack-panel" });
      panel.createDiv({ cls: "bases-view-pack-title", text: displayTitle || "Metric Bars" });
      const max = Math.max(1, ...rows.map((row) => row.value));
      const list = panel.createDiv({ cls: "bases-view-pack-metric-bars" });
      for (const row of rows) {
        const item = list.createDiv({ cls: "bases-view-pack-bar-row" });
        item.setAttribute("role", "button");
        item.setAttribute("tabindex", "0");
        item.addEventListener("click", (evt) => this.openEntry(row.entry, evt));
        item.addEventListener("keydown", (evt) => {
          if (evt.key === "Enter" || evt.key === " ") {
            evt.preventDefault();
            this.openEntry(row.entry, evt);
          }
        });
        item.createDiv({ cls: "bases-view-pack-bar-label", text: row.label });
        const track = item.createDiv({ cls: "bases-view-pack-bar-track" });
        track.createDiv({ cls: "bases-view-pack-bar-fill", attr: { style: `width:${row.value > 0 ? Math.max(4, row.value / max * 100) : 0}%` } });
        item.createDiv({ cls: "bases-view-pack-bar-value", text: row.detail ? `${row.value} / ${row.detail}` : String(row.value) });
      }
    }
  }

  registerView(VIEW_BARS, {
    name: "Metric Bars",
    icon: "lucide-bar-chart-3",
    factory: (controller, containerEl) => new BarsView(plugin.app, controller, containerEl),
    options: () => [
      textOption("displayTitle", "Display title", "", "Default: Metric Bars"),
      propertyOption("labelProperty", "Label property", "file.name"),
      propertyOption("valueProperty", "Value property", "note.game_weekly_score"),
      propertyOption("detailProperty", "Detail property", ""),
      sliderOption("limit", "Limit", 16, 1, 80, 1),
    ],
  });
}

module.exports = {
  VIEW_BARS,
  registerBarsView,
};
