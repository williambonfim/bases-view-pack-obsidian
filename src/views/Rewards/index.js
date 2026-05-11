const {
  clamp,
  createBaseVisualView,
  propertyOption,
  sliderOption,
  textOption,
  toNumber,
} = require("../../shared");

const VIEW_REWARDS = "bases-view-pack-reward-cards";

function registerRewardCardsView(plugin, BasesViewClass, registerView) {
  const BaseVisualView = createBaseVisualView(BasesViewClass);

  class RewardCardsView extends BaseVisualView {
    constructor(app, controller, parentEl) {
      super(app, controller, parentEl, VIEW_REWARDS, "bases-view-pack-reward-view");
    }

    onDataUpdated() {
      const nameProperty = this.getOption("nameProperty", "reward_name");
      const tierProperty = this.getOption("tierProperty", "reward_tier");
      const costProperty = this.getOption("costProperty", "token_cost");
      const statusProperty = this.getOption("statusProperty", "reward_status");
      const categoryProperty = this.getOption("categoryProperty", "reward_category");
      const limit = clamp(toNumber(this.getOption("limit", "12")) || 12, 1, 50);
      const displayTitle = this.getOption("displayTitle", "");

      const rows = this.getEntries()
        .map((entry) => ({
          entry,
          name: this.getValue(entry, nameProperty) || (entry.file && entry.file.basename) || "",
          tier: this.getValue(entry, tierProperty),
          cost: this.getValue(entry, costProperty),
          status: this.getValue(entry, statusProperty),
          category: this.getValue(entry, categoryProperty),
        }))
        .slice(0, limit);

      if (!rows.length) {
        this.renderEmpty("No rewards match this Base.");
        return;
      }

      this.rootEl.empty();
      const panel = this.rootEl.createDiv({ cls: "bases-view-pack-panel bases-view-pack-reward-panel" });
      panel.createDiv({ cls: "bases-view-pack-title", text: displayTitle || "Reward Shop" });
      const cards = panel.createDiv({ cls: "bases-view-pack-reward-cards" });

      for (const row of rows) {
        const card = cards.createDiv({ cls: "bases-view-pack-reward-card" });
        card.setAttribute("role", "button");
        card.setAttribute("tabindex", "0");
        card.addEventListener("click", (evt) => this.openEntry(row.entry, evt));
        card.addEventListener("keydown", (evt) => {
          if (evt.key === "Enter" || evt.key === " ") {
            evt.preventDefault();
            this.openEntry(row.entry, evt);
          }
        });

        const header = card.createDiv({ cls: "bases-view-pack-reward-card-header" });
        header.createDiv({ cls: "bases-view-pack-card-name", text: row.name });
        if (row.status) {
          header.createDiv({ cls: `bases-view-pack-card-status status-${row.status.toLowerCase().replace(/\s+/g, "-")}`, text: row.status });
        }

        const body = card.createDiv({ cls: "bases-view-pack-reward-card-body" });
        if (row.tier || row.category) {
          body.createDiv({ cls: "bases-view-pack-card-meta", text: [row.tier, row.category].filter(Boolean).join(" • ") });
        }
        if (row.cost) {
          card.createDiv({ cls: "bases-view-pack-card-cost", text: `${row.cost} Tokens` });
        }
      }
    }
  }

  registerView(VIEW_REWARDS, {
    name: "Reward Cards",
    icon: "lucide-gift",
    factory: (controller, containerEl) => new RewardCardsView(plugin.app, controller, containerEl),
    options: () => [
      textOption("displayTitle", "Display title", "", "Default: Reward Shop"),
      propertyOption("nameProperty", "Name property", "reward_name"),
      propertyOption("tierProperty", "Tier property", "reward_tier"),
      propertyOption("costProperty", "Cost property", "token_cost"),
      propertyOption("statusProperty", "Status property", "reward_status"),
      propertyOption("categoryProperty", "Category property", "reward_category"),
      sliderOption("limit", "Limit", 12, 1, 50, 1),
    ],
  });
}

module.exports = {
  VIEW_REWARDS,
  registerRewardCardsView,
};
