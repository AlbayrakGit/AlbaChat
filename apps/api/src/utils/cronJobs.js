import cron from 'node-cron';
import { knex } from '../db/knex.js';
import { runPolicy, purgeExpiredFiles } from '../services/cleanupService.js';

export function startCronJobs() {
  // Her gece 02:00 — aktif temizleme politikalarını çalıştır
  cron.schedule('0 2 * * *', async () => {
    console.log('[Cron] Temizleme politikaları çalışıyor...');
    try {
      const policies = await knex('file_cleanup_policies').where({ is_active: true });
      for (const policy of policies) {
        try {
          const result = await runPolicy(policy.id);
          console.log(`[Cron] Politika #${policy.id} "${policy.name}": ${result.deleted} dosya silindi, ${result.purged} MinIO'dan kaldırıldı`);
        } catch (err) {
          console.error(`[Cron] Politika #${policy.id} hatası:`, err.message);
        }
      }
    } catch (err) {
      console.error('[Cron] Politika çalıştırma hatası:', err.message);
    }
  });

  // Her saat başı — grace period dolmuş soft-deleted dosyaları MinIO'dan purge et
  cron.schedule('0 * * * *', async () => {
    try {
      const purged = await purgeExpiredFiles();
      if (purged > 0) {
        console.log(`[Cron] ${purged} dosya MinIO'dan kaldırıldı (grace period doldu)`);
      }
    } catch (err) {
      console.error('[Cron] MinIO purge hatası:', err.message);
    }
  });

  console.log('[Cron] Zamanlanmış görevler başlatıldı (gece 02:00 temizleme + saatlik purge)');
}
