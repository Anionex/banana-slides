# 图标资源目录

请将以下图标文件放置到此目录：

## 必需文件

1. **icon.ico** - Windows 应用图标
   - 尺寸要求：256x256 像素（包含多尺寸：16, 32, 48, 64, 128, 256）
   - 用于：应用程序图标、任务栏图标、系统托盘图标

2. **icon.icns** - macOS 应用图标
   - 用于：macOS 应用程序图标
   - 可从 icon.png 自动生成（见下方说明）

3. **icon.png** - 通用 PNG 图标（推荐 1024x1024）
   - 用于：Linux 应用图标、生成其他格式

## 可选文件

- **installer-sidebar.bmp** - 安装程序侧边栏图片
  - 尺寸：164x314 像素
  - 用于：NSIS 安装向导侧边栏

## 生成图标

### 从 PNG 生成 ICO (Windows)

```bash
# 使用 ImageMagick
magick convert logo.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

### 从 PNG 生成 ICNS (macOS)

```bash
# 在 macOS 上
mkdir icon.iconset
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o icon.icns
rm -rf icon.iconset
```

> **注意**: GitHub Actions 工作流会自动从 icon.png 生成 icon.icns（如果不存在）

### 在线工具

- <https://convertio.co/png-ico/>
- <https://cloudconvert.com/png-to-icns>

## 推荐的图标

可以使用项目的 🍌 emoji 或 `assets/` 目录中的 logo 图片作为基础制作图标。
