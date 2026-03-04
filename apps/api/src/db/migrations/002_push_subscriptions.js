/**
 * Push Subscription tablosu — Web Push API entegrasyonu
 */

export async function up(knex) {
  await knex.schema.createTable('push_subscriptions', (t) => {
    t.increments('id').primary();
    t.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.text('endpoint').notNullable().unique();
    t.text('p256dh').notNullable();   // public key
    t.text('auth').notNullable();     // auth secret
    t.string('user_agent', 512).nullable();
    t.timestamp('created_at').defaultTo(knex.fn.now());

    t.index(['user_id']);
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('push_subscriptions');
}
