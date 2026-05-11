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

const VIEW_TIMELINE = "bases-view-pack-timeline";

function registerTimelineView(plugin, BasesViewClass, registerView) {
  const BaseVisualView = createBaseVisualView(BasesViewClass);

  class TimelineView extends BaseVisualView {
    constructor(app, controller, parentEl) {
      super(app, controller, parentEl, VIEW_TIMELINE, "bases-view-pack-timeline-view");
    }

    onDataUpdated() {
      const labelProperty = this.getOption("labelProperty", "file.name");
      const dateProperty = this.getOption("dateProperty", "file.name");
      const detailProperty = this.getOption("detailProperty", "");
      const metaProperty = this.getOption("metaProperty", "");
      const statusProperty = this.getOption("statusProperty", "");
      const rangeMode = this.getOption("rangeMode", "all");
      const startDate = parseTimelineDateValue(this.getOption("startDate", ""));
      const endDate = parseTimelineDateValue(this.getOption("endDate", ""));
      const referenceDate = parseTimelineDateValue(this.getOption("referenceDate", "")) || startOfTimelineDay(new Date());
      const days = clamp(toNumber(this.getOption("days", "365")) || 365, 1, 3660);
      const limit = clamp(toNumber(this.getOption("limit", "24")) || 24, 1, 120);
      const sortMode = this.getOption("sortMode", "date-desc");
      const density = this.getOption("density", "comfortable");
      const accentMode = this.getOption("accentMode", "status");
      const showDateHeaders = this.getOption("showDateHeaders", "true") === "true";
      const showMeta = this.getOption("showMeta", "true") === "true";
      const showStatus = this.getOption("showStatus", "true") === "true";
      const displayTitle = this.getOption("displayTitle", "");
      const range = resolveTimelineDateRange(rangeMode, startDate, endDate, referenceDate, days);

      const rows = this.getEntries()
        .map((entry) => {
          const dateText = this.getValue(entry, dateProperty);
          const status = statusProperty ? this.getValue(entry, statusProperty) : "";
          return {
            entry,
            label: this.getValue(entry, labelProperty) || (entry.file && entry.file.basename) || "Untitled",
            date: parseTimelineDateValue(dateText),
            dateText,
            detail: detailProperty ? this.getValue(entry, detailProperty) : "",
            meta: metaProperty ? this.getValue(entry, metaProperty) : "",
            status,
          };
        })
        .filter((row) => row.date)
        .filter((row) => isWithinTimelineDateRange(row.date, range))
        .sort((a, b) => sortTimelineRows(a, b, sortMode))
        .slice(0, limit);

      if (!rows.length) {
        this.renderEmpty(`No rows with a usable ${dateProperty} date matched this timeline.`);
        return;
      }

      this.rootEl.empty();
      const panel = this.rootEl.createDiv({ cls: "bases-view-pack-panel bases-view-pack-chart-panel" });
      panel.createDiv({ cls: "bases-view-pack-title", text: displayTitle || "Timeline" });
      const timeline = panel.createDiv({
        cls: `bases-view-pack-timeline bases-view-pack-timeline-${density}`,
      });
      timeline.dataset.accentMode = accentMode;

      let lastHeader = "";
      rows.forEach((row) => {
        const headerText = formatTimelineHeader(row.date);
        if (showDateHeaders && headerText !== lastHeader) {
          const header = timeline.createDiv({ cls: "bases-view-pack-timeline-header" });
          header.createDiv({ cls: "bases-view-pack-timeline-header-line" });
          header.createDiv({ cls: "bases-view-pack-timeline-header-label", text: headerText });
          lastHeader = headerText;
        }

        const item = timeline.createDiv({
          cls: `bases-view-pack-timeline-item ${timelineStatusClass(row.status, accentMode)}`,
        });
        item.setAttribute("role", "button");
        item.setAttribute("tabindex", "0");
        item.addEventListener("click", (evt) => this.openEntry(row.entry, evt));
        item.addEventListener("keydown", (evt) => {
          if (evt.key === "Enter" || evt.key === " ") {
            evt.preventDefault();
            this.openEntry(row.entry, evt);
          }
        });

        const rail = item.createDiv({ cls: "bases-view-pack-timeline-rail" });
        rail.createDiv({ cls: "bases-view-pack-timeline-node" });
        rail.createDiv({ cls: "bases-view-pack-timeline-stem" });

        const body = item.createDiv({ cls: "bases-view-pack-timeline-body" });
        const top = body.createDiv({ cls: "bases-view-pack-timeline-top" });
        top.createDiv({ cls: "bases-view-pack-timeline-date", text: formatTimelineDate(row.date) });
        if (showStatus && row.status) {
          top.createDiv({ cls: "bases-view-pack-timeline-status", text: row.status });
        }
        body.createDiv({ cls: "bases-view-pack-timeline-title", text: row.label });
        if (row.detail) body.createDiv({ cls: "bases-view-pack-timeline-detail", text: row.detail });
        if (showMeta && row.meta) body.createDiv({ cls: "bases-view-pack-timeline-meta", text: row.meta });
      });
    }
  }

  registerView(VIEW_TIMELINE, {
    name: "Timeline",
    icon: "lucide-history",
    factory: (controller, containerEl) => new TimelineView(plugin.app, controller, containerEl),
    options: () => [
      optionGroup("Data", [
        propertyOption("labelProperty", "Label property", "file.name"),
        propertyOption("dateProperty", "Date property", "file.name"),
        propertyOption("detailProperty", "Detail property", ""),
        propertyOption("metaProperty", "Meta property", ""),
        propertyOption("statusProperty", "Status property", ""),
        sliderOption("limit", "Limit", 24, 1, 120, 1),
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
      optionGroup("Layout & Display", [
        textOption("displayTitle", "Display title", "", "Default: Timeline"),
        dropdownOption("sortMode", "Sort", "date-desc", {
          "date-desc": "Newest first",
          "date-asc": "Oldest first",
        }),
        toggleOption("showDateHeaders", "Show month headers", true),
        toggleOption("showStatus", "Show status", true),
        toggleOption("showMeta", "Show meta", true),
      ]),
      optionGroup("Appearance", [
        dropdownOption("density", "Density", "comfortable", {
          compact: "Compact",
          comfortable: "Comfortable",
        }),
        dropdownOption("accentMode", "Accent mode", "status", {
          status: "Status colors",
          neutral: "Neutral",
        }),
      ]),
    ],
  });
}

function parseTimelineDateValue(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const dateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) return startOfTimelineDay(new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3])));
  const weekMatch = text.match(/^(\d{4})-W(\d{2})/i);
  if (weekMatch) return timelineIsoWeekStart(Number(weekMatch[1]), Number(weekMatch[2]));
  const monthMatch = text.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) return startOfTimelineDay(new Date(Number(monthMatch[1]), Number(monthMatch[2]) - 1, 1));
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : startOfTimelineDay(parsed);
}

function startOfTimelineDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function timelineIsoWeekStart(year, week) {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const day = simple.getDay() || 7;
  if (day <= 4) simple.setDate(simple.getDate() - day + 1);
  else simple.setDate(simple.getDate() + 8 - day);
  return startOfTimelineDay(simple);
}

function addTimelineDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfTimelineDay(next);
}

function resolveTimelineDateRange(mode, startDate, endDate, referenceDate, days) {
  if (startDate && endDate) return { start: startDate, end: endDate };
  if (mode === "all") return null;
  const end = endDate || referenceDate;
  const span = mode === "rolling-year" ? 365 : days;
  return { start: addTimelineDays(end, -(span - 1)), end };
}

function isWithinTimelineDateRange(date, range) {
  if (!range) return true;
  if (!date) return false;
  return date >= range.start && date <= range.end;
}

function sortTimelineRows(a, b, sortMode) {
  if (sortMode === "date-asc") return a.date - b.date || String(a.label).localeCompare(String(b.label), undefined, { numeric: true });
  return b.date - a.date || String(a.label).localeCompare(String(b.label), undefined, { numeric: true });
}

function formatTimelineHeader(date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatTimelineDate(date) {
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function timelineStatusClass(status, accentMode) {
  if (accentMode !== "status") return "is-neutral";
  const text = String(status || "").trim().toLowerCase();
  if (!text) return "is-neutral";
  if (text.includes("complete") || text.includes("done") || text.includes("clear")) return "is-completed";
  if (text.includes("active") || text.includes("progress")) return "is-active";
  if (text.includes("lock") || text.includes("wait") || text.includes("hold")) return "is-blocked";
  return "is-neutral";
}

module.exports = {
  VIEW_TIMELINE,
  registerTimelineView,
};
