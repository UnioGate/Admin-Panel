export type Status = 'Invited' | 'Confirmed' | 'Pending';

export type WaitlistEntry = {
  pos: number;
  email: string;
  wallet: string;
  source: string;
  joined: string;
  status: Status;
  referrals: number;
};

export type Message = {
  id: number;
  name: string;
  email: string;
  subject: string;
  when: string;
  topic: string;
  unread: boolean;
  body: string;
};

export type Admin = { name: string; email: string; role: 'Owner' | 'Admin' | 'Support' };

export type ActivityEntry = { text: string; when: string; kind: string };

// The admin allowlist is no longer mocked here — it is parsed from the
// environment in lib/allowlist.ts so the client guard and the server check
// cannot disagree about who is an admin.

const FIRST = ['ada','marcus','sofia','kenji','dmitri','nadia','joseph','elena','tom','priya','luca','amara','yusuf','clara','ben','ines','omar','lena','felix','zara','ravi','mia','noah','sana','pablo','ivy','hugo','tess','kwame','anya'];
const LAST = ['okonkwo','lee','reyes','tanaka','sokolov','haddad','mwangi','novak','bergstrom','nair','ferrari','diallo','ahmed','mendes','olsen','costa','farouk','weber','braun','ali','patel','chen','schmidt','yilmaz','moreno','kelly','duarte','lund','mensah','petrova'];
const DOM = ['gmail.com','protonmail.com','hey.com','fastmail.com','icloud.com','outlook.com','zenith.dev','vaultworks.io','ekohub.africa'];
const SRC = ['Twitter/X','Referral','Product Hunt','Newsletter','Direct'];
export const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// TODO: replace with `select * from waitlist order by position` once Supabase is wired.
const SEED: WaitlistEntry[] = [
  { pos: 1, email: 'ada.okonkwo@gmail.com', wallet: '0x7a3f\u202619bC', source: 'Twitter/X', joined: 'Jul 02', status: 'Invited', referrals: 24 },
  { pos: 2, email: 'marcus.lee@protonmail.com', wallet: '0x11d8\u20267c02', source: 'Direct', joined: 'Jul 02', status: 'Invited', referrals: 11 },
  { pos: 3, email: 'sofia.reyes@hey.com', wallet: '\u2014', source: 'Product Hunt', joined: 'Jul 04', status: 'Confirmed', referrals: 9 },
  { pos: 4, email: 'k.tanaka@outlook.jp', wallet: '0x9ef1\u20264a55', source: 'Referral', joined: 'Jul 06', status: 'Confirmed', referrals: 6 },
  { pos: 5, email: 'dmitri@vaultworks.io', wallet: '0x3cc0\u2026b81e', source: 'Twitter/X', joined: 'Jul 09', status: 'Confirmed', referrals: 5 },
  { pos: 6, email: 'nadia.haddad@gmail.com', wallet: '\u2014', source: 'Newsletter', joined: 'Jul 14', status: 'Pending', referrals: 3 },
  { pos: 7, email: 'j.mwangi@ekohub.africa', wallet: '0x58aa\u202603f7', source: 'Referral', joined: 'Jul 18', status: 'Confirmed', referrals: 3 },
  { pos: 8, email: 'elena.novak@fastmail.com', wallet: '0xba21\u2026cc90', source: 'Product Hunt', joined: 'Jul 22', status: 'Pending', referrals: 1 },
  { pos: 9, email: 'tom.bergstrom@icloud.com', wallet: '\u2014', source: 'Direct', joined: 'Aug 01', status: 'Pending', referrals: 1 },
  { pos: 10, email: 'priya.n@zenith.dev', wallet: '0xd4f6\u20262e11', source: 'Twitter/X', joined: 'Aug 05', status: 'Confirmed', referrals: 0 },
  { pos: 11, email: 'luca.ferrari@gmail.com', wallet: '0x6b39\u20267710', source: 'Newsletter', joined: 'Aug 09', status: 'Pending', referrals: 0 },
  { pos: 12, email: 'amara.diallo@gmail.com', wallet: '\u2014', source: 'Referral', joined: 'Aug 13', status: 'Pending', referrals: 0 }
];

function grow(list: WaitlistEntry[], to: number): WaitlistEntry[] {
  const out = [...list];
  for (let i = out.length; i < to; i++) {
    const d = new Date(2026, 6, 2 + Math.floor(i * 0.85));
    const hex = (0x1a2b + i * 7919).toString(16).slice(0, 4) + '\u2026' + (0xc0de + i * 104729).toString(16).slice(-4);
    out.push({
      pos: i + 1,
      email: FIRST[(i * 7) % FIRST.length] + '.' + LAST[(i * 11) % LAST.length] + '@' + DOM[(i * 5) % DOM.length],
      wallet: i % 3 === 1 ? '\u2014' : '0x' + hex,
      source: SRC[(i * 3) % SRC.length],
      joined: MON[d.getMonth()] + ' ' + String(d.getDate()).padStart(2, '0'),
      status: i % 4 === 0 || i % 7 === 3 ? 'Pending' : 'Confirmed',
      referrals: Math.max(0, 8 - Math.floor(i / 6))
    });
  }
  return out;
}

export const WAITLIST: WaitlistEntry[] = grow(SEED, 52);

export const MESSAGES: Message[] = [
  { id: 1, name: 'Sofia Reyes', email: 'sofia.reyes@hey.com', subject: 'Partnership \u2014 settlement rails', when: '2h ago', topic: 'Partnership', unread: true,
    body: 'Hi UnioGate team,\n\nWe run settlement infrastructure for three exchanges in LATAM and are looking at your gateway for merchant checkout. Could we get early access for a technical evaluation before public launch?\n\nHappy to sign an NDA.\n\n\u2014 Sofia' },
  { id: 2, name: 'Marcus Lee', email: 'marcus.lee@protonmail.com', subject: 'Waitlist position not updating', when: '5h ago', topic: 'Support', unread: true,
    body: 'I referred four people last week but my position still shows #219. Is referral credit applied on a delay, or did something break?' },
  { id: 3, name: 'Dmitri Sokolov', email: 'dmitri@vaultworks.io', subject: 'Security disclosure', when: 'Yesterday', topic: 'Security', unread: true,
    body: 'Reporting a minor issue with the waitlist endpoint: response times differ for registered vs unregistered emails, which allows enumeration. Low severity, but worth patching before launch.' },
  { id: 4, name: 'Priya Nair', email: 'priya.n@zenith.dev', subject: 'Press \u2014 launch coverage', when: 'Aug 12', topic: 'Press', unread: false,
    body: 'Writing for a fintech newsletter with 40k subscribers. Would love to cover the launch. Do you have a press kit and a target date I can reference?' },
  { id: 5, name: 'Tom Bergstr\u00f6m', email: 'tom.bergstrom@icloud.com', subject: 'Which chains at launch?', when: 'Aug 10', topic: 'Merchant', unread: false,
    body: 'Simple question \u2014 will Solana be supported at launch, or only EVM chains? That decides whether we move our storefront over.' },
  { id: 6, name: 'Amara Diallo', email: 'amara.diallo@gmail.com', subject: 'Careers \u2014 frontend', when: 'Aug 08', topic: 'Careers', unread: false,
    body: 'Saw your team page. Are you hiring frontend engineers? Six years with React and design systems, portfolio in my signature.' }
];

export const SIGNUPS_14D = [34, 41, 38, 52, 61, 48, 44, 70, 88, 76, 95, 118, 142, 214];

export const SOURCES = [
  { name: 'Twitter/X', count: 912 },
  { name: 'Referral', count: 640 },
  { name: 'Product Hunt', count: 431 },
  { name: 'Newsletter', count: 288 },
  { name: 'Direct', count: 210 }
];

export const BASE_ACTIVITY: ActivityEntry[] = [
  { text: 'amara.diallo@gmail.com joined the waitlist', when: '12 min ago', kind: 'Signup' },
  { text: 'New enquiry from Sofia Reyes \u2014 Partnership', when: '2 hours ago', kind: 'Inbox' },
  { text: 'Invite batch #7 sent to 20 addresses', when: '6 hours ago', kind: 'Invites' },
  { text: 'luca.ferrari@gmail.com joined the waitlist', when: 'Yesterday', kind: 'Signup' },
  { text: 'Security disclosure filed by Dmitri Sokolov', when: 'Yesterday', kind: 'Inbox' },
  { text: 'Referral credit recalculated for 88 accounts', when: 'Aug 13', kind: 'System' },
  { text: 'growth@uniogate.com signed in with Privy', when: 'Aug 13', kind: 'Access' },
  { text: 'Waitlist exported to CSV \u2014 2,392 rows', when: 'Aug 12', kind: 'Export' },
  { text: 'Contact form endpoint deployed', when: 'Aug 12', kind: 'System' }
];
