/**
 * "Son görülme" zamanını Türkçe metin olarak formatlar.
 *
 *  - < 1dk    → "az önce"
 *  - < 10dk   → "X dakika önce"
 *  - bugün    → "bugün 15:10"
 *  - dün      → "dün 15:10"
 *  - bu yıl   → "3 Mar 15:10"
 *  - eski     → "3 Mar 2025"
 */
export function formatLastSeen(iso: string | null | undefined): string | null {
  if (!iso) return null;

  const date = new Date(iso);
  if (isNaN(date.getTime())) return null;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return 'az önce';
  if (diffMin < 10) return `${diffMin} dakika önce`;

  const time = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86_400_000);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (target.getTime() === today.getTime()) return time;
  if (target.getTime() === yesterday.getTime()) return `dün ${time}`;

  const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const dayMonth = `${date.getDate()} ${months[date.getMonth()]}`;

  if (date.getFullYear() === now.getFullYear()) return `${dayMonth} ${time}`;
  return `${dayMonth} ${date.getFullYear()}`;
}
