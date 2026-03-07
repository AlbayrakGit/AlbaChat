/**
 * group_members tablosuna is_favorite kolonu ekle
 * Kullanıcı favori sohbetlerini sunucu tarafında saklasın
 */
export async function up(knex) {
  await knex.schema.alterTable('group_members', (t) => {
    t.boolean('is_favorite').notNullable().defaultTo(false);
  });
}

export async function down(knex) {
  await knex.schema.alterTable('group_members', (t) => {
    t.dropColumn('is_favorite');
  });
}
