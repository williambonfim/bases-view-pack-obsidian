const {
  clamp,
  createBaseVisualView,
  dropdownOption,
  optionGroup,
  propertyOption,
  sliderOption,
  textOption,
  toggleOption,
} = require("../../shared");

const VIEW_LINEAR_CALENDAR = "bases-view-pack-linear-calendar";

function registerLinearCalendarView(plugin, BasesViewClass, registerView) {
  const BaseVisualView = createBaseVisualView(BasesViewClass);

  class LinearCalendarView extends BaseVisualView {
    constructor(app, controller, parentEl) {
      super(app, controller, parentEl, VIEW_LINEAR_CALENDAR, "bases-view-pack-linear-calendar-view");
    }

    onDataUpdated() {
      const labelProperty = this.getOption("labelProperty", "file.name");
      const startProperty = this.getOption("startProperty", "note.quest_checked_at");
      const endProperty = this.getOption("endProperty", "note.completed_date");
      const detailProperty = this.getOption("detailProperty", "");
      const statusProperty = this.getOption("statusProperty", "");
      const colorProperty = this.getOption("colorProperty", "");
      const layoutMode = this.getOption("layoutMode", "day-of-month");
      const rangeMode = this.getOption("rangeMode", "rolling-year");
      const startDate = parseLinearCalendarDate(this.getOption("startDate", ""));
      const endDate = parseLinearCalendarDate(this.getOption("endDate", ""));
      const referenceDate = parseLinearCalendarDate(this.getOption("referenceDate", "")) || startOfLinearCalendarDay(new Date());
      const monthsToShow = clamp(Number.parseInt(this.getOption("months", "12"), 10) || 12, 1, 48);
      const showMonthHeaders = this.getOption("showMonthHeaders", "true") === "true";
      const showDayHeaders = this.getOption("showDayHeaders", "true") === "true";
      const showDayNumbers = this.getOption("showDayNumbers", "false") === "true";
      const highlightToday = this.getOption("highlightToday", "true") === "true";
      const todayColor = this.getOption("todayColor", "");
      const showLegend = this.getOption("showLegend", "true") === "true";
      const compact = this.getOption("compact", "false") === "true";
      const statusColors = this.getOption("statusColors", "true") === "true";
      const displayTitle = this.getOption("displayTitle", "");

      const today = startOfLinearCalendarDay(new Date());
      const range = resolveLinearCalendarRange(rangeMode, startDate, endDate, referenceDate, monthsToShow);
      const events = this.getEntries()
        .map((entry) => {
          const start = parseLinearCalendarDate(this.getValue(entry, startProperty));
          const rawEnd = parseLinearCalendarDate(this.getValue(entry, endProperty));
          const end = rawEnd || start;
          return {
            entry,
            label: this.getValue(entry, labelProperty) || (entry.file && entry.file.basename) || "Untitled",
            detail: detailProperty ? this.getValue(entry, detailProperty) : "",
            status: statusProperty ? this.getValue(entry, statusProperty) : "",
            color: colorProperty ? resolveLinearCalendarColor(this.getValue(entry, colorProperty)) : "",
            start,
            end,
          };
        })
        .filter((event) => event.start && event.end)
        .map((event) => ({
          ...event,
          start: event.start <= event.end ? event.start : event.end,
          end: event.start <= event.end ? event.end : event.start,
        }))
        .filter((event) => event.end >= range.start && event.start <= range.end)
        .sort((a, b) => a.start - b.start || a.end - b.end || String(a.label).localeCompare(String(b.label), undefined, { numeric: true }));

      const months = buildLinearCalendarMonths(range.start, range.end);
      const maxColumns = layoutMode === "day-of-month" ? 31 : 37;

      this.rootEl.empty();
      const panel = this.rootEl.createDiv({ cls: "bases-view-pack-panel bases-view-pack-chart-panel" });
      panel.createDiv({ cls: "bases-view-pack-title", text: displayTitle || "Linear Calendar" });
      const shell = panel.createDiv({
        cls: `bases-view-pack-linear-calendar-shell ${compact ? "is-compact" : ""}`,
      });

      if (showDayHeaders) {
        renderLinearCalendarHeaders(shell, layoutMode, maxColumns);
      }

      months.forEach((month) => {
        const monthEvents = events.filter((event) => event.end >= month.start && event.start <= month.end);
        const lanes = allocateLinearCalendarLanes(month, monthEvents, layoutMode);
        const laneCount = Math.max(1, lanes.length);

        const monthEl = shell.createDiv({ cls: "bases-view-pack-linear-calendar-month-block" });
        if (showMonthHeaders) {
          monthEl.createDiv({ cls: "bases-view-pack-linear-calendar-month-label", text: month.label });
        } else {
          monthEl.createDiv({ cls: "bases-view-pack-linear-calendar-month-label" });
        }

        const monthContent = monthEl.createDiv({ cls: "bases-view-pack-linear-calendar-month-content" });

        if (showDayNumbers) {
          renderLinearCalendarDayNumbers(monthContent, month, layoutMode, maxColumns);
        }

        const grid = monthContent.createDiv({ cls: "bases-view-pack-linear-calendar-grid" });
        grid.style.setProperty("--bases-view-pack-linear-calendar-columns", String(maxColumns));
        if (highlightToday && todayColor) {
          grid.style.setProperty("--bases-view-pack-linear-today-color", todayColor);
        }

        renderLinearCalendarBackground(grid, month, layoutMode, maxColumns, laneCount, { highlightToday, today });

        lanes.forEach((laneEvents, laneIndex) => {
          const lane = grid.createDiv({ cls: "bases-view-pack-linear-calendar-lane" });
          lane.style.gridRow = String(laneIndex + 1);
          lane.style.gridColumn = `1 / span ${maxColumns}`;

          laneEvents.forEach((event) => {
            const segment = describeLinearCalendarSegment(event, month, layoutMode);
            if (!segment) return;
            const item = lane.createDiv({
              cls: `bases-view-pack-linear-calendar-event ${linearCalendarStatusClass(event.status, statusColors)}`,
            });
            if (event.color) {
              item.addClass("is-custom-color");
              item.style.setProperty("--bases-view-pack-linear-event-color", event.color);
            }
            item.style.gridColumn = `${segment.columnStart} / span ${segment.span}`;
            item.setAttribute("role", "button");
            item.setAttribute("tabindex", "0");
            item.setAttribute("aria-label", buildLinearCalendarEventTitle(event, month, segment));
            item.addEventListener("click", (evt) => this.openEntry(event.entry, evt));
            item.addEventListener("keydown", (evt) => {
              if (evt.key === "Enter" || evt.key === " ") {
                evt.preventDefault();
                this.openEntry(event.entry, evt);
              }
            });

            const title = item.createDiv({ cls: "bases-view-pack-linear-calendar-event-title", text: event.label });
            title.title = buildLinearCalendarEventTitle(event, month, segment);
            if (event.detail) {
              item.createDiv({ cls: "bases-view-pack-linear-calendar-event-detail", text: event.detail });
            }
          });
        });
      });

      if (showLegend) {
        const legend = shell.createDiv({ cls: "bases-view-pack-linear-calendar-legend" });
        legend.createDiv({ cls: "bases-view-pack-linear-calendar-legend-item is-active", text: "Active / in progress" });
        legend.createDiv({ cls: "bases-view-pack-linear-calendar-legend-item is-completed", text: "Completed" });
        legend.createDiv({ cls: "bases-view-pack-linear-calendar-legend-item is-blocked", text: "Blocked / locked" });
        legend.createDiv({ cls: "bases-view-pack-linear-calendar-legend-item is-neutral", text: "Other" });
      }
    }
  }

  registerView(VIEW_LINEAR_CALENDAR, {
    name: "Linear Calendar",
    icon: "lucide-calendar-range",
    factory: (controller, containerEl) => new LinearCalendarView(plugin.app, controller, containerEl),
    options: () => [
      optionGroup("Data", [
        propertyOption("labelProperty", "Label property", "file.name"),
        propertyOption("startProperty", "Start property", "note.quest_checked_at"),
        propertyOption("endProperty", "End property", "note.completed_date"),
        propertyOption("detailProperty", "Detail property", ""),
        propertyOption("statusProperty", "Status property", "note.quest_status"),
        propertyOption("colorProperty", "Color property", ""),
      ]),
      optionGroup("Date Range", [
        dropdownOption("rangeMode", "Range mode", "rolling-year", {
          "rolling-year": "Rolling year (last 12)",
          "current-year": "Current Year (Jan-Dec)",
          "future-months": "Next X months",
          months: "Last X months",
          fixed: "Fixed start and end",
        }),
        sliderOption("months", "Months to show", 12, 1, 48, 1),
        textOption("referenceDate", "Reference date", "", "YYYY-MM-DD"),
        textOption("startDate", "Start date", "", "YYYY-MM-DD"),
        textOption("endDate", "End date", "", "YYYY-MM-DD"),
      ]),
      optionGroup("Layout & Display", [
        textOption("displayTitle", "Display title", "", "Default: Linear Calendar"),
        dropdownOption("layoutMode", "Layout mode", "day-of-month", {
          "day-of-month": "Columns are day numbers",
          weekday: "Columns follow weekday alignment",
        }),
        toggleOption("showMonthHeaders", "Show month headers", true),
        toggleOption("showDayHeaders", "Show column headers", true),
        toggleOption("showDayNumbers", "Show day numbers (above month)", false),
        toggleOption("highlightToday", "Highlight today", true),
        textOption("todayColor", "Today highlight color", "", "Color name, hex, or var()"),
        toggleOption("showLegend", "Show legend", true),
        toggleOption("compact", "Compact event cards", false),
      ]),
      optionGroup("Appearance", [
        toggleOption("statusColors", "Use status colors", true),
      ]),
    ],
  });
}

function parseLinearCalendarDate(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const dateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) return startOfLinearCalendarDay(new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3])));
  const monthMatch = text.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) return startOfLinearCalendarDay(new Date(Number(monthMatch[1]), Number(monthMatch[2]) - 1, 1));
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : startOfLinearCalendarDay(parsed);
}

function startOfLinearCalendarDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfLinearCalendarMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addLinearCalendarMonths(date, months) {
  return startOfLinearCalendarDay(new Date(date.getFullYear(), date.getMonth() + months, 1));
}

function resolveLinearCalendarRange(mode, startDate, endDate, referenceDate, monthsToShow) {
  if (mode === "fixed" && startDate && endDate) {
    return { start: startOfLinearCalendarDay(startDate), end: startOfLinearCalendarDay(endDate) };
  }
  const anchor = startOfLinearCalendarDay(referenceDate);
  if (mode === "current-year") {
    const start = startOfLinearCalendarDay(new Date(anchor.getFullYear(), 0, 1));
    const end = endOfLinearCalendarMonth(new Date(anchor.getFullYear(), 11, 31));
    return { start, end };
  }
  if (mode === "future-months") {
    const start = startOfLinearCalendarDay(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
    const end = endOfLinearCalendarMonth(new Date(anchor.getFullYear(), anchor.getMonth() + (monthsToShow - 1), 1));
    return { start, end };
  }
  if (mode === "rolling-year") {
    const start = startOfLinearCalendarDay(new Date(anchor.getFullYear(), anchor.getMonth() - 11, 1));
    const end = endOfLinearCalendarMonth(anchor);
    return { start, end };
  }
  const start = startOfLinearCalendarDay(new Date(anchor.getFullYear(), anchor.getMonth() - (monthsToShow - 1), 1));
  const end = endOfLinearCalendarMonth(anchor);
  return { start, end };
}

function buildLinearCalendarMonths(start, end) {
  const months = [];
  let cursor = startOfLinearCalendarDay(new Date(start.getFullYear(), start.getMonth(), 1));
  while (cursor <= end) {
    const monthStart = startOfLinearCalendarDay(cursor);
    const monthEnd = endOfLinearCalendarMonth(cursor);
    months.push({
      start: monthStart,
      end: monthEnd,
      year: monthStart.getFullYear(),
      month: monthStart.getMonth(),
      daysInMonth: monthEnd.getDate(),
      firstWeekday: monthStart.getDay(),
      label: monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    });
    cursor = addLinearCalendarMonths(cursor, 1);
  }
  return months;
}

function renderLinearCalendarHeaders(parent, layoutMode, maxColumns) {
  const header = parent.createDiv({ cls: "bases-view-pack-linear-calendar-header" });
  header.style.setProperty("--bases-view-pack-linear-calendar-columns", String(maxColumns));
  const labels = [];
  if (layoutMode === "day-of-month") {
    for (let day = 1; day <= 31; day += 1) labels.push(String(day));
  } else {
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let slot = 0; slot < 37; slot += 1) labels.push(weekdays[slot % 7]);
  }
  labels.forEach((label, index) => {
    const cell = header.createDiv({ cls: "bases-view-pack-linear-calendar-header-cell", text: label });
    cell.style.gridColumn = String(index + 1);
  });
}

function renderLinearCalendarDayNumbers(parent, month, layoutMode, maxColumns) {
  const header = parent.createDiv({ cls: "bases-view-pack-linear-calendar-day-header" });
  header.style.setProperty("--bases-view-pack-linear-calendar-columns", String(maxColumns));
  
  const startOffset = layoutMode === "day-of-month" ? 0 : month.firstWeekday;
  for (let d = 1; d <= month.daysInMonth; d++) {
    const cell = header.createDiv({ cls: "bases-view-pack-linear-calendar-header-cell", text: String(d) });
    cell.style.gridColumn = String(startOffset + d);
    cell.style.fontSize = "8px";
  }
}

function renderLinearCalendarBackground(parent, month, layoutMode, maxColumns, laneCount, settings = {}) {
  const { highlightToday, today } = settings;
  const track = parent.createDiv({ cls: "bases-view-pack-linear-calendar-track" });
  track.style.gridColumn = `1 / span ${maxColumns}`;
  track.style.gridRow = `1 / span ${laneCount}`;

  const startOffset = layoutMode === "day-of-month" ? 0 : month.firstWeekday;
  for (let d = 1; d <= month.daysInMonth; d++) {
    const dayOfWeek = (month.firstWeekday + d - 1) % 7;
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isToday = highlightToday && 
                   today &&
                   today.getFullYear() === month.year && 
                   today.getMonth() === month.month && 
                   today.getDate() === d;
    
    const cell = track.createDiv({ 
      cls: `bases-view-pack-linear-calendar-cell ${isWeekend ? "is-weekend" : ""} ${isToday ? "is-today" : ""}` 
    });
    cell.style.gridColumn = String(startOffset + d);
    cell.style.gridRow = `1 / span ${laneCount}`;
    cell.title = `${month.label} ${d}`;
  }
}

function allocateLinearCalendarLanes(month, events, layoutMode) {
  const lanes = [];
  events.forEach((event) => {
    const segment = describeLinearCalendarSegment(event, month, layoutMode);
    if (!segment) return;
    let placed = false;
    for (const lane of lanes) {
      const conflict = lane.some((placedEvent) => {
        const other = describeLinearCalendarSegment(placedEvent, month, layoutMode);
        return other && rangesOverlap(segment.columnStart, segment.columnStart + segment.span - 1, other.columnStart, other.columnStart + other.span - 1);
      });
      if (!conflict) {
        lane.push(event);
        placed = true;
        break;
      }
    }
    if (!placed) lanes.push([event]);
  });
  return lanes;
}

function describeLinearCalendarSegment(event, month, layoutMode) {
  const segmentStart = event.start > month.start ? event.start : month.start;
  const segmentEnd = event.end < month.end ? event.end : month.end;
  if (segmentEnd < segmentStart) return null;
  const startColumn = layoutMode === "day-of-month"
    ? segmentStart.getDate()
    : month.firstWeekday + segmentStart.getDate();
  const endColumn = layoutMode === "day-of-month"
    ? segmentEnd.getDate()
    : month.firstWeekday + segmentEnd.getDate();
  return {
    start: segmentStart,
    end: segmentEnd,
    columnStart: startColumn,
    span: Math.max(1, endColumn - startColumn + 1),
  };
}

function buildLinearCalendarEventTitle(event, month, segment) {
  const startText = segment.start.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  const endText = segment.end.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  const parts = [event.label, `${startText} to ${endText}`];
  if (event.status) parts.push(event.status);
  if (event.detail) parts.push(event.detail);
  if (segment.start.getTime() !== event.start.getTime() || segment.end.getTime() !== event.end.getTime()) {
    parts.push(`clipped in ${month.label}`);
  }
  return parts.join(" | ");
}

function linearCalendarStatusClass(status, statusColors) {
  if (!statusColors) return "is-neutral";
  const text = String(status || "").trim().toLowerCase();
  if (!text) return "is-neutral";
  if (text.includes("complete") || text.includes("done")) return "is-completed";
  if (text.includes("active") || text.includes("progress")) return "is-active";
  if (text.includes("lock") || text.includes("wait") || text.includes("hold")) return "is-blocked";
  return "is-neutral";
}

function resolveLinearCalendarColor(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(text)) return text;
  const namedColors = {
    accent: "var(--interactive-accent)",
    primary: "var(--interactive-accent)",
    red: "#d1242f",
    orange: "#d97706",
    amber: "#d29922",
    yellow: "#bf8700",
    green: "#26a641",
    teal: "#008672",
    cyan: "#0969da",
    blue: "#0969da",
    purple: "#8957e5",
    pink: "#bf3989",
    brown: "#8b5e34",
    gray: "#6e7781",
    grey: "#6e7781",
    black: "#24292f",
    white: "#ffffff",
  };
  return namedColors[text] || "";
}

function rangesOverlap(startA, endA, startB, endB) {
  return endA >= startB && endB >= startA;
}

module.exports = {
  VIEW_LINEAR_CALENDAR,
  registerLinearCalendarView,
};
