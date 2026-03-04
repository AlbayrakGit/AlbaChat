import Knex from 'knex';

export const knex = Knex({
  client: 'pg',
  connection: process.env.DATABASE_URL || {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'albachat',
    user: process.env.POSTGRES_USER || 'albachat',
    password: process.env.POSTGRES_PASSWORD || 'albachat_secret',
  },
  pool: {
    min: 2,
    max: 10,
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
  },
  migrations: {
    directory: './src/db/migrations',
    extension: 'js',
  },
  searchPath: ['public'],
});
