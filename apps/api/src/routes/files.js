import { authenticate } from '../middleware/authenticate.js';
import {
  uploadFile,
  getFileUrl,
  deleteFile,
  FileTooLargeError,
  FileTypeNotAllowedError,
  FileNotFoundError,
  FileForbiddenError,
} from '../services/fileService.js';

function handleError(err, reply) {
  if (err instanceof FileTooLargeError)
    return reply.code(413).send({ success: false, error: { code: err.code, message: err.message } });
  if (err instanceof FileTypeNotAllowedError)
    return reply.code(415).send({ success: false, error: { code: err.code, message: err.message } });
  if (err instanceof FileNotFoundError)
    return reply.code(404).send({ success: false, error: { code: err.code, message: err.message } });
  if (err instanceof FileForbiddenError)
    return reply.code(403).send({ success: false, error: { code: err.code, message: err.message } });
  throw err;
}

const uploadRateLimitOpts = {
  config: {
    rateLimit: { max: 10, timeWindow: '1 minute' },
  },
};

export default async function fileRoutes(fastify) {
  // POST /api/files/upload — dosya yükle (multipart/form-data)
  // Header: X-Group-Id: <groupId>
  fastify.post('/upload', { preHandler: [authenticate], ...uploadRateLimitOpts }, async (req, reply) => {
    const groupId = parseInt(req.headers['x-group-id'], 10);
    if (!groupId || isNaN(groupId)) {
      return reply.code(400).send({
        success: false,
        error: { code: 'MISSING_GROUP', message: 'X-Group-Id header zorunlu.' },
      });
    }

    let data;
    try {
      data = await req.file();
    } catch {
      return reply.code(400).send({
        success: false,
        error: { code: 'NO_FILE', message: 'Dosya bulunamadı.' },
      });
    }

    if (!data) {
      return reply.code(400).send({
        success: false,
        error: { code: 'NO_FILE', message: 'Dosya bulunamadı.' },
      });
    }

    try {
      const buffer = await data.toBuffer();
      const file = await uploadFile({
        buffer,
        originalName: data.filename || 'dosya',
        mimeType: data.mimetype,
        uploadedBy: req.user.id,
        groupId,
      });
      return reply.code(201).send({ success: true, data: file });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // GET /api/files/:id/url — presigned URL'yi JSON olarak döndür
  fastify.get('/:id/url', { preHandler: [authenticate] }, async (req, reply) => {
    try {
      const { url, downloadUrl, file } = await getFileUrl(parseInt(req.params.id, 10), req.user.id);
      return reply.send({
        success: true,
        data: {
          url,
          downloadUrl,
          file: {
            id: file.id,
            original_name: file.original_name,
            mime_type: file.mime_type,
            size_bytes: file.size_bytes,
          },
        },
      });
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // GET /api/files/:id — presigned URL'ye yönlendir (302)
  fastify.get('/:id', { preHandler: [authenticate] }, async (req, reply) => {
    try {
      const { url } = await getFileUrl(parseInt(req.params.id, 10), req.user.id);
      return reply.redirect(url);
    } catch (err) {
      return handleError(err, reply);
    }
  });

  // DELETE /api/files/:id — soft delete
  fastify.delete('/:id', { preHandler: [authenticate] }, async (req, reply) => {
    try {
      const result = await deleteFile(
        parseInt(req.params.id, 10),
        req.user.id,
        req.user.role,
      );
      return reply.send({ success: true, data: result });
    } catch (err) {
      return handleError(err, reply);
    }
  });
}
