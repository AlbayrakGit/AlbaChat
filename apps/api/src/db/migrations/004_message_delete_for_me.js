export async function up(knex) {
    await knex.schema.alterTable('messages', (table) => {
        table.specificType('deleted_for', 'integer[]').defaultTo('{}');
    });
}

export async function down(knex) {
    await knex.schema.alterTable('messages', (table) => {
        table.dropColumn('deleted_for');
    });
}
