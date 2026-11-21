"use client";

import { useState, useTransition } from "react";
import { btn } from "@/components/ui";
import type { Dictionary } from "@/i18n/dictionaries";
import { setCustomerArchived } from "../actions";

export function RestoreCustomer({ id, label, errors }: { id: string; label: string; errors: Dictionary["errors"] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className={btn.soft}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await setCustomerArchived(id, false);
            setError(result.ok ? null : errors[result.error]);
          })
        }
      >
        {label}
      </button>
      {error && <span role="alert" className="text-danger">{error}</span>}
    </>
  );
}
