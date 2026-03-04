export async function up(knex) {
    await knex.schema.alterTable('messages', (t) => {
        t.jsonb('reactions').nullable().defaultTo('{}');
    });
}

export async function down(knex) {
    await knex.schema.alterTable('messages', (t) => {
        t.dropColumn('reactions');
    });
}
