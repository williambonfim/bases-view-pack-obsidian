const { Keymap } = require("obsidian");

function createBaseVisualView(BasesViewClass) {
  return class BaseVisualView extends BasesViewClass {
    constructor(app, controller, parentEl, type, rootClass) {
      super(controller);
      this.app = app;
      this.type = type;
      this.rootEl = parentEl.createDiv({ cls: `bases-view bases-view-pack-view ${rootClass}` });
      this.rootEl.setAttribute("data-view-type", type);
    }

    getEntries() {
      const grouped = this.data && this.data.groupedData;
      if (Array.isArray(grouped)) {
        return grouped.flatMap((group) => Array.isArray(group.entries) ? group.entries : []);
      }
      if (grouped && typeof grouped === "object") {
        return Object.values(grouped).flatMap((group) => Array.isArray(group.entries) ? group.entries : []);
      }
      if (this.data && Array.isArray(this.data.entries)) {
        return this.data.entries;
      }
      return [];
    }

    getOption(key, fallback) {
      const value = this.config && typeof this.config.get === "function" ? this.config.get(key) : null;
      return isFilled(value) ? String(value) : fallback;
    }

    getValue(entry, propertyId) {
      if (!entry || !propertyId) return "";
      const candidates = propertyCandidates(propertyId);
      for (const candidate of candidates) {
        if (candidate === "file.name") return entry.file ? entry.file.basename : "";
        if (candidate === "file.path") return entry.file ? entry.file.path : "";
        try {
          const value = entry.getValue(candidate);
          const text = valueToString(value);
          if (isFilled(text)) return text;
        } catch (_error) {
          // Try the next Base property ID format.
        }
      }
      return "";
    }

    openEntry(entry, evt) {
      if (!entry || !entry.file) return;
      const modEvent = Keymap.isModEvent(evt);
      void this.app.workspace.openLinkText(entry.file.path, "", modEvent);
    }

    renderEmpty(message) {
      this.rootEl.empty();
      this.rootEl.createDiv({ cls: "bases-view-pack-empty", text: message });
    }
  };
}

function textOption(key, displayName, defaultValue, placeholder) {
  const option = { type: "text", key, displayName, default: defaultValue };
  if (placeholder) option.placeholder = placeholder;
  return option;
}

function propertyOption(key, displayName, defaultValue) {
  return { type: "property", key, displayName, default: defaultValue };
}

function dropdownOption(key, displayName, defaultValue, options) {
  return { type: "dropdown", key, displayName, default: defaultValue, options };
}

function toggleOption(key, displayName, defaultValue) {
  return { type: "toggle", key, displayName, default: defaultValue };
}

function sliderOption(key, displayName, defaultValue, min, max, step) {
  return { type: "slider", key, displayName, default: defaultValue, min, max, step, instant: true };
}

function optionGroup(displayName, items) {
  return { type: "group", displayName, items };
}

function propertyCandidates(propertyId) {
  const raw = String(propertyId || "").trim();
  if (!raw) return [];
  const candidates = [raw];
  if (raw.startsWith("note.")) {
    candidates.push(raw.slice("note.".length));
  } else if (!raw.startsWith("file.") && !raw.includes("(")) {
    candidates.push(`note.${raw}`);
  }
  return Array.from(new Set(candidates));
}

function valueToString(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value.map((item) => valueToString(item)).filter(Boolean).join(", ");
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object" && "values" in value && Array.isArray(value.values)) {
    return value.values.map((item) => valueToString(item)).filter(Boolean).join(", ");
  }
  if (typeof value === "object" && "value" in value) return valueToString(value.value);
  if (typeof value === "object" && "text" in value) return valueToString(value.text);
  if (typeof value === "object" && "display" in value) return valueToString(value.display);
  if (typeof value.toString === "function") {
    const text = value.toString();
    if (text !== "[object Object]") return text;
  }
  return "";
}

function isFilled(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function toBooleanText(value) {
  const text = String(value || "").trim().toLowerCase();
  return text === "true" || text === "yes" || text === "1";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseDateValue(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const dateMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) return startOfDay(new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3])));
  const weekMatch = text.match(/^(\d{4})-W(\d{2})/i);
  if (weekMatch) return isoWeekStart(Number(weekMatch[1]), Number(weekMatch[2]));
  const monthMatch = text.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) return startOfDay(new Date(Number(monthMatch[1]), Number(monthMatch[2]) - 1, 1));
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : startOfDay(parsed);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isoWeekStart(year, week) {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const day = simple.getDay() || 7;
  if (day <= 4) simple.setDate(simple.getDate() - day + 1);
  else simple.setDate(simple.getDate() + 8 - day);
  return startOfDay(simple);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

function resolveDateRange(mode, startDate, endDate, referenceDate, days) {
  if (startDate && endDate) return { start: startDate, end: endDate };
  if (mode === "all") return null;
  const end = endDate || referenceDate;
  const span = mode === "rolling-year" ? 365 : days;
  return { start: addDays(end, -(span - 1)), end };
}

function isWithinDateRange(date, range) {
  if (!range) return true;
  if (!date) return false;
  return date >= range.start && date <= range.end;
}

function sortRows(a, b) {
  if (a.date && b.date) return a.date.getTime() - b.date.getTime();
  return String(a.label).localeCompare(String(b.label), undefined, { numeric: true });
}

function resolveValueRange(values, referenceValue, mode, customMin, customMax) {
  const autoMin = Math.min(0, ...values, referenceValue ?? 0);
  const autoMax = Math.max(1, ...values, referenceValue ?? 1);
  let min = mode === "custom" && customMin !== null ? customMin : autoMin;
  let max = mode === "custom" && customMax !== null ? customMax : autoMax;
  if (min === max) max = min + 1;
  if (min > max) [min, max] = [max, min];
  return { min, max };
}

function buildTicks(min, max, count) {
  const ticks = [];
  const range = max - min || 1;
  const step = range / Math.max(1, count - 1);
  for (let index = 0; index < count; index++) {
    ticks.push(min + step * index);
  }
  return ticks;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value) >= 100) return String(Math.round(value));
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

function shortLabel(value) {
  const text = String(value || "");
  return text.length > 18 ? `${text.slice(0, 16)}...` : text;
}

module.exports = {
  addDays,
  buildTicks,
  clamp,
  createBaseVisualView,
  dropdownOption,
  formatNumber,
  isFilled,
  isoWeekStart,
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
  toBooleanText,
  toNumber,
};
