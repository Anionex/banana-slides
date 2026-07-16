!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "MUI2.nsh"
!include "nsDialogs.nsh"

!ifndef BUILD_UNINSTALLER

Var DataStorageRoot
Var DataStoragePathInput
Var DataStorageBrowseButton

; Use LCIDs because electron-builder includes this file before its language constants.
LangString DataStorageTitle 1033 "Data storage location"
LangString DataStorageTitle 2052 "数据存储位置"
LangString DataStorageSubtitle 1033 "Choose where projects and generated files are stored."
LangString DataStorageSubtitle 2052 "选择项目和生成文件的存储位置。"
LangString DataStorageDescription 1033 "Banana Slides stores projects, generated images, uploaded files, and export cache in this folder. You can change it later in Settings."
LangString DataStorageDescription 2052 "Banana Slides 会在此文件夹保存项目、生成图片、上传文件和导出缓存。安装后也可在设置中修改。"
LangString DataStorageBrowse 1033 "Browse..."
LangString DataStorageBrowse 2052 "浏览..."
LangString DataStorageBrowsePrompt 1033 "Select the Banana Slides data storage location"
LangString DataStorageBrowsePrompt 2052 "选择 Banana Slides 数据存储位置"
LangString DataStorageInvalid 1033 "The selected folder could not be created or is not writable. Choose another data storage location."
LangString DataStorageInvalid 2052 "无法创建所选文件夹或该文件夹不可写。请选择其他数据存储位置。"

!macro customPageAfterChangeDir
  !insertmacro DataStoragePageDefinitions
  Page custom DataStoragePageCreate DataStoragePageLeave
!macroend

!macro customInit
  StrCpy $DataStorageRoot "$APPDATA\Banana Slides"

  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "/DATA_ROOT=" $R1
  ${IfNot} ${Errors}
  ${AndIf} $R1 != ""
    StrCpy $DataStorageRoot $R1
  ${EndIf}

  ${IfNot} ${isUpdated}
  ${AndIf} ${Silent}
    Call ValidateDataStorageRoot
    Pop $R0
    ${If} $R0 != "1"
      SetErrorLevel 2
      Quit
    ${EndIf}
  ${EndIf}
!macroend

!macro customInstall
  ${IfNot} ${isUpdated}
    CreateDirectory "$APPDATA\Banana Slides"
    ClearErrors
    FileOpen $R0 "$APPDATA\Banana Slides\installer-data-root.txt" w
    ${If} ${Errors}
      SetErrorLevel 2
      Abort "$(DataStorageInvalid)"
    ${EndIf}
    FileWriteWord $R0 0xFEFF
    FileWriteUTF16LE $R0 "$DataStorageRoot"
    FileClose $R0
  ${EndIf}
!macroend

!macro DataStoragePageDefinitions

Function ValidateDataStorageRoot
  ${If} $DataStorageRoot == ""
    Push "0"
    Return
  ${EndIf}

  GetFullPathName $DataStorageRoot "$DataStorageRoot"
  StrCpy $R0 $DataStorageRoot 2
  ${If} $R0 == "\\"
    Push "0"
    Return
  ${EndIf}
  ClearErrors
  CreateDirectory "$DataStorageRoot"
  ${If} ${Errors}
    Push "0"
    Return
  ${EndIf}

  ClearErrors
  GetTempFileName $R0 "$DataStorageRoot"
  ${If} ${Errors}
    Push "0"
    Return
  ${EndIf}
  Delete "$R0"
  ${If} ${Errors}
    Push "0"
    Return
  ${EndIf}

  Push "1"
FunctionEnd

Function DataStoragePageCreate
  ${If} ${isUpdated}
    Abort
  ${EndIf}
  ${If} ${Silent}
    Abort
  ${EndIf}

  !insertmacro MUI_HEADER_TEXT "$(DataStorageTitle)" "$(DataStorageSubtitle)"
  nsDialogs::Create 1018
  Pop $R0
  ${If} $R0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 4u 100% 35u "$(DataStorageDescription)"
  Pop $R0
  ${NSD_CreateDirRequest} 0 48u 76% 13u "$DataStorageRoot"
  Pop $DataStoragePathInput
  ${NSD_CreateBrowseButton} 78% 47u 22% 15u "$(DataStorageBrowse)"
  Pop $DataStorageBrowseButton
  ${NSD_OnClick} $DataStorageBrowseButton DataStorageBrowseClicked

  nsDialogs::Show
FunctionEnd

Function DataStorageBrowseClicked
  ${NSD_GetText} $DataStoragePathInput $DataStorageRoot
  nsDialogs::SelectFolderDialog "$(DataStorageBrowsePrompt)" "$DataStorageRoot"
  Pop $R0
  ${If} $R0 != error
    StrCpy $DataStorageRoot $R0
    ${NSD_SetText} $DataStoragePathInput "$DataStorageRoot"
  ${EndIf}
FunctionEnd

Function DataStoragePageLeave
  ${NSD_GetText} $DataStoragePathInput $DataStorageRoot
  Call ValidateDataStorageRoot
  Pop $R0
  ${If} $R0 != "1"
    MessageBox MB_OK|MB_ICONEXCLAMATION "$(DataStorageInvalid)"
    Abort
  ${EndIf}
FunctionEnd

!macroend

!endif
