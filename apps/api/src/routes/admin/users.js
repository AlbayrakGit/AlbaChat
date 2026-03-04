import { authenticate, requireAdmin } from '../../middleware/authenticate.js';
import { knex } from '../../db/knex.js';
import { hashPassword } from '../../services/authService.js';
import { listUsers, getUserById, setUserStatus, resetPassword, UserNotFoundError, ForbiddenError } from '../../services/userService.js';
import { io } from '../../server.js';

/**
 * Basit CSV parser — başlık satırı: display_name,username,email,password,role
 * Tırnaklı alan veya gömülü virgül desteklenmez (kurumsal import için yeterli).
 */
function parseCSV(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV en az bir başlık ve bir veri satırı içermeli.');

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const required = ['display_name', 'username', 'email', 'password'];
  for (const req of required) {
    if (!headers.includes(req)) throw new Error(`CSV başlığında '${req}' sütunu eksik.`);
  }

  return lines.slice(1).map((line, i) => {
    const values = line.split(',').map((v) => v.trim());
    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    row._lineNumber = i + 2;
    return row;
  });
}

export default async function adminUserRoutes(fastify) {
  // Tüm route'lar Admin gerektiriyor
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireAdmin);

  // GET /api/admin/users?search=&page=&limit=&includeInactive=true
  fastify.get('/', async (req, reply) => {
    const { search = '', page = '1', limit = '50', includeInactive = 'false' } = req.query;
    const result = await listUsers({
      search,
      page: Math.max(1, parseInt(page, 10)),
      limit: Math.min(100, parseInt(limit, 10)),
      includeInactive: includeInactive === 'true',
    });
    return reply.send({ success: true, ...result });
  });

  // GET /api/admin/users/:id
  fastify.get('/:id', async (req, reply) => {
    try {
      const user = await getUserById(parseInt(req.params.id, 10));

      // Üye olduğu grupları da getir
      const groups = await knex('groups as g')
        .join('group_members as gm', 'g.id', 'gm.group_id')
        .where('gm.user_id', user.id)
        .select('g.id', 'g.name', 'g.type', 'gm.role as member_role');

      return reply.send({ success: true, data: { ...user, groups } });
    } catch (err) {
      if (err instanceof UserNotFoundError) return reply.code(404).send({ success: false, error: { code: err.code, message: err.message } });
      throw err;
    }
  });

  // POST /api/admin/users — yeni kullanıcı oluştur
  fastify.post('/', async (req, reply) => {
    const { username, email, password, display_name, role = 'user' } = req.body || {};

    if (!username || !email || !password || !display_name) {
      return reply.code(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'username, email, password, display_name gerekli.' },
      });
    }

    if (!['admin', 'user'].includes(role)) {
      return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'role: admin veya user olmalı.' } });
    }

    // Benzersizlik kontrolü
    const existing = await knex('users')
      .where({ username })
      .orWhere({ email })
      .first('id', 'username', 'email');

    if (existing) {
      const field = existing.username === username ? 'username' : 'email';
      return reply.code(409).send({
        success: false,
        error: { code: 'DUPLICATE_USER', message: `Bu ${field} zaten kullanımda.` },
      });
    }

    const password_hash = await hashPassword(password);
    const [user] = await knex('users')
      .insert({ username: username.trim(), email: email.trim().toLowerCase(), password_hash, display_name: display_name.trim(), role })
      .returning(['id', 'username', 'email', 'display_name', 'role', 'is_active', 'created_at']);

    // Audit log
    await knex('audit_logs').insert({
      actor_id: req.user.id,
      action: 'user:create',
      target_type: 'user',
      target_id: user.id,
      detail_json: { username, email, role },
      ip_address: req.ip,
    });

    return reply.code(201).send({ success: true, data: user });
  });

  // PATCH /api/admin/users/:id/status — aktif/pasif
  fastify.patch('/:id/status', async (req, reply) => {
    const { is_active } = req.body || {};
    if (typeof is_active !== 'boolean') {
      return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'is_active boolean olmalı.' } });
    }

    try {
      const user = await setUserStatus(parseInt(req.params.id, 10), is_active);

      // Audit log
      await knex('audit_logs').insert({
        actor_id: req.user.id,
        action: is_active ? 'user:activate' : 'user:deactivate',
        target_type: 'user',
        target_id: user.id,
        ip_address: req.ip,
      });

      // Hesap devre dışı bırakıldıysa → o kullanıcının socket'ini bul ve bildir
      if (!is_active) {
        const sockets = await io.fetchSockets();
        const targetSocket = sockets.find((s) => s.data?.user?.id === user.id);
        if (targetSocket) {
          targetSocket.emit('account:disabled');
          targetSocket.disconnect(true);
        }
      }

      return reply.send({ success: true, data: user });
    } catch (err) {
      if (err instanceof UserNotFoundError) return reply.code(404).send({ success: false, error: { code: err.code, message: err.message } });
      if (err instanceof ForbiddenError) return reply.code(403).send({ success: false, error: { code: err.code, message: err.message } });
      throw err;
    }
  });

  // POST /api/admin/users/csv-import — CSV'den toplu kullanıcı oluştur
  fastify.post('/csv-import', async (req, reply) => {
    const data = await req.file();
    if (!data) {
      return reply.code(400).send({ success: false, error: { code: 'NO_FILE', message: 'CSV dosyası gönderilmedi.' } });
    }

    const mime = data.mimetype;
    if (!mime.includes('csv') && !mime.includes('text/plain') && !mime.includes('octet-stream')) {
      return reply.code(400).send({ success: false, error: { code: 'INVALID_TYPE', message: 'Yalnızca CSV dosyası kabul edilir.' } });
    }

    // Dosya içeriğini oku (max 1 MB)
    const chunks = [];
    let total = 0;
    for await (const chunk of data.file) {
      total += chunk.length;
      if (total > 1_048_576) {
        return reply.code(413).send({ success: false, error: { code: 'FILE_TOO_LARGE', message: 'CSV dosyası 1 MB sınırını aşıyor.' } });
      }
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    let csvText;
    try {
      // Önce UTF-8 deniyoruz
      csvText = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch (e) {
      // UTF-8 başarısız olursa Windows-1254 (Türkçe) deniyoruz
      csvText = new TextDecoder('windows-1254').decode(buffer);
    }

    let rows;
    try {
      rows = parseCSV(csvText);
    } catch (err) {
      return reply.code(400).send({ success: false, error: { code: 'PARSE_ERROR', message: err.message } });
    }

    if (rows.length === 0) {
      return reply.code(400).send({ success: false, error: { code: 'EMPTY_CSV', message: 'CSV\'de veri satırı bulunamadı.' } });
    }
    if (rows.length > 500) {
      return reply.code(400).send({ success: false, error: { code: 'TOO_MANY_ROWS', message: 'Tek seferde en fazla 500 kullanıcı import edilebilir.' } });
    }

    const results = { created: 0, skipped: 0, errors: [] };

    for (const row of rows) {
      const { display_name, username, email, password, role: rawRole, _lineNumber } = row;

      // Zorunlu alan kontrolü
      if (!display_name || !username || !email || !password) {
        results.errors.push({ line: _lineNumber, username: username || '?', reason: 'Zorunlu alan eksik (display_name, username, email, password).' });
        results.skipped++;
        continue;
      }

      if (password.length < 8) {
        results.errors.push({ line: _lineNumber, username, reason: 'Şifre en az 8 karakter olmalı.' });
        results.skipped++;
        continue;
      }

      const role = ['admin', 'user'].includes(rawRole) ? rawRole : 'user';

      // E-posta format kontrolü
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        results.errors.push({ line: _lineNumber, username, reason: `Geçersiz e-posta: ${email}` });
        results.skipped++;
        continue;
      }

      // Benzersizlik kontrolü
      const existing = await knex('users')
        .where({ username: username.trim() })
        .orWhere({ email: email.trim().toLowerCase() })
        .first('id');

      if (existing) {
        results.errors.push({ line: _lineNumber, username, reason: 'Kullanıcı adı veya e-posta zaten kayıtlı.' });
        results.skipped++;
        continue;
      }

      try {
        const password_hash = await hashPassword(password);
        await knex('users').insert({
          username: username.trim(),
          email: email.trim().toLowerCase(),
          password_hash,
          display_name: display_name.trim(),
          role,
        });
        results.created++;
      } catch {
        results.errors.push({ line: _lineNumber, username, reason: 'Veritabanı hatası.' });
        results.skipped++;
      }
    }

    // Audit log
    await knex('audit_logs').insert({
      actor_id: req.user.id,
      action: 'user:csv_import',
      target_type: 'system',
      target_id: 0,
      detail_json: { total: rows.length, created: results.created, skipped: results.skipped },
      ip_address: req.ip,
    });

    return reply.code(201).send({ success: true, data: results });
  });

  // PATCH /api/admin/users/:id/password — şifre sıfırla
  fastify.patch('/:id/password', async (req, reply) => {
    const { new_password } = req.body || {};
    if (!new_password || new_password.length < 8) {
      return reply.code(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Şifre en az 8 karakter olmalı.' } });
    }

    try {
      await resetPassword(parseInt(req.params.id, 10), new_password);

      await knex('audit_logs').insert({
        actor_id: req.user.id,
        action: 'user:password_reset',
        target_type: 'user',
        target_id: parseInt(req.params.id, 10),
        ip_address: req.ip,
      });

      return reply.send({ success: true, data: { message: 'Şifre sıfırlandı.' } });
    } catch (err) {
      if (err instanceof UserNotFoundError) return reply.code(404).send({ success: false, error: { code: err.code, message: err.message } });
      throw err;
    }
  });
}
