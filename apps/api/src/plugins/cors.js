import fp from 'fastify-plugin';
import cors from '@fastify/cors';

export default fp(async function corsPlugin(fastify) {
  await fastify.register(cors, {
    origin: process.env.NODE_ENV === 'production'
      ? false
      : ['http://localhost:5173', 'http://localhost:8080'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
});
