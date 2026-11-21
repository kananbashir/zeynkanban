import { Icon } from "./icons";

/** Placeholder for pages whose content arrives in a later stage. */
export function ComingSoon({ title, heading, text }: { title: string; heading: string; text: string }) {
  return (
    <main className="flex flex-col gap-5">
      <h1 className="text-[28px] font-semibold leading-tight">{title}</h1>
      <div className="flex flex-col items-center gap-2 rounded-[28px] bg-white px-4 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-mint text-teal-deep">
          <Icon name="hammer" />
        </span>
        <p className="text-lg font-semibold">{heading}</p>
        <p className="max-w-[52ch] text-sm text-muted">{text}</p>
      </div>
    </main>
  );
}
