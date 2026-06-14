; NSIS Script personalizado para PegasusAI
; Adiciona funcionalidades extras ao instalador do Windows

!include "MUI2.nsh"

; Definições de nome e versão
!define PRODUCT_NAME "PegasusAI"
!define PRODUCT_VERSION "0.1.0"
!define COMPANY_NAME "PegasusAI Committee"

; Configurações gerais
Name "${PRODUCT_NAME}"
OutFile "${PRODUCT_NAME}-${PRODUCT_VERSION}-Setup.exe"
InstallDir "$PROGRAMFILES64\${PRODUCT_NAME}"
RequestExecutionLevel admin

; Páginas do instalador
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; Idioma
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "PortugueseBR"

; Seção de instalação principal
Section "PegasusAI (Required)" SecMain
    SetOutPath "$INSTDIR"
    
    ; Copiar arquivos principais
    File /r "..\out\*.*"
    File /r "..\resources\*.*"
    
    ; Criar atalho na área de trabalho
    CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
    CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\PegasusAI.exe" "" "$INSTDIR\PegasusAI.exe" 0
    CreateShortCut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\PegasusAI.exe" "" "$INSTDIR\PegasusAI.exe" 0
    
    ; Registrar desinstalador
    WriteUninstaller "$INSTDIR\uninstall.exe"
    
    ; Adicionar entrada em Programas e Recursos
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" \
        "DisplayName" "${PRODUCT_NAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" \
        "DisplayVersion" "${PRODUCT_VERSION}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" \
        "Publisher" "${COMPANY_NAME}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" \
        "UninstallString" '"$INSTDIR\uninstall.exe"'
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}" \
        "QuietUninstallString" '"$INSTDIR\uninstall.exe" /S'
SectionEnd

; Seção opcional: Adicionar ao PATH
Section "Adicionar ao PATH (Opcional)" SecPath
    Push "$INSTDIR"
    Call AddToPath
SectionEnd

; Função para adicionar ao PATH
Function AddToPath
    Exch $R0
    Push $R1
    Push $R2
    Push $R3
    
    ReadRegStr $R1 HKLM "SYSTEM\CurrentControlSet\Control\Session Manager\Environment" "PATH"
    StrCpy $R2 $R1 1
    StrCmp $R2 ";" +2
    StrCpy $R1 "$R1;"
    
    ; Verificar se já está no PATH
    Push $R1
    Push "$R0;"
    Call StrContains
    Pop $R3
    StrCmp $R3 "" +3
    Pop $R3
    Goto Done
    
    ; Adicionar ao PATH
    WriteRegExpandStr HKLM "SYSTEM\CurrentControlSet\Control\Session Manager\Environment" "PATH" "$R1$R0;"
    
    ; Notificar mudança de ambiente
    SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
    
Done:
    Pop $R3
    Pop $R2
    Pop $R1
    Pop $R0
FunctionEnd

; Função StrContains (encontrar substring)
Function StrContains
    Exch $R0
    Exch
    Exch $R1
    Push $R2
    Push $R3
    Push $R4
    Push $R5
    
    StrLen $R2 $R0
    StrLen $R3 $R1
    IntOp $R3 $R3 - $R2
    
    StrCpy $R4 0
    StrCpy $R5 ""
    
Loop:
    IntOp $R4 $R4 + 1
    StrCpy $R5 $R1 $R2 $R4
    StrCmp $R5 $R0 Found
    StrCmp $R4 $R3 Done
    Goto Loop
    
Found:
    StrCpy $R0 $R1
    Goto Done2
    
Done:
    StrCpy $R0 ""
    
Done2:
    Pop $R5
    Pop $R4
    Pop $R3
    Pop $R2
    Pop $R1
    Exch $R0
FunctionEnd

; Seção de desinstalação
Section "Uninstall"
    ; Remover diretório de instalação
    RMDir /r "$INSTDIR"
    
    ; Remover atalhos
    Delete "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk"
    RMDir "$SMPROGRAMS\${PRODUCT_NAME}"
    Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
    
    ; Remover registro
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
    
    ; Remover do PATH (se adicionado)
    ; Nota: Implementação simplificada - requer lógica adicional para remoção segura do PATH
    
    MessageBox MB_OK "PegasusAI foi desinstalado com sucesso."
SectionEnd

; Mensagens personalizadas
LangString DESC_SecMain ${LANG_PORTUGUESEBR} "Instala o núcleo do PegasusAI IDE."
LangString DESC_SecPath ${LANG_PORTUGUESEBR} "Adiciona o PegasusAI ao PATH do sistema para acesso via linha de comando."

; Descrições das seções
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
    !insertmacro MUI_DESCRIPTION_TEXT ${SecMain} $(DESC_SecMain)
    !insertmacro MUI_DESCRIPTION_TEXT ${SecPath} $(DESC_SecPath)
!insertmacro MUI_FUNCTION_DESCRIPTION_END
