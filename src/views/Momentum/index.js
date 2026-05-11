const {
  clamp,
  createBaseVisualView,
  propertyOption,
  sliderOption,
  textOption,
  toNumber,
} = require("../../shared");

const VIEW_MOMENTUM = "bases-view-pack-momentum-cards";

function registerMomentumView(plugin, BasesViewClass, registerView) {
  const BaseVisualView = createBaseVisualView(BasesViewClass);

  class MomentumView extends BaseVisualView {
    constructor(app, controller, parentEl) {
      super(app, controller, parentEl, VIEW_MOMENTUM, "bases-view-pack-momentum-view");
    }

    onDataUpdated() {
      const dateProperty = this.getOption("dateProperty", "file.name");
      const signalProperty = this.getOption("signalProperty", "game_momentum_signal");
      const areaProperty = this.getOption("areaProperty", "game_main_area");
      const actionProperty = this.getOption("actionProperty", "game_main_quest");
      const scoreProperty = this.getOption("scoreProperty", "game_daily_score");
      const limit = clamp(toNumber(this.getOption("limit", "12")) || 12, 1, 50);
      const displayTitle = this.getOption("displayTitle", "");
      const rows = this.getEntries()
        .map((entry) => ({
          entry,
          date: this.getValue(entry, dateProperty) || (entry.file && entry.file.basename) || "",
          signal: this.getValue(entry, signalProperty) || this.getValue(entry, "game_boss_triggered") || this.getValue(entry, "note.game_boss_triggered"),
          area: this.getValue(entry, areaProperty),
          action: this.getValue(entry, actionProperty),
          score: this.getValue(entry, scoreProperty),
        }))
        .filter((row) => row.signal)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, limit);

      if (!rows.length) {
        this.renderEmpty("No active momentum signals match this Base.");
        return;
      }

      this.rootEl.empty();
      const panel = this.rootEl.createDiv({ cls: "bases-view-pack-panel bases-view-pack-momentum-panel" });
      panel.createDiv({ cls: "bases-view-pack-title", text: displayTitle || "Recover Momentum" });
      const cards = panel.createDiv({ cls: "bases-view-pack-momentum-cards" });
      for (const row of rows) {
        const card = cards.createDiv({ cls: "bases-view-pack-momentum-card" });
        card.setAttribute("role", "button");
        card.setAttribute("tabindex", "0");
        card.setAttribute("aria-label", `${row.date}: ${row.signal}`);
        card.addEventListener("click", (evt) => this.openEntry(row.entry, evt));
        card.addEventListener("keydown", (evt) => {
          if (evt.key === "Enter" || evt.key === " ") {
            evt.preventDefault();
            this.openEntry(row.entry, evt);
          }
        });
        const header = card.createDiv({ cls: "bases-view-pack-momentum-card-header" });
        header.createDiv({ cls: "bases-view-pack-card-date", text: row.date });
        header.createDiv({ cls: "bases-view-pack-card-score", text: row.score ? `Score ${row.score}` : "Score 0" });
        const signals = card.createDiv({ cls: "bases-view-pack-card-signals" });
        const signalList = splitSignals(row.signal);
        if (!signalList.length) signalList.push("Momentum signal");
        signalList.forEach((signal) => {
          signals.createSpan({ cls: "bases-view-pack-card-signal", text: signal });
        });
        card.createDiv({ cls: "bases-view-pack-card-meta", text: row.area ? `Area: ${row.area}` : "Area not set" });
        card.createDiv({ cls: "bases-view-pack-card-action", text: row.action ? `Action: ${row.action}` : "Pick a tiny recovery action" });
      }
    }
  }

  registerView(VIEW_MOMENTUM, {
    name: "Momentum Cards",
    icon: "lucide-activity",
    factory: (controller, containerEl) => new MomentumView(plugin.app, controller, containerEl),
    options: () => [
      textOption("displayTitle", "Display title", "", "Default: Recover Momentum"),
      propertyOption("dateProperty", "Date property", "file.name"),
      propertyOption("signalProperty", "Signal property", "note.game_momentum_signal"),
      propertyOption("areaProperty", "Area property", "note.game_main_area"),
      propertyOption("actionProperty", "Action property", "note.game_main_quest"),
      propertyOption("scoreProperty", "Score property", "note.game_daily_score"),
      sliderOption("limit", "Limit", 12, 1, 50, 1),
    ],
  });
}

function splitSignals(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

module.exports = {
  VIEW_MOMENTUM,
  registerMomentumView,
};
