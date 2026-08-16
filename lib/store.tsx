'use client';

import { useRouter } from 'next/navigation';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ADMIN_ALLOWLIST } from './allowlist';
import type { Admin } from './data';

type Ctx = {
  hide: (emails: string[]) => Promise<void>;
  restore: (email: string) => Promise<void>;
  notes: Record<string, string>;
  saveNote: (email: string, note: string) => void;
  admins: Admin[];
  addAdmin: (name: string, email: string) => void;
  renameAdmin: (index: number, name: string) => void;
  note: (action: string, kind: string, target?: string) => void;
  toast: string;
  flash: (msg: string) => void;
};

const AdminCtx = createContext<Ctx | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [admins, setAdmins] = useState<Admin[]>(ADMIN_ALLOWLIST);
  const [toast, setToast] = useState('');

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(t => (t === msg ? '' : t)), 3600);
  }, []);

  // Fire-and-forget audit row. The server decides whether it can be stored;
  // a failed log must not block the action that produced it.
  const note = useCallback((action: string, kind: string, target?: string) => {
    void fetch('/api/activity', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, kind, target: target ?? null })
    }).catch(() => {});
  }, []);

  const setHidden = useCallback(async (emails: string[], hide: boolean) => {
    const res = await fetch('/api/waitlist', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ emails, action: hide ? 'hide' : 'restore' })
    });
    if (!res.ok) {
      const { error } = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
      flash(error ?? 'Could not update the record.');
      return;
    }
    router.refresh();
  }, [flash, router]);

  const hide = useCallback(async (emails: string[]) => {
    await setHidden(emails, true);
    flash(emails.length === 1
      ? 'Record hidden. Retained 30 days, then anonymised.'
      : emails.length + ' records hidden. Retained 30 days, then anonymised.');
  }, [flash, setHidden]);

  const restore = useCallback(async (email: string) => {
    await setHidden([email], false);
    flash('Record restored to the console.');
  }, [flash, setHidden]);

  // Session-only: `waitlist` has no notes column, so there is nowhere to put
  // this yet. Say so rather than implying it was saved.
  const saveNote = useCallback((email: string, value: string) => {
    setNotes(n => ({ ...n, [email]: value }));
    flash('Note kept for this session only — the waitlist table has no notes column.');
  }, [flash]);

  // TODO: persist to the allowlist table once it exists. Until then this is
  // session-only — the server check in lib/auth.ts reads ADMIN_ALLOWLIST, so a
  // name added here cannot actually sign in.
  const addAdmin = useCallback((name: string, email: string) => {
    const normalised = email.trim().toLowerCase();
    const display = name.trim() || normalised.split('@')[0];
    setAdmins(a => (
      a.some(x => x.email === normalised) ? a : [...a, { name: display, email: normalised, role: 'Admin' }]
    ));
    note('Staged admin for the allowlist', 'Access', normalised);
    flash('Staged for this session. Add ' + normalised + ' to ADMIN_ALLOWLIST to make it stick.');
  }, [flash, note]);

  const renameAdmin = useCallback((index: number, name: string) => {
    setAdmins(a => a.map((x, i) => (i === index ? { ...x, name } : x)));
  }, []);

  const value = useMemo<Ctx>(() => ({
    hide, restore, notes, saveNote, admins, addAdmin, renameAdmin, note, toast, flash
  }), [hide, restore, notes, saveNote, admins, addAdmin, renameAdmin, note, toast, flash]);

  return <AdminCtx.Provider value={value}>{children}</AdminCtx.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminCtx);
  if (!ctx) throw new Error('useAdmin must be used inside <AdminProvider>');
  return ctx;
}
