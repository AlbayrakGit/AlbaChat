import fp from 'fastify-plugin';
import multipart from '@fastify/multipart';

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10) * 1024 * 1024;

export default fp(async function multipartPlugin(fastify) {
  await fastify.register(multipart, {
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: 10,
      fields: 20,
    },
  });
});
