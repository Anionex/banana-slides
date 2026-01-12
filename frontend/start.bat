@echo off
echo ====================================
echo 蕉幻 (Banana Slides) 前端启动脚本
echo ====================================
echo.

echo [1/3] 检查依赖...
if not exist "node_modules\" (
    echo 未检测到依赖，正在安装...
    call npm install
    if errorlevel 1 (
        echo 依赖安装失败，请手动运行: npm install
        pause
        exit /b 1
    )
) else (
    echo 依赖已存在
)

echo.
echo [2/3] 检查环境变量...
echo.
echo [3/3] 启动开发服务器...
echo 前端将运行在 http://localhost:3000
echo 请确保后端服务已启动在 http://localhost:5010
echo.
echo 按 Ctrl+C 可以停止服务器
echo.

call npm run dev

pause

