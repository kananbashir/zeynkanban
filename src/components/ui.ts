// Shared class names, so buttons and fields look the same everywhere.
export const btn = {
  primary: "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-sun px-[18px] text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:bg-line disabled:text-icon",
  soft: "inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-surface px-3.5 text-[13px] font-semibold text-ink hover:bg-mint disabled:cursor-not-allowed disabled:opacity-60",
  mint: "inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-mint px-3.5 text-[13px] font-semibold text-ink hover:bg-teal-tint disabled:cursor-not-allowed disabled:opacity-60",
  danger: "inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-full bg-danger px-3.5 text-[13px] font-semibold text-white",
};

export const field =
  "h-12 w-full min-w-0 rounded-[14px] border-[1.5px] border-line-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-muted";
export const fieldSmall = "h-10 min-w-0 rounded-[10px] border-[1.5px] border-line-strong bg-surface px-2.5 text-sm text-ink";

export const card = "flex flex-col gap-[18px] rounded-[28px] bg-surface p-4 md:p-6";
export const row = "rounded-[20px] border-[1.5px] border-transparent bg-mint-soft px-3 py-2.5";
export const rowOff = "rounded-[20px] border-[1.5px] border-dashed border-subtle bg-neutral-card px-3 py-2.5 text-ink-soft";
