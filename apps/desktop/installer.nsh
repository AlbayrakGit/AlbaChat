!macro customInit
  ; Kurulum dizinini C:\AlbaChat olarak zorla
  StrCpy $INSTDIR "C:\AlbaChat"
!macroend

!macro customInstall
  ; AlbaChat.ico dosyasini kurulum dizinine kopyala (kisayol ikonu icin)
  CopyFiles /SILENT "$INSTDIR\resources\assets\AlbaChat.ico" "$INSTDIR\AlbaChat.ico"
  ; Masaustu kisayolunun ikonunu AlbaChat.ico olarak guncelle
  CreateShortCut "$DESKTOP\AlbaChat.lnk" "$INSTDIR\AlbaChat.exe" "" "$INSTDIR\AlbaChat.ico" 0
  ; Uygulama klasorune Uninstall kisayolu olustur
  CreateShortCut "$INSTDIR\AlbaChat Kaldır.lnk" "$INSTDIR\Uninstall AlbaChat.exe" "" "$INSTDIR\Uninstall AlbaChat.exe" 0
!macroend

!macro customUnInstall
  ; Uninstall kisayolunu temizle
  Delete "$INSTDIR\AlbaChat Kaldır.lnk"
!macroend
