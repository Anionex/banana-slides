# 图标资源目录

请将以下图标文件放置到此目录：

## 必需文件

1. **icon.ico** - 应用图标
   - 尺寸要求：256x256 像素（包含多尺寸：16, 32, 48, 64, 128, 256）
   - 用于：应用程序图标、任务栏图标、系统托盘图标

## 可选文件

2. **installer-sidebar.bmp** - 安装程序侧边栏图片
   - 尺寸：164x314 像素
   - 用于：NSIS 安装向导侧边栏

## 生成图标

如果你有 PNG 格式的 logo，可以使用以下工具生成 ICO：

### 在线工具

- https://convertio.co/png-ico/
- https://icoconvert.com/

### 使用 ImageMagick

```bash
magick convert logo.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

## 推荐的图标

可以使用项目的 🍌 emoji 或 `assets/` 目录中的 logo 图片作为基础制作图标。
