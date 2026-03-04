# Desktop Assets

Bu klasöre aşağıdaki ikon dosyaları yerleştirilmelidir:

| Dosya | Boyut | Kullanım |
|---|---|---|
| `icon.png` | 512×512 | Uygulama ikonu (genel) |
| `icon.ico` | multi-size (16/32/48/256) | Windows .exe ikonu |
| `installer.ico` | multi-size | NSIS installer ikonu |
| `tray-icon.png` | 32×32 (veya 16×16) | Sistem tepsisi |
| `badge.png` | 16×16 | Görev çubuğu overlay (okunmamış badge) |

## Hızlı İkon Oluşturma

ImageMagick ile PNG → ICO dönüşümü:
```bash
magick icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

## Tray Arka Planı

Windows karanlık mod tray için `tray-icon-dark.png` de eklenebilir.
Electron, `Tray` nesnesine `nativeImage.createFromPath()` ile yüklenir.
