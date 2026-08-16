import { supabase } from './supabase';
import type { Admin, AdminRole } from './data';

// The admin allowlist, in Supabase. This is the one source for who can open the
// console — there is no environment fallback, deliberately: two sources would
// eventually disagree, and the one that wins would be whichever the reader
// happened to check.
//
// The table is read with the service role key, so nothing here may run in the
// browser. The client gets the list handed down from a server component that
// has already passed requireAdmin().

const MISSING_TABLE = ['42P01', 'PGRST205'];

type AdminRow = { email: string; name: string; role: string; created_at: string; added_by: string | null };

function toAdmin(r: AdminRow): Admin {
  // The role is constrained in the database, but a row written before the
  // constraint — or by hand — should not crash the console. Least privilege on
  // anything unrecognised.
  return { email: r.email, name: r.name, role: (r.role as AdminRole) ?? 'Support' };
}

export type AdminList = { admins: Admin[]; provisioned: boolean };

/**
 * `provisioned` is false when the table does not exist yet. That is different
 * from an empty list, and the two need different messages: one means "run
 * sql/admins.sql", the other means "you locked everyone out".
 */
export async function listAdmins(): Promise<AdminList> {
  const { data, error } = await supabase
    .from('admins')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    if (MISSING_TABLE.includes(error.code)) return { admins: [], provisioned: false };
    throw new Error('admins: ' + error.message);
  }

  return { admins: (data as AdminRow[]).map(toAdmin), provisioned: true };
}

/** Single-row lookup for the auth check, which runs on every admin request. */
export async function findAdmin(email: string): Promise<Admin | null> {
  const normalised = email.trim().toLowerCase();
  if (normalised.indexOf('@') < 1) return null;

  const { data, error } = await supabase
    .from('admins')
    .select('*')
    .eq('email', normalised)
    .limit(1);

  // Includes the missing-table case: no table, no admins, nobody gets in.
  if (error) return null;

  const row = (data as AdminRow[])[0];
  return row ? toAdmin(row) : null;
}

export async function addAdmin(entry: { email: string; name: string; role: AdminRole; addedBy: string }): Promise<void> {
  const email = entry.email.trim().toLowerCase();
  const { error } = await supabase.from('admins').insert({
    email,
    name: entry.name.trim() || email.split('@')[0],
    role: entry.role,
    added_by: entry.addedBy
  });

  if (error) {
    if (error.code === '23505') throw new Error(email + ' is already on the allowlist.');
    throw new Error('admins: ' + error.message);
  }
}

export async function updateAdmin(email: string, patch: { name?: string; role?: AdminRole }): Promise<void> {
  const fields: Record<string, string> = {};
  if (patch.name !== undefined) fields.name = patch.name.trim() || email.split('@')[0];
  if (patch.role !== undefined) fields.role = patch.role;
  if (Object.keys(fields).length === 0) return;

  const { error } = await supabase.from('admins').update(fields).eq('email', email.trim().toLowerCase());
  if (error) throw new Error('admins: ' + error.message);
}

export async function removeAdmin(email: string): Promise<void> {
  const { error } = await supabase.from('admins').delete().eq('email', email.trim().toLowerCase());
  if (error) throw new Error('admins: ' + error.message);
}

/**
 * Guards against locking everyone out. Removing or demoting the last Owner
 * leaves a console nobody can administer, and the only way back would be
 * editing the table by hand in Supabase.
 */
export async function ownerCount(): Promise<number> {
  const { count, error } = await supabase
    .from('admins')
    .select('email', { count: 'exact', head: true })
    .eq('role', 'Owner');
  if (error) throw new Error('admins: ' + error.message);
  return count ?? 0;
}
