!macro customInit
  ; Kurulum dizinini C:\AlbaChat olarak zorla
  StrCpy $INSTDIR "C:\AlbaChat"
!macroend

!macro customInstall
  ; Uygulama klasorune Uninstall kisayolu olustur
  CreateShortCut "$INSTDIR\AlbaChat Kaldır.lnk" "$INSTDIR\Uninstall AlbaChat.exe" "" "$INSTDIR\Uninstall AlbaChat.exe" 0
!macroend

!macro customUnInstall
  ; Uninstall kisayolunu temizle
  Delete "$INSTDIR\AlbaChat Kaldır.lnk"
!macroend
