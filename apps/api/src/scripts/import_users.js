import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { knex } from '../db/knex.js';
import { hashPassword } from '../services/authService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
    const csvPath = process.env.CSV_PATH || path.join(__dirname, 'clean_users.csv');
    if (!fs.existsSync(csvPath)) {
        console.error('CSV dosyası bulunamadı:', csvPath);
        process.exit(1);
    }

    const csvText = fs.readFileSync(csvPath, 'utf8');
    const lines = csvText.split(/\r?\n/).filter(Boolean);
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows = lines.slice(1);

    console.log(`Toplam ${rows.length} satır işleniyor...`);

    for (const row of rows) {
        const values = row.split(',').map(v => v.trim());
        const data = {};
        headers.forEach((h, i) => { data[h] = values[i]; });

        const { display_name, username, email, password, role } = data;

        if (!username || !email) continue;

        try {
            const password_hash = await hashPassword(password || '12345678');

            let dbRole = 'user';
            if (role) {
                const r = role.toUpperCase();
                if (r === 'YÖNETİCİ' || r === 'ADMIN') dbRole = 'admin';
            }

            await knex('users')
                .insert({
                    display_name,
                    username,
                    email: email.toLowerCase(),
                    password_hash,
                    role: dbRole,
                    is_active: true
                })
                .onConflict('username')
                .merge();

            console.log(`Başarılı: ${username}`);
        } catch (err) {
            console.error(`Hata (${username}):`, err.message);
        }
    }

    console.log('İşlem tamamlandı.');
    process.exit(0);
}

main().catch(err => {
    console.error('Kritik Hata:', err);
    process.exit(1);
});
