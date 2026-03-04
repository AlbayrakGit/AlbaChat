import { authenticate, requireAdmin } from '../../middleware/authenticate.js';
import { getAllSettings, updateSettings, NGINX_RELOAD_KEYS, NGINX_RESTART_KEYS } from '../../services/settingsService.js';
import { reloadNginxConfig } from '../../services/nginxService.js';
import { knex } from '../../db/knex.js';

export default async function adminSettingsRoutes(fastify) {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', requireAdmin);

  // GET /api/admin/settings
  fastify.get('/', async (req, reply) => {
    const settings = await getAllSettings();
    return reply.send({ success: true, data: settings });
  });

  // PATCH /api/admin/settings
  fastify.patch('/', async (req, reply) => {
    const changes = req.body || {};
    const updated = await updateSettings(changes, req.user.id);

    // Hangi nginx etkili anahtarlar değişti?
    const changedKeys = Object.keys(changes);
    const needsReload = changedKeys.some((k) => NGINX_RELOAD_KEYS.includes(k));
    const needsRestart = changedKeys.some((k) => NGINX_RESTART_KEYS.includes(k));

    let nginxStatus = null;
    if (needsReload) {
      nginxStatus = await reloadNginxConfig(updated);
    }

    // Audit log
    await knex('audit_logs').insert({
      actor_id: req.user.id,
      action: 'settings:update',
      target_type: 'system',
      target_id: 0,
      detail_json: { changes: req.body, nginx_reload: needsReload, nginx_restart_required: needsRestart },
      ip_address: req.ip,
    });

    return reply.send({
      success: true,
      data: updated,
      meta: {
        nginx_reloaded: needsReload && nginxStatus?.success === true,
        nginx_restart_required: needsRestart,
        nginx_error: nginxStatus?.success === false && !nginxStatus?.devMode ? nginxStatus.error : undefined,
      },
    });
  });
}
