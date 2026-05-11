const {
  clamp,
  createBaseVisualView,
  propertyOption,
  sliderOption,
  textOption,
  toNumber,
} = require("../../shared");

const VIEW_QUESTS = "bases-view-pack-quest-cards";

function registerQuestCardsView(plugin, BasesViewClass, registerView) {
  const BaseVisualView = createBaseVisualView(BasesViewClass);

  class QuestCardsView extends BaseVisualView {
    constructor(app, controller, parentEl) {
      super(app, controller, parentEl, VIEW_QUESTS, "bases-view-pack-quest-view");
    }

    onDataUpdated() {
      const nameProperty = this.getOption("nameProperty", "file.name");
      const areaProperty = this.getOption("areaProperty", "area");
      const skillProperty = this.getOption("skillProperty", "skill");
      const difficultyProperty = this.getOption("difficultyProperty", "difficulty");
      const xpProperty = this.getOption("xpProperty", "xp_reward");
      const statusProperty = this.getOption("statusProperty", "quest_status");
      const limit = clamp(toNumber(this.getOption("limit", "12")) || 12, 1, 50);
      const displayTitle = this.getOption("displayTitle", "");

      const rows = this.getEntries()
        .map((entry) => ({
          entry,
          name: this.getValue(entry, nameProperty),
          area: this.getValue(entry, areaProperty),
          skill: this.getValue(entry, skillProperty),
          difficulty: this.getValue(entry, difficultyProperty),
          xp: this.getValue(entry, xpProperty),
          status: this.getValue(entry, statusProperty),
        }))
        .slice(0, limit);

      if (!rows.length) {
        this.renderEmpty("No quests match this Base.");
        return;
      }

      this.rootEl.empty();
      const panel = this.rootEl.createDiv({ cls: "bases-view-pack-panel bases-view-pack-quest-panel" });
      panel.createDiv({ cls: "bases-view-pack-title", text: displayTitle || "Active Quests" });
      const cards = panel.createDiv({ cls: "bases-view-pack-quest-cards" });

      for (const row of rows) {
        const card = cards.createDiv({ cls: "bases-view-pack-quest-card" });
        card.setAttribute("role", "button");
        card.setAttribute("tabindex", "0");
        card.addEventListener("click", (evt) => this.openEntry(row.entry, evt));
        card.addEventListener("keydown", (evt) => {
          if (evt.key === "Enter" || evt.key === " ") {
            evt.preventDefault();
            this.openEntry(row.entry, evt);
          }
        });

        const header = card.createDiv({ cls: "bases-view-pack-quest-card-header" });
        header.createDiv({ cls: "bases-view-pack-card-name", text: row.name });
        if (row.status) {
          header.createDiv({ cls: `bases-view-pack-card-status status-${row.status.toLowerCase().replace(/\s+/g, "-")}`, text: row.status });
        }

        const body = card.createDiv({ cls: "bases-view-pack-quest-card-body" });
        if (row.area || row.skill) {
          body.createDiv({ cls: "bases-view-pack-card-meta", text: [row.area, row.skill].filter(Boolean).join(" • ") });
        }
        if (row.difficulty) {
          body.createDiv({ cls: "bases-view-pack-card-difficulty", text: `Difficulty: ${row.difficulty}` });
        }
        if (row.xp) {
          card.createDiv({ cls: "bases-view-pack-card-reward", text: `+${row.xp} XP` });
        }
      }
    }
  }

  registerView(VIEW_QUESTS, {
    name: "Quest Cards",
    icon: "lucide-scroll",
    factory: (controller, containerEl) => new QuestCardsView(plugin.app, controller, containerEl),
    options: () => [
      textOption("displayTitle", "Display title", "", "Default: Active Quests"),
      propertyOption("nameProperty", "Name property", "file.name"),
      propertyOption("areaProperty", "Area property", "area"),
      propertyOption("skillProperty", "Skill property", "skill"),
      propertyOption("difficultyProperty", "Difficulty property", "difficulty"),
      propertyOption("xpProperty", "XP property", "xp_reward"),
      propertyOption("statusProperty", "Status property", "quest_status"),
      sliderOption("limit", "Limit", 12, 1, 50, 1),
    ],
  });
}

module.exports = {
  VIEW_QUESTS,
  registerQuestCardsView,
};
