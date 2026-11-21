"use client";

import { useState } from "react";
import { InlineText } from "@/components/inline-text";
import { Toast, useToast } from "@/components/toast";
import { btn, card, field, row, rowOff } from "@/components/ui";
import type { Dictionary } from "@/i18n/dictionaries";
import { addContentType, renameContentType, setContentTypeArchived, setContentTypeCode } from "./actions";
import { SectionHeader } from "./section-header";
import { useAction } from "./use-action";
import { Plus } from "./users-section";

type ContentType = { id: string; code: string; name: string; archived: boolean };

export function ContentTypesSection({ types, t, errors }: { types: ContentType[]; t: Dictionary["settings"]; errors: Dictionary["errors"] }) {
  const { message, show } = useToast();
  const { pending, run } = useAction(errors, show);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const c = t.content;

  return (
    <section aria-label={t.sections.content} className={card}>
      <SectionHeader title={t.sections.content} intro={c.intro} />
      <div className="flex flex-col gap-2.5">
        {types.map((type) => (
          <div key={type.id} data-row className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${type.archived ? rowOff : row}`}>
            <div className="w-[120px] shrink-0 rounded-[10px] bg-white">
              <InlineText mono value={type.code} label={c.code} onSave={(next) => run(() => setContentTypeCode(type.id, next))} />
            </div>
            <div className="min-w-0 flex-[1_1_200px]">
              <InlineText value={type.name} label={c.name} onSave={(next) => run(() => renameContentType(type.id, next))} />
            </div>
            {type.archived && <span className="text-xs font-semibold">{c.archived}</span>}
            <button type="button" className={btn.soft} disabled={pending} onClick={() => run(() => setContentTypeArchived(type.id, !type.archived))}>
              {type.archived ? c.restore : c.archive}
            </button>
          </div>
        ))}
      </div>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => addContentType(code, name),
            () => {
              setCode("");
              setName("");
            },
          );
        }}
      >
        <div className="flex flex-wrap gap-2.5">
          <input
            className={`${field} w-[140px] shrink-0 font-mono text-sm`}
            aria-label={c.code}
            placeholder={c.code}
            value={code}
            onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10))}
            autoComplete="off"
            spellCheck={false}
          />
          <input className={`${field} flex-[1_1_200px]`} aria-label={c.name} placeholder={c.name} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="off" />
          <button type="submit" className={btn.primary} disabled={pending || !code || !name.trim()}>
            <Plus />
            {c.add}
          </button>
        </div>
        <p className="text-xs text-muted">{c.codeHelp}</p>
      </form>
      <Toast message={message} />
    </section>
  );
}
