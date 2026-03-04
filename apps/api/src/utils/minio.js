import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';

const ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
const PORT = parseInt(process.env.MINIO_PORT || '9000', 10);
const USE_SSL = process.env.MINIO_USE_SSL === 'true';

export const BUCKET = process.env.MINIO_BUCKET || 'albachat-files';

export const s3Client = new S3Client({
  endpoint: `${USE_SSL ? 'https' : 'http'}://${ENDPOINT}:${PORT}`,
  region: 'us-east-1', // MinIO bölge umursamaz
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER || 'minioadmin',
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD || 'minio_secret',
  },
  forcePathStyle: true, // MinIO için zorunlu
});

/**
 * Üretilen iç IP/hostname içeren URL'leri dışarıdan erişilebilir hale çevirir.
 */
export function transformUrl(url) {
  const publicUrl = process.env.MINIO_PUBLIC_URL;
  if (!publicUrl) return url;

  const internalPart = `${USE_SSL ? 'https' : 'http'}://${ENDPOINT}:${PORT}`;
  return url.replace(internalPart, publicUrl);
}

/**
 * Başlangıçta bucket yoksa oluştur.
 * server.js start() içinde çağrılır.
 */
export async function ensureBucket() {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET }));
    console.log(`[MinIO] Bucket mevcut: ${BUCKET}`);
  } catch {
    try {
      await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET }));
      console.log(`[MinIO] Bucket oluşturuldu: ${BUCKET}`);
    } catch (err) {
      console.error('[MinIO] Bucket oluşturulamadı:', err.message);
    }
  }
}
