// Shapes the console renders. These mirror the real Supabase tables — the
// marketing site owns `waitlist` and `contact_messages`, so anything not in
// those tables is not something we can show.

export type WaitlistEntry = {
  id: number;
  pos: number;
  email: string;
  createdAt: string;
  unsubscribed: boolean;
  hiddenAt: string | null;
};

export type Message = {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  message: string;
  topic: string | null;
  business: string | null;
  volume: string | null;
  status: string;
  handledAt: string | null;
  notes: string | null;
};

export type Admin = { name: string; email: string; role: 'Owner' | 'Admin' | 'Support' };

export type ActivityEntry = { text: string; when: string; kind: string };
