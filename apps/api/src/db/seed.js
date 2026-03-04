/**
 * Başlangıç verisi: admin kullanıcısı oluşturur.
 * Kullanım: npm run seed -w apps/api
 */
import 'dotenv/config';
import bcrypt from 'bcrypt';
import { knex } from './knex.js';

async function seed() {
  console.log('Seed başlıyor...');

  // Admin kullanıcısı var mı kontrol et
  const existing = await knex('users').where({ username: 'admin' }).first();
  if (existing) {
    console.log('admin kullanıcısı zaten mevcut, atlanıyor.');
    await knex.destroy();
    return;
  }

  const passwordHash = await bcrypt.hash('Admin123!', 12);

  await knex('users').insert({
    username: 'admin',
    email: 'admin@albachat.local',
    password_hash: passwordHash,
    display_name: 'Sistem Yöneticisi',
    role: 'admin',
    is_active: true,
    timezone: 'Europe/Istanbul',
  });

  console.log('Admin kullanıcısı oluşturuldu:');
  console.log('  Kullanıcı adı : admin');
  console.log('  Şifre         : Admin123!');
  console.log('  >> İlk girişten sonra şifrenizi değiştirin!');

  await knex.destroy();
}

seed().catch((err) => {
  console.error('Seed hatası:', err);
  process.exit(1);
});
