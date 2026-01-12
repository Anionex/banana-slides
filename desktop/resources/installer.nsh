; Banana Slides NSIS Installer Script
; 自定义安装脚本，用于处理升级时的特殊逻辑

!macro customInstall
  ; 安装完成后的自定义操作
  ; 这里可以添加任何需要在安装后执行的操作
!macroend

!macro customUnInstall
  ; 卸载时的自定义操作
  ; 注意：用户数据保留在 %APPDATA%\Banana Slides 中
!macroend

; 预安装检查 - 关闭正在运行的应用
!macro preInit
  ; 检查并关闭正在运行的 Banana Slides
  nsExec::ExecToStack 'taskkill /F /IM "Banana Slides.exe" /T'
  Pop $0
  ; 等待进程完全退出
  Sleep 1000
!macroend

!macro customHeader
  ; 可以在这里添加自定义的安装程序头部
!macroend
