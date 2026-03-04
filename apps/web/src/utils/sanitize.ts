/**
 * DOMPurify tabanlı içerik sanitasyon yardımcısı.
 * Kullanıcıdan gelen metin içerikleri, dangerouslySetInnerHTML veya
 * başka bir HTML rendering yolunda kullanılmadan önce bu fonksiyondan geçirilmeli.
 *
 * React'in varsayılan metin interpolasyonu ({value}) XSS-güvenlidir,
 * ancak defense-in-depth için kritik alanlarda sanitize edilir.
 */
import DOMPurify from 'dompurify';

/** Tüm HTML etiketlerini kaldır, sadece düz metin bırak */
export function sanitizeText(input: string): string {
  if (!input) return '';
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

/** Güvenli HTML — yalnızca temel biçimlendirme etiketlerine izin ver */
export function sanitizeHtml(input: string): string {
  if (!input) return '';
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'p', 'span', 'a'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ADD_ATTR: ['rel'], // href ile gelen a etiketlerine rel="noopener" ekle
    FORCE_BODY: true,
  });
}
