import 'dotenv/config';
import { knex } from './knex.js';

const command = process.argv[2];

async function run() {
  try {
    if (command === 'rollback') {
      const [batchNo, log] = await knex.migrate.rollback();
      console.log(`Rollback — Batch ${batchNo}:`);
      log.forEach((f) => console.log(' -', f));
    } else {
      const [batchNo, log] = await knex.migrate.latest();
      console.log(`Migration tamamlandı — Batch ${batchNo}:`);
      log.forEach((f) => console.log(' +', f));
    }
  } catch (err) {
    console.error('Migration hatası:', err);
    process.exit(1);
  } finally {
    await knex.destroy();
  }
}

run();
