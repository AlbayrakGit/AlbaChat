# PWA Ikon Dosyaları

Bu klasöre aşağıdaki PNG ikon dosyaları yerleştirilmelidir.

| Dosya | Boyut | Kullanım |
|---|---|---|
| `icon-16.png` | 16×16 | Favicon |
| `icon-32.png` | 32×32 | Favicon |
| `icon-72.png` | 72×72 | PWA (Android eski) |
| `icon-96.png` | 96×96 | PWA |
| `icon-128.png` | 128×128 | PWA |
| `icon-144.png` | 144×144 | PWA (Android) |
| `icon-152.png` | 152×152 | PWA (iOS) |
| `icon-192.png` | 192×192 | PWA (manifest zorunlu) |
| `icon-384.png` | 384×384 | PWA |
| `icon-512.png` | 512×512 | PWA (manifest zorunlu) |
| `apple-touch-icon.png` | 180×180 | iOS "Ana Ekrana Ekle" |

## ImageMagick ile Oluşturma

Kaynak `icon-512.png` varsa:

```bash
# Tüm boyutları üret
for size in 16 32 72 96 128 144 152 192 384 512; do
  magick icon-512.png -resize ${size}x${size} icon-${size}.png
done
magick icon-512.png -resize 180x180 apple-touch-icon.png
```

## Maskable İkon

`icon-512.png` maskelenebilir (maskable) ikon olarak da kullanılmaktadır.
Maskable ikonlarda içerik merkezde, kenarlarda güvenli boşluk (safe zone) bırakın.
Referans: https://maskable.app/editor
