"use client";

import { useState, useTransition } from "react";
import { personColor } from "@/components/avatar-group";
import { Icon } from "@/components/icons";
import { shrinkOut, UndoToast, useUndoToast } from "@/components/list-motion";
import { SegmentedControl } from "@/components/motion";
import { initials } from "@/components/top-bar";
import { card } from "@/components/ui";
import type { Role } from "@/db/schema";
import type { Dictionary, ErrorKey } from "@/i18n/dictionaries";
import { fill } from "@/i18n/format";
import { createUser, newUserCode, renameUser, revealUserCode, setUserActive, setUserRole } from "./actions";
import { AddButton, AddForm, Badge, CodeReveal, CopyButton, FormButtons, Group, inputCls, Line, RowFoot, SavedInput, SectionTop, SettingsRow, useFresh } from "./settings-ui";

type User = { id: string; name: string; role: Role; active: boolean };
const ROLES: Role[] = ["admin", "manager", "employee"];

/**
 * Settings → Users: each person opens to rename, change role (a sliding pill), and show, copy or
 * replace their code (the characters blur in one by one). Deactivated people fold away in a group.
 */
export function UsersSection({ users, meId, t, errors, roles }: { users: User[]; meId: string; t: Dictionary["settings"]; errors: Dictionary["errors"]; roles: Dictionary["roles"] }) {
  const u = t.users;
  const [rows, setRows] = useState(users);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<{ name: string; role: Role }>({ name: "", role: "employee" });
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();
  const undo = useUndoToast();
  // One message area for everything (errors too), so two messages never sit on top of each other.
  const show = (text: string) => undo.show(text, t.undo);
  const { isFresh, mark } = useFresh();
  const fail = (key: ErrorKey) => show(errors[key] ?? errors.generic);
  const roleItems = ROLES.map((r) => ({ key: r, label: roles[r] }));
  const setCode = (id: string, code: string | null) =>
    setCodes((all) => {
      const next = { ...all };
      if (code) next[id] = code;
      else delete next[id];
      return next;
    });

  const change = (id: string, patch: Partial<User>, save: () => Promise<{ ok: true } | { ok: false; error: ErrorKey }>) => {
    const before = rows;
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    startTransition(async () => {
      const result = await save();
      if (!result.ok) {
        setRows(before);
        fail(result.error);
      }
    });
  };

  // A new person appears, opens, and shows their code straight away.
  const add = () =>
    startTransition(async () => {
      const result = await createUser(draft.name, draft.role);
      if (!result.ok || !result.id) return fail(result.ok ? "generic" : result.error);
      setRows((list) => [...list, { id: result.id!, name: draft.name.trim().replace(/\s+/g, " "), role: draft.role, active: true }]);
      mark(result.id);
      if (result.code) setCode(result.id, result.code);
      setOpenId(result.id);
      setAdding(false);
      setDraft({ name: "", role: "employee" });
    });

  const toggleCode = (row: User) =>
    codes[row.id]
      ? setCode(row.id, null)
      : startTransition(async () => {
          const result = await revealUserCode(row.id);
          if (!result.ok) return fail(result.error);
          if (result.code) setCode(row.id, result.code);
        });
  const replaceCode = (row: User) =>
    startTransition(async () => {
      const result = await newUserCode(row.id);
      if (!result.ok) return fail(result.error);
      if (result.code) setCode(row.id, result.code);
      show(fill(u.newCodeToast, { name: row.name.split(" ")[0] }));
    });
  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      show(u.copied);
      return true;
    } catch {
      show(u.copyFailed);
      return false;
    }
  };

  // Deactivating folds the row into the "Deactivated" group (with Undo); reactivating brings it back.
  const setActive = (row: User, active: boolean, el: HTMLElement | null) =>
    startTransition(async () => {
      const result = await setUserActive(row.id, active);
      if (!result.ok) return fail(result.error);
      setCode(row.id, null);
      shrinkOut(el, () => {
        setOpenId(null);
        setRows((list) => [...list.filter((r) => r.id !== row.id), { ...row, active }]);
        mark(row.id);
      });
      if (active) show(fill(u.reactivatedToast, { name: row.name }));
      else
        undo.show(fill(u.deactivatedToast, { name: row.name }), t.undo, () =>
          startTransition(async () => {
            const back = await setUserActive(row.id, true);
            if (!back.ok) return fail(back.error);
            setRows((list) => [...list.filter((r) => r.id !== row.id), { ...row, active: true }]);
            mark(row.id);
          }),
        );
    });

  const rowOf = (row: User) => {
    const me = row.id === meId;
    const code = codes[row.id] ?? null;
    return (
      <SettingsRow
        key={row.id}
        id={row.id}
        fresh={isFresh(row.id)}
        open={openId === row.id}
        onToggle={() => setOpenId((id) => (id === row.id ? null : row.id))}
        openLabel={fill(t.open, { name: row.name })}
        muted={!row.active}
        lead={
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white" style={{ background: row.active ? personColor(row.id) : "var(--color-subtle)" }}>
            {initials(row.name)}
          </span>
        }
        title={row.name}
        subtitle={row.active ? roles[row.role] : u.deactivatedLine}
        badges={me ? <Badge tone="teal">{u.you}</Badge> : undefined}
      >
        <Line label={u.name}>
          <SavedInput value={row.name} label={u.name} required onSave={(name) => change(row.id, { name }, () => renameUser(row.id, name))} />
        </Line>
        {row.active ? (
          <>
            <Line label={u.role}>
              {me ? (
                <span className="text-[13.5px] text-muted">{u.selfRole}</span>
              ) : (
                <SegmentedControl label={u.role} items={roleItems} value={row.role} onChange={(role) => change(row.id, { role: role as Role }, () => setUserRole(row.id, role))} tone="teal" itemClassName="min-h-9 px-3.5 text-[13px]" />
              )}
            </Line>
            <Line label={u.accessCode}>
              <span className="flex flex-wrap items-center gap-2">
                <CodeReveal code={code} hiddenLabel={u.codeHidden} />
                <button
                  type="button"
                  aria-label={code ? u.hideCode : fill(u.showCode, { name: row.name })}
                  title={code ? u.hideCode : fill(u.showCode, { name: row.name })}
                  aria-pressed={!!code}
                  onClick={() => toggleCode(row)}
                  className="flex size-10 items-center justify-center rounded-full bg-surface text-ink-soft"
                >
                  <Icon name={code ? "eyeOff" : "eye"} size={18} />
                </button>
                {code && <CopyButton label={u.copyCode} onCopy={() => copy(code)} />}
                <button type="button" onClick={() => replaceCode(row)} className="min-h-10 rounded-full bg-mint-soft px-4 text-[13px] font-bold hover:bg-surface">
                  {u.newCode}
                </button>
              </span>
            </Line>
            {me ? (
              <RowFoot note={u.selfNote} cancelLabel={t.cancel} />
            ) : (
              <RowFoot label={u.deactivate} confirm={fill(u.confirmDeactivate, { name: row.name })} cancelLabel={t.cancel} onDo={(el) => setActive(row, false, el)} />
            )}
          </>
        ) : (
          <RowFoot note={u.keptHistory} label={u.reactivate} tone="sun" cancelLabel={t.cancel} onDo={(el) => setActive(row, true, el)} />
        )}
      </SettingsRow>
    );
  };

  const active = rows.filter((r) => r.active);
  const inactive = rows.filter((r) => !r.active);
  return (
    <section aria-label={t.sections.users} className={card}>
      <SectionTop title={t.sections.users} intro={u.intro} add={<AddButton label={u.add} open={adding} onClick={() => setAdding((v) => !v)} />} />
      <AddForm open={adding} onSubmit={add}>
        <input className={`${inputCls} flex-[1_1_220px]`} aria-label={u.name} placeholder={u.name} value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoComplete="off" />
        <SegmentedControl label={u.role} items={roleItems} value={draft.role} onChange={(role) => setDraft({ ...draft, role: role as Role })} tone="teal" itemClassName="min-h-9 px-3.5 text-[13px]" />
        <FormButtons cancel={t.cancel} submit={u.createShow} onCancel={() => setAdding(false)} disabled={!draft.name.trim()} />
      </AddForm>
      <div className="flex flex-col gap-2.5">{active.map(rowOf)}</div>
      <Group label={fill(u.deactivatedGroup, { n: inactive.length })} count={inactive.length}>
        {inactive.map(rowOf)}
      </Group>
      <div className="grid gap-3 border-t border-line pt-[18px] sm:grid-cols-3">
        {ROLES.map((r) => (
          <div key={r} className="flex flex-col gap-1">
            <span className="text-sm font-semibold">{roles[r]}</span>
            <span className="text-[13px] leading-normal text-ink-soft">{u.roleHelp[r]}</span>
          </div>
        ))}
      </div>
      <UndoToast offer={undo.offer} onClose={undo.close} />
    </section>
  );
}
