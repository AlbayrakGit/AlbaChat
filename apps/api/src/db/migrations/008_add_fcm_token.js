/**
 * FCM (Firebase Cloud Messaging) token desteği
 * push_subscriptions tablosuna fcm_token kolonu eklenir.
 * Web Push ve FCM aynı tabloda tutulur — endpoint NULL ise FCM kaydıdır.
 */

export async function up(knex) {
  await knex.schema.alterTable('push_subscriptions', (t) => {
    t.text('fcm_token').nullable().unique();
    t.string('platform', 32).nullable(); // 'web', 'android', 'ios'
  });
}

export async function down(knex) {
  await knex.schema.alterTable('push_subscriptions', (t) => {
    t.dropColumn('fcm_token');
    t.dropColumn('platform');
  });
}
