import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';

export default fp(async function helmetPlugin(fastify) {
  await fastify.register(helmet, {
    // Tarayıcının MIME sniffing yapmasını engelle
    noSniff: true,
    // Clickjacking koruması
    frameguard: { action: 'deny' },
    // HTTPS zorunlu kılma (prod'da)
    hsts: process.env.NODE_ENV === 'production'
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    // XSS filtresi (eski tarayıcılar için)
    xssFilter: true,
    // Referrer bilgisini kısıtla
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // İçerik Güvenlik Politikası
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind inline style gerektirebilir
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: [
          "'self'",
          // Socket.IO ve API
          ...(process.env.NODE_ENV === 'production' ? [] : ['ws://localhost:*', 'http://localhost:*']),
        ],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        workerSrc: ["'self'", 'blob:'], // Service Worker için
        manifestSrc: ["'self'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
      // Eski tarayıcı uyumluluğu için rapor yalnızca modunda başla
      reportOnly: process.env.NODE_ENV !== 'production',
    },
    // CORP — cross-origin kaynak izolasyonu
    crossOriginEmbedderPolicy: false, // MinIO presigned URL'leri için gerekli
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
});
