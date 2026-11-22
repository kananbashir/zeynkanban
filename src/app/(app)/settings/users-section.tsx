"use client";

import { useState } from "react";
import { initials } from "@/components/top-bar";
import { InlineText } from "@/components/inline-text";
import { Toast, useToast } from "@/components/toast";
import { btn, card, field, fieldSmall, row, rowOff } from "@/components/ui";
import type { Role } from "@/db/schema";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { Icon } from "@/components/icons";
import { createUser, newUserCode, renameUser, revealUserCode, setUserActive, setUserRole } from "./actions";
import { SectionHeader } from "./section-header";
import { useAction } from "./use-action";

type User = { id: string; name: string; role: Role; active: boolean };
const ROLES: Role[] = ["admin", "manager", "employee"];
const AVATARS = ["#0b7f7b", "#5b4bc4", "#b4532a", "#1f6fb2", "#8a4b9c", "#4e6b1f"];

const withoutKey = (all: Record<string, string>, key: string) => Object.fromEntries(Object.entries(all).filter(([k]) => k !== key));

function avatarColor(id: string) {
  let sum = 0;
  for (const ch of id) sum = (sum + ch.charCodeAt(0)) % 997;
  return AVATARS[sum % AVATARS.length];
}

export function UsersSection({
  users,
  meId,
  t,
  errors,
  roles,
}: {
  users: User[];
  meId: string;
  t: Dictionary["settings"];
  errors: Dictionary["errors"];
  roles: Dictionary["roles"];
}) {
  const { message, show } = useToast();
  const { pending, run } = useAction(errors, show);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<Role>("employee");
  const [revealed, setRevealed] = useState<{ id: string; code: string } | null>(null);
  const [shown, setShown] = useState<Record<string, string>>({});
  const u = t.users;

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      show(u.copied);
    } catch {
      show(u.copyFailed);
    }
  }

  return (
    <section aria-label={t.sections.users} className={card}>
      <SectionHeader
        title={t.sections.users}
        intro={u.intro}
        action={
          <button type="button" className={btn.primary} aria-expanded={adding} onClick={() => setAdding((v) => !v)}>
            <Plus />
            {u.add}
          </button>
        }
      />

      {adding && (
        <form
          className="flex flex-col gap-3 rounded-[22px] bg-mint p-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => createUser(newName, newRole),
              (result) => {
                if (result.id && result.code) setRevealed({ id: result.id, code: result.code });
                setAdding(false);
                setNewName("");
                setNewRole("employee");
              },
            );
          }}
        >
          <h3 className="text-base font-semibold">{u.newTitle}</h3>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-[2_1_220px] flex-col gap-1.5 text-[13px] font-semibold">
              {u.name}
              <input className={field} value={newName} onChange={(e) => setNewName(e.target.value)} autoComplete="off" required maxLength={60} />
            </label>
            <label className="flex flex-[1_1_160px] flex-col gap-1.5 text-[13px] font-semibold">
              {u.role}
              <select className={field} value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roles[r]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <button type="submit" className={btn.primary} disabled={pending || !newName.trim()}>
              {u.create}
            </button>
            <button type="button" className={btn.soft} onClick={() => setAdding(false)}>
              {t.cancel}
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-2.5">
        {users.map((user) => {
          const me = user.id === meId;
          const code = revealed?.id === user.id ? revealed.code : null;
          return (
            <div key={user.id} data-row className={`flex flex-col gap-2.5 ${user.active ? row : rowOff}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ background: user.active ? avatarColor(user.id) : "var(--color-subtle)" }}
                >
                  {initials(user.name)}
                </span>
                <div className="min-w-0 flex-[1_1_180px]">
                  <InlineText value={user.name} label={u.name} onSave={(name) => run(() => renameUser(user.id, name))} />
                </div>
                {me && <span className="rounded-full bg-teal-tint px-2.5 py-1 text-xs font-semibold text-teal-deep">{u.you}</span>}
                {!user.active && <span className="text-xs font-semibold">{u.inactive}</span>}
                <select
                  aria-label={u.role}
                  title={me ? u.selfNote : undefined}
                  className={fieldSmall}
                  value={user.role}
                  disabled={me || pending}
                  onChange={(e) => run(() => setUserRole(user.id, e.target.value))}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {roles[r]}
                    </option>
                  ))}
                </select>
                <span className="flex items-center gap-0.5 rounded-full bg-surface py-0.5 pl-3 pr-0.5">
                  <span aria-label={shown[user.id] ? undefined : u.codeHidden} className={`min-w-[86px] font-mono text-[13px] ${shown[user.id] ? "zk-fade-up select-all tracking-[1.5px] text-ink" : "tracking-[1px] text-ink-soft"}`}>
                    {shown[user.id] ?? "••••••••"}
                  </span>
                  <button
                    type="button"
                    aria-label={shown[user.id] ? u.hideCode : fill(u.showCode, { name: user.name })}
                    title={shown[user.id] ? u.hideCode : fill(u.showCode, { name: user.name })}
                    aria-pressed={!!shown[user.id]}
                    disabled={pending}
                    onClick={() =>
                      shown[user.id]
                        ? setShown((all) => withoutKey(all, user.id))
                        : run(() => revealUserCode(user.id), (result) => result.code && setShown((all) => ({ ...all, [user.id]: result.code! })))
                    }
                    className="flex size-9 items-center justify-center rounded-full text-icon hover:bg-mint"
                  >
                    <Icon name={shown[user.id] ? "eyeOff" : "eye"} size={17} />
                  </button>
                  {shown[user.id] && (
                    <button type="button" aria-label={u.copyCode} title={u.copyCode} onClick={() => copy(shown[user.id])} className="zk-pop flex size-9 items-center justify-center rounded-full text-icon hover:bg-mint">
                      <Icon name="copy" size={17} />
                    </button>
                  )}
                </span>
                <button
                  type="button"
                  className={btn.soft}
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => newUserCode(user.id),
                      (result) => {
                        if (!result.code) return;
                        setRevealed({ id: user.id, code: result.code });
                        setShown((all) => withoutKey(all, user.id));
                      },
                    )
                  }
                >
                  {u.newCode}
                </button>
                {!me && (
                  <button
                    type="button"
                    className={btn.soft}
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => setUserActive(user.id, !user.active),
                        () => show(fill(user.active ? u.deactivated : u.reactivated, { name: user.name })),
                      )
                    }
                  >
                    {user.active ? u.deactivate : u.reactivate}
                  </button>
                )}
              </div>
              {code && (
                <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 rounded-[14px] bg-sun-tint py-2.5 pl-3.5 pr-2.5">
                  <span className="select-all font-mono text-lg font-medium tracking-[2px]">{code}</span>
                  <span className="flex-[1_1_200px] text-[13px] leading-snug text-sun-ink">{fill(u.codeNotice, { name: user.name.split(" ")[0] })}</span>
                  <button type="button" className={btn.soft} onClick={() => copy(code)}>
                    {u.copy}
                  </button>
                  <button type="button" className={btn.soft} onClick={() => setRevealed(null)}>
                    {u.done}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 border-t border-line pt-[18px] sm:grid-cols-3">
        {ROLES.map((r) => (
          <div key={r} className="flex flex-col gap-1">
            <span className="text-sm font-semibold">{roles[r]}</span>
            <span className="text-[13px] leading-normal text-ink-soft">{u.roleHelp[r]}</span>
          </div>
        ))}
      </div>
      <Toast message={message} />
    </section>
  );
}

export function Plus() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
