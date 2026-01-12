@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo ========================================
echo   Banana Slides Desktop Build Script
echo   Windows x64 Installer Builder
echo ========================================
echo.

:: 检查 Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found! Please install Node.js first.
    pause
    exit /b 1
)

:: 检查 Python
where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found! Please install Python first.
    pause
    exit /b 1
)

:: 检查 PyInstaller
python -c "import PyInstaller" >nul 2>&1
if errorlevel 1 (
    echo [WARN] PyInstaller not found, installing...
    pip install pyinstaller
)

set ROOT_DIR=%~dp0..
cd /d "%ROOT_DIR%"
echo Working directory: %CD%
echo.

:: ============================================
:: Step 1: 构建前端
:: ============================================
echo [1/5] Building frontend...
echo ----------------------------------------

cd frontend
call npm install
if errorlevel 1 (
    echo [ERROR] npm install failed!
    pause
    exit /b 1
)

call npm run build
if errorlevel 1 (
    echo [ERROR] Frontend build failed!
    pause
    exit /b 1
)
echo [OK] Frontend build completed.
echo.

cd ..

:: ============================================
:: Step 2: 打包后端
:: ============================================
echo [2/5] Packaging backend with PyInstaller...
echo ----------------------------------------

cd backend

:: 安装依赖
echo Installing Python dependencies...
pip install -r requirements.txt 2>nul || uv sync

:: 运行 PyInstaller（spec 文件在 desktop 目录）
pyinstaller ../desktop/banana-slides.spec --clean --noconfirm
if errorlevel 1 (
    echo [ERROR] Backend packaging failed!
    pause
    exit /b 1
)
echo [OK] Backend packaging completed.
echo.

cd ..

:: ============================================
:: Step 3: 创建资源目录
:: ============================================
echo [3/5] Preparing resources...
echo ----------------------------------------

:: 创建资源目录
if not exist "desktop\resources" mkdir "desktop\resources"

:: 检查图标文件
if not exist "desktop\resources\icon.ico" (
    echo [WARN] icon.ico not found in desktop\resources\
    echo        Using default icon...
    :: 可以在这里生成或复制默认图标
)

echo [OK] Resources prepared.
echo.

:: ============================================
:: Step 4: 复制文件到 desktop 目录
:: ============================================
echo [4/5] Copying build artifacts...
echo ----------------------------------------

:: 复制前端构建产物
if exist "desktop\frontend" rmdir /s /q "desktop\frontend"
xcopy /E /I /Y "frontend\dist" "desktop\frontend" >nul
echo   - Frontend copied to desktop\frontend\

:: 复制后端打包产物
if exist "desktop\backend" rmdir /s /q "desktop\backend"
xcopy /E /I /Y "backend\dist\banana-backend" "desktop\backend" >nul
echo   - Backend copied to desktop\backend\

echo [OK] Artifacts copied.
echo.

:: ============================================
:: Step 5: 构建 Electron 安装包
:: ============================================
echo [5/5] Building Electron installer...
echo ----------------------------------------

cd desktop

:: 安装 Electron 依赖
call npm install
if errorlevel 1 (
    echo [ERROR] npm install failed!
    pause
    exit /b 1
)

:: 构建安装包
call npm run build:electron
if errorlevel 1 (
    echo [ERROR] Electron build failed!
    pause
    exit /b 1
)

echo [OK] Electron installer created.
echo.

cd ..

:: ============================================
:: 完成
:: ============================================
echo ========================================
echo   BUILD COMPLETE!
echo ========================================
echo.
echo Output files:
echo   desktop\dist\BananaSlides-*-Setup.exe
echo.
echo You can now distribute this installer!
echo.

:: 打开输出目录
explorer "desktop\dist"

pause
