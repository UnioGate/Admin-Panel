'use client';

import { useRouter } from 'next/navigation';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { Admin, AdminRole } from './data';

// What the server already knows about this request. Passed down from
// app/admin/layout.tsx rather than re-derived here: the client cannot be
// trusted to decide who is an admin, and asking it to would mean shipping the
// allowlist to the browser.
export type ClientSession = { email: string; name: string; role: AdminRole } | null;

type Ctx = {
  hide: (emails: string[]) => Promise<void>;
  restore: (email: string) => Promise<void>;
  notes: Record<string, string>;
  saveNote: (email: string, note: string) => void;
  session: ClientSession;
  admins: Admin[];
  adminsProvisioned: boolean;
  addAdmin: (name: string, email: string, role: AdminRole) => Promise<void>;
  renameAdmin: (email: string, name: string) => Promise<void>;
  setAdminRole: (email: string, role: AdminRole) => Promise<void>;
  removeAdmin: (email: string) => Promise<void>;
  note: (action: string, kind: string, target?: string) => void;
  toast: string;
  flash: (msg: string) => void;
};

const AdminCtx = createContext<Ctx | null>(null);

export function AdminProvider({
  children,
  session,
  admins,
  adminsProvisioned
}: {
  children: React.ReactNode;
  session: ClientSession;
  admins: Admin[];
  adminsProvisioned: boolean;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState<Record<string, string>>({});
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

  // All four allowlist writes go through /api/admins, which re-checks the
  // session and refuses anyone who is not an Owner. Nothing is applied
  // optimistically: being wrong about who has access is worse than a redraw.
  const writeAdmins = useCallback(async (method: 'POST' | 'PATCH' | 'DELETE', body: unknown, ok: string) => {
    const res = await fetch('/api/admins', {
      method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const { error } = (await res.json().catch(() => ({ error: res.statusText }))) as { error?: string };
      flash(error ?? 'Could not update the allowlist.');
      return;
    }
    router.refresh();
    flash(ok);
  }, [flash, router]);

  const addAdmin = useCallback(async (name: string, email: string, role: AdminRole) => {
    const normalised = email.trim().toLowerCase();
    await writeAdmins('POST', { email: normalised, name, role }, normalised + ' can now sign in as ' + role + '.');
  }, [writeAdmins]);

  const renameAdmin = useCallback(async (email: string, name: string) => {
    await writeAdmins('PATCH', { email, name }, 'Display name updated.');
  }, [writeAdmins]);

  const setAdminRole = useCallback(async (email: string, role: AdminRole) => {
    await writeAdmins('PATCH', { email, role }, email + ' is now ' + role + '.');
  }, [writeAdmins]);

  const removeAdmin = useCallback(async (email: string) => {
    await writeAdmins('DELETE', { email }, email + ' can no longer open the console.');
  }, [writeAdmins]);

  const value = useMemo<Ctx>(() => ({
    hide, restore, notes, saveNote, session, admins, adminsProvisioned,
    addAdmin, renameAdmin, setAdminRole, removeAdmin, note, toast, flash
  }), [hide, restore, notes, saveNote, session, admins, adminsProvisioned,
    addAdmin, renameAdmin, setAdminRole, removeAdmin, note, toast, flash]);

  return <AdminCtx.Provider value={value}>{children}</AdminCtx.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminCtx);
  if (!ctx) throw new Error('useAdmin must be used inside <AdminProvider>');
  return ctx;
}
