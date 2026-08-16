const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function shortDate(iso: string): string {
  const d = new Date(iso);
  return MON[d.getMonth()] + ' ' + String(d.getDate()).padStart(2, '0');
}

// Called on the server so the rendered string is stable through hydration.
export function relative(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  const mins = Math.floor((now - then) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return mins + ' min ago';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h ago';
  if (hours < 48) return 'Yesterday';
  return shortDate(iso);
}

// "Getting set up" -> a subject line the inbox can show without inventing one.
export function subjectOf(topic: string | null, message: string): string {
  if (topic) return topic;
  const firstLine = message.trim().split('\n')[0];
  return firstLine.length > 60 ? firstLine.slice(0, 60) + '…' : firstLine || 'No subject';
}
