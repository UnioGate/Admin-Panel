'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ADMINS, BASE_ACTIVITY, type Admin, type ActivityEntry } from './data';

type Ctx = {
  hidden: Record<string, boolean>;
  hide: (emails: string[]) => void;
  restore: (email: string) => void;
  notes: Record<string, string>;
  saveNote: (email: string, note: string) => void;
  admins: Admin[];
  addAdmin: (name: string, email: string) => void;
  renameAdmin: (index: number, name: string) => void;
  activity: ActivityEntry[];
  note: (text: string, kind: string) => void;
  toast: string;
  flash: (msg: string) => void;
};

const AdminCtx = createContext<Ctx | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [admins, setAdmins] = useState<Admin[]>(ADMINS);
  const [log, setLog] = useState<ActivityEntry[]>([]);
  const [toast, setToast] = useState('');

  const flash = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(t => (t === msg ? '' : t)), 3600);
  }, []);

  const note = useCallback((text: string, kind: string) => {
    const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setLog(l => [{ text, kind, when: 'Today ' + stamp }, ...l]);
  }, []);

  const hide = useCallback((emails: string[]) => {
    // TODO: POST /api/waitlist/hide — soft delete, sets hidden_at server-side.
    setHidden(h => {
      const next = { ...h };
      emails.forEach(e => { next[e] = true; });
      return next;
    });
    note(emails.length === 1
      ? 'Waitlist record for ' + emails[0] + ' hidden on erasure request'
      : emails.length + ' waitlist records hidden on erasure request', 'Privacy');
    flash(emails.length === 1
      ? 'Record hidden. Retained 30 days, then anonymised.'
      : emails.length + ' records hidden. Retained 30 days, then anonymised.');
  }, [flash, note]);

  const restore = useCallback((email: string) => {
    setHidden(h => { const next = { ...h }; delete next[email]; return next; });
    note('Restored waitlist record for ' + email, 'Privacy');
    flash('Record restored to the console.');
  }, [flash, note]);

  const saveNote = useCallback((email: string, value: string) => {
    setNotes(n => ({ ...n, [email]: value }));
    note('Note saved on ' + email, 'Waitlist');
    flash('Note saved to the record.');
  }, [flash, note]);

  const addAdmin = useCallback((name: string, email: string) => {
    const display = name.trim() || email.split('@')[0];
    setAdmins(a => [...a, { name: display, email, role: 'Admin' }]);
    note(display + ' (' + email + ') added to the admin allowlist', 'Access');
    flash(display + ' can now sign in with Privy.');
  }, [flash, note]);

  const renameAdmin = useCallback((index: number, name: string) => {
    setAdmins(a => a.map((x, i) => (i === index ? { ...x, name } : x)));
  }, []);

  const value = useMemo<Ctx>(() => ({
    hidden, hide, restore, notes, saveNote, admins, addAdmin, renameAdmin,
    activity: [...log, ...BASE_ACTIVITY], note, toast, flash
  }), [hidden, hide, restore, notes, saveNote, admins, addAdmin, renameAdmin, log, note, toast, flash]);

  return <AdminCtx.Provider value={value}>{children}</AdminCtx.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminCtx);
  if (!ctx) throw new Error('useAdmin must be used inside <AdminProvider>');
  return ctx;
}
