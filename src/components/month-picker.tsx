"use client";

import { fieldSmall } from "./ui";

/** Month and year as two dropdowns (works in every browser, unlike <input type="month">). Value: "2026-11". */
export function MonthPicker({
  value,
  onChange,
  months,
  label,
  monthLabel,
  yearLabel,
  years,
}: {
  value: string;
  onChange: (value: string) => void;
  months: readonly string[];
  label: string;
  monthLabel: string;
  yearLabel: string;
  years: number[];
}) {
  const [year, month] = value.split("-").map(Number);
  const set = (y: number, m: number) => onChange(`${y}-${String(m).padStart(2, "0")}`);
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className="mb-1.5 text-[13px] font-semibold">{label}</legend>
      <div className="flex gap-2">
        <select aria-label={`${label}: ${monthLabel}`} className={`${fieldSmall} h-12 flex-1`} value={month} onChange={(e) => set(year, Number(e.target.value))}>
          {months.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
        <select aria-label={`${label}: ${yearLabel}`} className={`${fieldSmall} h-12 w-[96px]`} value={year} onChange={(e) => set(Number(e.target.value), month)}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}

export function yearsAround(center: number): number[] {
  return [center - 1, center, center + 1, center + 2, center + 3];
}
