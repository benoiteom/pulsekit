"use client";

import { useState, useRef, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

export interface PulseDateRangePickerProps {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

type ActiveField = "start" | "end";

function formatShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(s: string): Date {
  return new Date(s + "T00:00:00");
}

export function PulseDateRangePicker({ from, to }: PulseDateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [activeField, setActiveField] = useState<ActiveField>("start");
  const [startDate, setStartDate] = useState(() => parseDate(from));
  const [endDate, setEndDate] = useState(() => parseDate(to));
  const [month, setMonth] = useState(() => parseDate(from));
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside — reset to prop values
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setStartDate(parseDate(from));
        setEndDate(parseDate(to));
        setActiveField("start");
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open, from, to]);

  const today = new Date();
  const minDate = new Date();
  minDate.setDate(today.getDate() - 30);

  function handleDayClick(day: Date) {
    if (activeField === "start") {
      setStartDate(day);
      if (day > endDate) {
        setEndDate(day);
      }
      setActiveField("end");
    } else {
      if (day < startDate) {
        // Clicked before start → set as new start, keep end
        setStartDate(day);
      } else {
        setEndDate(day);
      }
    }
  }

  function handleApply() {
    const newFrom = toDateString(startDate);
    const newTo = toDateString(endDate);
    if (newFrom !== from || newTo !== to) {
      const url = new URL(window.location.href);
      url.searchParams.set("from", newFrom);
      url.searchParams.set("to", newTo);
      window.location.assign(url.toString());
    } else {
      setOpen(false);
    }
  }

  function handlePreset(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    setStartDate(start);
    setEndDate(end);
    setMonth(start);
  }

  function handleOpen() {
    if (open) {
      setOpen(false);
    } else {
      setStartDate(parseDate(from));
      setEndDate(parseDate(to));
      setActiveField("start");
      setMonth(parseDate(from));
      setOpen(true);
    }
  }

  function handleFieldClick(field: ActiveField) {
    setActiveField(field);
    setMonth(field === "start" ? startDate : endDate);
  }

  const changed =
    toDateString(startDate) !== from || toDateString(endDate) !== to;

  return (
    <div
      ref={containerRef}
      className="pulse-datepicker"
      style={{ position: "relative" }}
    >
      <button
        type="button"
        onClick={handleOpen}
        className="pulse-btn pulse-datepicker-trigger"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          style={{ opacity: 0.5, flexShrink: 0 }}
        >
          <rect
            x="1"
            y="2"
            width="14"
            height="13"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
          <path d="M1 6h14" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M5 0.5v3M11 0.5v3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        {formatShort(parseDate(from))} – {formatShort(parseDate(to))}
      </button>

      {open && (
        <div className="pulse-datepicker-popover">
          {/* From / To field selectors */}
          <div className="pulse-datepicker-fields">
            <button
              type="button"
              className={`pulse-datepicker-field ${activeField === "start" ? "active" : ""}`}
              onClick={() => handleFieldClick("start")}
            >
              <span className="pulse-datepicker-field-label">From</span>
              <span className="pulse-datepicker-field-value">
                {formatShort(startDate)}
              </span>
            </button>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              style={{
                color: "var(--pulse-fg-muted)",
                flexShrink: 0,
                alignSelf: "center",
              }}
            >
              <path
                d="M6 3l5 5-5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <button
              type="button"
              className={`pulse-datepicker-field ${activeField === "end" ? "active" : ""}`}
              onClick={() => handleFieldClick("end")}
            >
              <span className="pulse-datepicker-field-label">To</span>
              <span className="pulse-datepicker-field-value">
                {formatShort(endDate)}
              </span>
            </button>
          </div>

          {/* Preset shortcuts */}
          <div className="pulse-datepicker-presets">
            <button type="button" onClick={() => handlePreset(7)}>
              7 days
            </button>
            <button type="button" onClick={() => handlePreset(14)}>
              14 days
            </button>
            <button type="button" onClick={() => handlePreset(30)}>
              30 days
            </button>
          </div>

          {/* Calendar */}
          <DayPicker
            mode="range"
            selected={{ from: startDate, to: endDate }}
            onSelect={() => {}}
            onDayClick={handleDayClick}
            disabled={[{ before: minDate }, { after: today }]}
            month={month}
            onMonthChange={setMonth}
            numberOfMonths={1}
          />

          {/* Footer */}
          <div className="pulse-datepicker-footer">
            <button
              type="button"
              className="pulse-datepicker-cancel"
              onClick={() => {
                setStartDate(parseDate(from));
                setEndDate(parseDate(to));
                setActiveField("start");
                setOpen(false);
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`pulse-datepicker-apply ${changed ? "" : "disabled"}`}
              disabled={!changed}
              onClick={handleApply}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
