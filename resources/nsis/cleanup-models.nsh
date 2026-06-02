!macro customHeader
  ManifestDPIAware true
!macroend

!macro customUnInstall
  ${ifNot} ${isUpdated}
    StrCpy $0 "$PROFILE\.cache\openmur\models"
    IfFileExists "$0\*.*" 0 +3
      RMDir /r "$0"
      DetailPrint "Removed openMur cached models"
    StrCpy $1 "$PROFILE\.cache\openmur"
    RMDir "$1"
  ${endIf}
!macroend
