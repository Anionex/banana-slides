import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles, FileText, FileEdit, ImagePlus, Paperclip, Palette, Lightbulb, Search, Settings, FolderOpen, HelpCircle, Sun, Moon, Globe, Monitor, ChevronDown } from 'lucide-react';
import { Button, Textarea, Card, useToast, MaterialGeneratorModal, MaterialCenterModal, ReferenceFileList, ReferenceFileSelector, FilePreviewModal, HelpModal, Footer, GithubRepoCard } from '@/components/shared';
import { MarkdownTextarea, type MarkdownTextareaRef } from '@/components/shared/MarkdownTextarea';
import { TemplateSelector, getTemplateFile } from '@/components/shared/TemplateSelector';
import { listUserTemplates, type UserTemplate, uploadReferenceFile, type ReferenceFile, associateFileToProject, triggerFileParse, associateMaterialsToProject, listProjects } from '@/api/endpoints';
import { useProjectStore } from '@/store/useProjectStore';
import { useTheme } from '@/hooks/useTheme';
import { useImagePaste } from '@/hooks/useImagePaste';
import { useT } from '@/hooks/useT';
import { PRESET_STYLES } from '@/config/presetStyles';

type CreationType = 'idea' | 'outline' | 'description';

// 页面特有翻译 - AI 可以直接看到所有文案，保留原始 key 结构
const homeI18n = {
  zh: {
    nav: {
      materialGenerate: '素材生成', materialCenter: '素材中心',
      history: '历史项目', settings: '设置', help: '帮助'
    },
    settings: {
      language: { label: '界面语言' },
      theme: { label: '主题模式', light: '浅色', dark: '深色', system: '跟随系统' }
    },
    presetStyles: {
      businessSimple: {
        name: '简约商务',
        description: '视觉描述：全局视觉语言应体现国际顶级咨询公司（如麦肯锡或波士顿咨询）的专业与稳重。整体风格追求极致的扁平化与秩序感，拒绝多余的装饰，强调信息的清晰传达。光照环境应为均匀的演播室漫射光，无明显的戏剧性阴影，确保画面干净透亮。\n\n配色与材质：背景色必须锁定为深沉、权威的"海军蓝"（Navy Blue, #0B1F3B），前景元素则使用纯白（#FFFFFF）和微量的天蓝色（Sky Blue, #38BDF8）作为点缀；材质上避免复杂的纹理，采用哑光纸张质感或平滑的矢量色块。\n\n内容与排版：排版逻辑遵循严格的模块化网格系统。请生成清晰的几何分区，使用细线条或微弱的浅灰色色块（Light Gray, #E5E7EB）来划分内容区域。字体方面，应用粗壮有力的无衬线字体（如Helvetica或Roboto）作为标题，正文保持纤细清晰。图表元素应为扁平化的2D矢量图形，如简洁的柱状图或饼图，配色单一且克制。\n\n渲染要求：矢量插画风格，极高清晰度，无论是文字还是图形边缘都要锐利无锯齿，展现出严谨的商务美学，适合世界500强企业汇报场景。',
      },
      techModern: {
        name: '现代科技',
        description: '视觉描述：全局视觉语言要融合赛博朋克与现代SaaS产品的未来感。整体氛围神秘、深邃且富有动感，仿佛置身于高科技的数据中心或虚拟空间。光照采用暗调环境下的自发光效果，模拟霓虹灯管和激光的辉光。\n\n配色与材质：背景色采用深邃的"午夜黑"（Midnight Black, #0B0F19），以衬托前景的亮度。主色调使用高饱和度的"电光蓝"（Electric Blue, #00A3FF）与"赛博紫"（Cyber Purple, #7C3AED）进行线性渐变，营造出流动的能量感。材质上大量运用半透明的玻璃、发光的网格线以及带有金属光泽的几何体。\n\n内容与排版：画面中应包含悬浮的3D几何元素（如立方体、四面体或芯片结构），这些元素应带有线框渲染（Wireframe）效果。排版布局倾向于不对称的动态平衡，使用具有科技感的等宽字体或现代无衬线体。背景中可以隐约添加电路板纹理、二进制代码流或点阵地图作为装饰，增加细节密度。\n\n渲染要求：Octane Render渲染风格，强调光线追踪、辉光（Bloom）效果和景深控制，呈现出精细的粒子特效和充满科技张力的视觉冲击力。',
      },
      academicFormal: {
        name: '严谨学术',
        description: '视觉描述：全局视觉语言应模仿高质量印刷出版物或经典论文的排版风格，传达理性、客观和知识的厚重感。整体氛围安静、克制，没有任何干扰视线的炫光或过度设计。画面必须铺满全屏，严禁出现书本装订线、纸张边缘、卷角、阴影或任何形式的边框。背景不应该呈现三维立体，而应该以二维平面方式呈现。\n\n配色与材质：背景色严格限制为"米白色"（Off-white, #F8F7F2），模拟高级道林纸的质感。前景色仅使用纯黑（#000000）、深炭灰（Charcoal, #1F2937）和作为强调色的深红（Deep Red, #7F1D1D）或深蓝（Deep Blue, #1E3A8A）（这种强调色占比不超过5%）。材质完全呈现为高质量的纸质印刷效果，具有细腻的纸张纹理。\n\n内容与排版：排版必须遵循经典的版式设计原则，拥有宽阔的页边距。请使用带有衬线的字体（类似Times New Roman或Garamond）来体现传统与正式。视觉元素主要由精细的黑色线条框（Black, #000000）、标准的学术表格样式和黑白线稿插图（Black, #000000 / White, #FFFFFF）组成。布局上采用左右分栏或上下结构的严谨对齐方式。\n\n渲染要求：超高分辨率扫描件风格，强调字体的灰度抗锯齿效果和线条的锐度，画面如同精装学术期刊的内页，展现出绝对的专业性与权威性。不应该存在任何形式的页面边框，比如黑色边框或者阴影边线。',
      },
      creativeFun: {
        name: '活泼创意',
        description: '视觉描述：全局视觉语言要像一个充满活力的初创公司Pitch Deck或儿童教育应用界面。整体氛围轻松、愉悦、充满想象力，打破常规的束缚。光照明亮且充满阳光感，色彩之间没有阴影，呈现彻底的扁平化。\n\n配色与材质：背景色使用高明度的"暖黄色"（Warm Yellow, #FFD54A）。配色方案极其大胆，混合使用鲜艳的"活力橙"（Vibrant Orange, #FF6A00）、"草绿"（Grass Green, #22C55E）和"天蓝"（Sky Blue, #38BDF8），形成孟菲斯（Memphis）风格的撞色效果。材质上模拟手绘涂鸦、剪纸或粗糙边缘的矢量插画。\n\n内容与排版：画面内容应包含手绘风格的插图元素，如涂鸦箭头、星星、波浪线和不规则的有机形状色块。排版上允许文字倾斜、重叠或跳跃，打破僵硬的网格。字体选用圆润可爱的圆体或手写体。请在角落放置一些拟人化的可爱物体或夸张的对话气泡。\n\n渲染要求：Dribbble热门插画风格，色彩鲜艳平涂，线条流畅且富有弹性，视觉上给人一种快乐、友好且极具亲和力的感觉。',
      },
      minimalistClean: {
        name: '极简清爽',
        description: '视觉描述：全局视觉语言借鉴北欧设计（Scandinavian Design）和Kinfolk杂志的审美。整体氛围空灵、静谧，强调"少即是多"的哲学。光照采用极柔和的漫反射天光，阴影非常淡且边缘模糊，营造出空气感。\n\n配色与材质：背景色为极浅的"雾霾灰"（Haze Gray, #F5F5F7）。前景色仅使用中灰色（Mid Gray, #6B7280）和低饱和度的莫兰迪色系（如灰蓝（Morandi Gray Blue, #7A8FA6））作为微小的点缀。材质上体现细腻的哑光质感，偶尔出现一点点石膏（Plaster）的微纹理。\n\n内容与排版：构图的核心是"留白"（Negative Space），留白面积应占据画面的70%以上。排版极为克制，文字字号较小，行间距宽大，使用纤细优雅的非衬线字体。视觉锚点是简单的几何线条构成的图标，布局上追求绝对的平衡。\n\n渲染要求：极简主义摄影风格，高动态范围（HDR），画面极其干净，没有任何噪点，展现出一种画廊般的艺术陈列感。',
      },
      luxuryPremium: {
        name: '高端奢华',
        description: '视觉描述：全局视觉语言要融合高端腕表广告或五星级酒店的品牌形象。整体氛围神秘、高贵、独一无二。光照采用戏剧性的伦勃朗光或聚光灯效果，重点照亮关键元素，其余部分隐没在黑暗中。\n\n配色与材质：背景色严格锁定为深沉的"曜石黑"（Obsidian Black, #0B0B0F）。前景色主要由"香槟金"（Champagne Gold, #F7E7CE）构成。材质上必须体现昂贵的触感，核心组合为：背景呈现哑光黑天鹅绒质感，前景装饰呈现拉丝金属质感。\n\n内容与排版：排版采用经典的居中对齐或对称布局，强调仪式感。字体必须使用高雅的衬线体（Serif），字间距适当加宽以体现尊贵。画面中可以加入细致的金色边框线条、Art Deco风格的装饰纹样。如果有3D物体，应呈现出珠宝般的抛光质感。\n\n渲染要求：电影级写实渲染，强调材质的物理属性（PBR），特别是金属的高光反射和丝绒的漫反射细节，画面呈现出奢侈品广告大片的高级质感。',
      },
      natureFresh: {
        name: '自然清新',
        description: '视觉描述：全局视觉语言旨在唤起人们对大自然、环保和健康生活的向往，类似全食超市（Whole Foods）或Aesop的品牌视觉。整体氛围治愈、透气、有机。光照模拟清晨穿过树叶的斑驳阳光（丁达尔效应），温暖而柔和。\n\n配色与材质：背景色采用柔和的"米色"（Beige, #EAD9C6）。配色方案取自自然界，重点使用森林绿（Forest Green, #14532D）和大地棕（Earth Brown, #7A4E2D）。材质上强调天然纹理，如再生纸的颗粒感和植物叶片的脉络。\n\n内容与排版：画面中应融合真实的自然元素，主要是伸展的绿植叶片，这些元素可以作为背景装饰或前景框架。排版使用圆润亲和的字体。布局上可以稍微松散，模仿自然生长的形态。阴影处理要柔和自然，避免生硬的黑色投影。\n\n渲染要求：微距摄影风格结合3D渲染，强调植物表面的透光感（Subsurface Scattering）和自然材质的细腻纹理，画面清新淡雅，令人心旷神怡。',
      },
      gradientVibrant: {
        name: '渐变活力',
        description: '视觉描述：全局视觉语言对标现代科技独角兽公司（如Stripe或Linear）的官网视觉，呈现一种极光般的流动美感。整体氛围梦幻、通透且富有呼吸感，避免刺眼的撞色，强调色彩之间的优雅融合。\n\n配色与材质：背景即前景，使用全屏的弥散渐变色。配色方案采用高雅且和谐的"全息色系"，以深邃的"宝石蓝"（Royal Blue, #2563EB）为基底，平滑过渡到"紫罗兰"（Violet, #7C3AED）和明亮的"洋红色"（Magenta, #DB2777）。颜色之间如水彩般晕染，没有生硬的边界。材质上锁定为"磨砂玻璃（Frosted Glass）"质感，让色彩看起来像是透过一层雾面屏透出来的，增加朦胧的高级感。插画使用有质感的半立体彩色设计。\n\n内容与排版：画面核心是缓慢流动的有机波浪形状，形态柔和自然。排版上使用醒目的粗体无衬线字（Bold Sans-serif），文字颜色为纯白（#FFFFFF），以确保在多彩背景上的绝对清晰度。界面元素采用"玻璃拟态"（Glassmorphism），即高透明度的白色圆角卡片，带有细腻的白色描边和背景模糊效果。\n\n渲染要求：C4D流体模拟渲染，强调"丝绸"般的顺滑光泽，配合轻微的噪点（Grain）增加质感，色彩饱满但不刺眼，展现出流光溢彩的现代数字美学。',
      },
    },
    home: {
      title: '蕉幻',
      subtitle: 'Vibe your PPT like vibing code',
      tagline: '基于 nano banana pro🍌 的原生 AI PPT 生成器',
      features: {
        oneClick: '一句话生成 PPT',
        naturalEdit: '自然语言修改',
        regionEdit: '指定区域编辑',
        export: '一键导出 PPTX/PDF',
      },
      tabs: {
        idea: '一句话生成',
        outline: '从大纲生成',
        description: '从描述生成',
      },
      tabDescriptions: {
        idea: '输入你的想法，AI 将为你生成完整的 PPT',
        outline: '已有大纲？直接粘贴，AI 将自动切分为结构化大纲',
        description: '已有完整描述？AI 将自动解析并直接生成图片，跳过大纲步骤',
      },
      placeholders: {
        idea: '例如：生成一份关于 AI 发展史的演讲 PPT',
        outline: '粘贴你的 PPT 大纲...',
        description: '粘贴你的完整页面描述...',
      },
      examples: {
        outline: '格式示例：\n\n第一页：AI 的起源\n- 1956年达特茅斯会议\n- 早期研究者的愿景\n\n第二页：机器学习的发展\n- 从规则驱动到数据驱动\n- 经典算法介绍\n\n第三页：未来展望\n- 趋势与挑战\n\n支持标题+要点的形式，也可以只写标题。AI 会自动切分为结构化大纲。',
        description: '格式示例：\n\n第一页：AI 的起源\n介绍人工智能概念的诞生，从1956年达特茅斯会议讲起。页面采用左文右图布局，左侧展示时间线，右侧配一张复古风格的计算机插画。\n\n第二页：机器学习的发展\n讲解从规则驱动到数据驱动的转变。使用深蓝色背景，中央放置算法对比图表，底部列出关键里程碑。\n\n每页可包含内容描述、排版布局、视觉风格等，用空行分隔各页。',
      },
      template: {
        title: '选择风格模板',
        useTextStyle: '使用文字描述风格',
        stylePlaceholder: '描述您想要的 PPT 风格，例如：简约商务风格，使用蓝色和白色配色，字体清晰大方...',
        presetStyles: '快速选择预设风格：',
        styleTip: '提示：点击预设风格快速填充，或自定义描述风格、配色、布局等要求',
      },
      actions: {
        selectFile: '选择参考文件',
        parsing: '解析中...',
        createProject: '创建新项目',
      },
      messages: {
        enterContent: '请输入内容',
        filesParsing: '还有 {{count}} 个参考文件正在解析中，请等待解析完成',
        projectCreateFailed: '项目创建失败',
        uploadingImage: '正在上传图片并识别内容...',
        imageUploadSuccess: '图片上传成功！已插入到光标位置',
        imageUploadFailed: '图片上传失败',
        fileUploadSuccess: '文件上传成功',
        fileUploadFailed: '文件上传失败',
        fileTooLarge: '文件过大：{{size}}MB，最大支持 200MB',
        unsupportedFileType: '不支持的文件类型: {{type}}',
        pptTip: '提示：建议将PPT转换为PDF格式上传，可获得更好的解析效果',
        filesAdded: '已添加 {{count}} 个参考文件',
        imageRemoved: '已移除图片',
        serviceTestTip: '建议先到设置页底部进行服务测试，避免后续功能异常',
      },
    },
  },
  en: {
    nav: {
      materialGenerate: 'Generate Material', materialCenter: 'Material Center',
      history: 'History', settings: 'Settings', help: 'Help'
    },
    settings: {
      language: { label: 'Interface Language' },
      theme: { label: 'Theme', light: 'Light', dark: 'Dark', system: 'System' }
    },
    presetStyles: {
      businessSimple: {
        name: 'Business Simple',
        description: 'Visual Description: The global visual language should embody the professionalism and gravitas of top-tier international consulting firms (such as McKinsey or BCG). The overall style pursues ultimate flat design and orderliness, rejecting superfluous decoration and emphasizing clear information delivery. Lighting should be even studio diffused light with no dramatic shadows, ensuring a clean and bright image.\n\nColor & Material: The background color must be a deep, authoritative Navy Blue (#0B1F3B), with foreground elements using pure white (#FFFFFF) and subtle Sky Blue (#38BDF8) accents. Avoid complex textures; use matte paper textures or smooth vector color blocks.\n\nContent & Typography: Typography follows a strict modular grid system. Generate clear geometric divisions using thin lines or faint Light Gray (#E5E7EB) blocks to separate content areas. Use bold sans-serif fonts (such as Helvetica or Roboto) for headings, keeping body text thin and clear. Chart elements should be flat 2D vector graphics, such as clean bar charts or pie charts, with restrained single-tone coloring.\n\nRendering: Vector illustration style, ultra-high clarity, with sharp anti-aliased edges on both text and graphics, showcasing rigorous business aesthetics suitable for Fortune 500 corporate presentations.',
      },
      techModern: {
        name: 'Tech Modern',
        description: 'Visual Description: The global visual language should blend cyberpunk with modern SaaS product futurism. The overall atmosphere is mysterious, deep, and dynamic, as if set inside a high-tech data center or virtual space. Lighting uses self-luminous effects in a dark environment, simulating neon tubes and laser glow.\n\nColor & Material: The background is a deep Midnight Black (#0B0F19) to contrast with foreground brightness. The primary palette uses high-saturation Electric Blue (#00A3FF) and Cyber Purple (#7C3AED) in linear gradients, creating a flowing energy feel. Materials heavily feature translucent glass, glowing grid lines, and metallic-sheen geometric shapes.\n\nContent & Typography: The scene should contain floating 3D geometric elements (cubes, tetrahedrons, or chip structures) with wireframe rendering effects. Layout favors asymmetric dynamic balance, using tech-feel monospace or modern sans-serif fonts. The background may subtly include circuit board textures, binary code streams, or dot-matrix maps as decorative detail.\n\nRendering: Octane Render style, emphasizing ray tracing, bloom effects, and depth of field control, presenting refined particle effects and tech-driven visual impact.',
      },
      academicFormal: {
        name: 'Academic Formal',
        description: 'Visual Description: The global visual language should emulate high-quality print publications or classic academic paper typesetting, conveying rationality, objectivity, and intellectual gravitas. The overall atmosphere is quiet and restrained, with no distracting glare or over-design. The image must fill the entire screen — no book bindings, paper edges, curled corners, shadows, or borders of any kind. The background should be presented in 2D flat style, not 3D.\n\nColor & Material: The background color is strictly Off-white (#F8F7F2), simulating premium book paper texture. Foreground colors use only pure black (#000000), Charcoal (#1F2937), and sparingly used Deep Red (#7F1D1D) or Deep Blue (#1E3A8A) as accent colors (no more than 5%). The material fully presents as high-quality printed paper with fine paper grain texture.\n\nContent & Typography: Typography must follow classic typographic design principles with generous margins. Use serif fonts (similar to Times New Roman or Garamond) to convey tradition and formality. Visual elements consist mainly of fine black line frames (#000000), standard academic table styles, and black-and-white line illustrations (#000000 / #FFFFFF). Layout uses left-right columns or top-bottom structured strict alignment.\n\nRendering: Ultra-high resolution scan style, emphasizing font grayscale anti-aliasing and line sharpness, appearing like the inner pages of a hardcover academic journal, showcasing absolute professionalism and authority. No page borders, black frames, or shadow lines should exist.',
      },
      creativeFun: {
        name: 'Creative Fun',
        description: 'Visual Description: The global visual language should resemble an energetic startup pitch deck or children\'s educational app interface. The overall atmosphere is relaxed, joyful, and imaginative, breaking conventional constraints. Lighting is bright and sunny, with no shadows between colors — completely flat design.\n\nColor & Material: The background uses a high-brightness Warm Yellow (#FFD54A). The color scheme is extremely bold, mixing vivid Vibrant Orange (#FF6A00), Grass Green (#22C55E), and Sky Blue (#38BDF8) to create Memphis-style color clashing effects. Materials simulate hand-drawn doodles, paper cutouts, or rough-edged vector illustrations.\n\nContent & Typography: The scene should contain hand-drawn illustration elements such as doodle arrows, stars, wavy lines, and irregular organic-shaped color blocks. Typography allows tilted, overlapping, or bouncing text, breaking rigid grids. Fonts should be rounded, cute bubble fonts or handwritten styles. Place some anthropomorphic cute objects or exaggerated speech bubbles in corners.\n\nRendering: Dribbble trending illustration style, with vivid flat colors, smooth elastic lines, visually conveying a happy, friendly, and approachable feeling.',
      },
      minimalistClean: {
        name: 'Minimalist Clean',
        description: 'Visual Description: The global visual language draws from Scandinavian Design and Kinfolk magazine aesthetics. The overall atmosphere is ethereal and tranquil, emphasizing the "less is more" philosophy. Lighting uses extremely soft diffused ambient light, with very faint and blurred shadows, creating an airy feel.\n\nColor & Material: The background is an ultra-light Haze Gray (#F5F5F7). Foreground colors use only Mid Gray (#6B7280) and low-saturation Morandi tones (such as Morandi Gray Blue #7A8FA6) as subtle accents. Materials feature fine matte finishes, with occasional slight plaster micro-texture.\n\nContent & Typography: The core of composition is negative space, which should occupy over 70% of the frame. Typography is extremely restrained — small font sizes, generous line spacing, using thin elegant sans-serif fonts. Visual anchors are simple geometric line icons, with layout pursuing absolute balance.\n\nRendering: Minimalist photography style, high dynamic range (HDR), extremely clean images with no noise, presenting a gallery-like art display aesthetic.',
      },
      luxuryPremium: {
        name: 'Luxury Premium',
        description: 'Visual Description: The global visual language should blend luxury watch advertising with five-star hotel brand imagery. The overall atmosphere is mysterious, noble, and unique. Lighting uses dramatic Rembrandt lighting or spotlight effects, illuminating key elements while the rest fades into darkness.\n\nColor & Material: The background is strictly locked to deep Obsidian Black (#0B0B0F). Foreground colors primarily consist of Champagne Gold (#F7E7CE). Materials must convey an expensive tactile quality — the core combination is: matte black velvet texture for backgrounds, brushed metal texture for foreground decorations.\n\nContent & Typography: Layout uses classic centered or symmetrical alignment, emphasizing ceremonial feel. Fonts must be elegant serif typefaces with slightly widened letter spacing to convey prestige. The scene may include delicate gold border lines and Art Deco decorative patterns. Any 3D objects should have a jewel-like polished quality.\n\nRendering: Cinematic photorealistic rendering, emphasizing physical material properties (PBR), particularly metallic specular reflections and velvet diffuse reflection details, presenting luxury advertising campaign-level premium quality.',
      },
      natureFresh: {
        name: 'Nature Fresh',
        description: 'Visual Description: The global visual language aims to evoke longing for nature, environmental awareness, and healthy living, similar to Whole Foods or Aesop brand visuals. The overall atmosphere is healing, breathable, and organic. Lighting simulates morning sunlight filtering through leaves (Tyndall effect), warm and soft.\n\nColor & Material: The background uses a soft Beige (#EAD9C6). The color palette draws from nature, primarily using Forest Green (#14532D) and Earth Brown (#7A4E2D). Materials emphasize natural textures such as recycled paper grain and plant leaf veins.\n\nContent & Typography: The scene should integrate real natural elements, primarily extending green plant leaves, as background decoration or foreground framing. Typography uses rounded, approachable fonts. Layout can be slightly loose, mimicking natural growth patterns. Shadow treatment should be soft and natural, avoiding harsh black drop shadows.\n\nRendering: Macro photography style combined with 3D rendering, emphasizing subsurface scattering on plant surfaces and fine natural material textures, creating a fresh and elegant image that feels refreshing and uplifting.',
      },
      gradientVibrant: {
        name: 'Gradient Vibrant',
        description: 'Visual Description: The global visual language benchmarks modern tech unicorn companies (such as Stripe or Linear) website visuals, presenting an aurora-like flowing beauty. The overall atmosphere is dreamy, translucent, and breathable, avoiding harsh color clashes and emphasizing elegant color fusion.\n\nColor & Material: The background IS the foreground, using full-screen diffused gradients. The palette uses elegant and harmonious "holographic colors," with a deep Royal Blue (#2563EB) base smoothly transitioning to Violet (#7C3AED) and bright Magenta (#DB2777). Colors blend like watercolors without hard boundaries. The material is locked to "frosted glass" texture, making colors appear as if glowing through a matte screen, adding an elegant haziness. Illustrations use textured semi-dimensional colorful designs.\n\nContent & Typography: The visual core consists of slowly flowing organic wave shapes with soft, natural forms. Typography uses bold sans-serif fonts, with text color in pure white (#FFFFFF) to ensure absolute clarity on the multicolored background. Interface elements use glassmorphism — highly transparent white rounded cards with subtle white borders and background blur effects.\n\nRendering: C4D fluid simulation rendering, emphasizing "silk-like" smooth sheen, with subtle grain for texture. Colors are saturated but not glaring, showcasing an iridescent modern digital aesthetic.',
      },
    },
    home: {
      title: 'Banana Slides',
      subtitle: 'Vibe your PPT like vibing code',
      tagline: 'AI-native PPT generator powered by nano banana pro🍌',
      features: {
        oneClick: 'One-click PPT generation',
        naturalEdit: 'Natural language editing',
        regionEdit: 'Region-specific editing',
        export: 'Export to PPTX/PDF',
      },
      tabs: {
        idea: 'From Idea',
        outline: 'From Outline',
        description: 'From Description',
      },
      tabDescriptions: {
        idea: 'Enter your idea, AI will generate a complete PPT for you',
        outline: 'Have an outline? Paste it directly, AI will split it into a structured outline',
        description: 'Have detailed descriptions? AI will parse and generate images directly, skipping the outline step',
      },
      placeholders: {
        idea: 'e.g., Generate a presentation about the history of AI',
        outline: 'Paste your PPT outline...',
        description: 'Paste your complete page descriptions...',
      },
      examples: {
        outline: 'Format example:\n\nSlide 1: The Origins of AI\n- 1956 Dartmouth Conference\n- Vision of early researchers\n\nSlide 2: The Rise of Machine Learning\n- From rule-based to data-driven\n- Classic algorithms overview\n\nSlide 3: Future Outlook\n- Trends and challenges\n\nTitles with bullet points, or titles only. AI will split it into a structured outline.',
        description: 'Format example:\n\nSlide 1: The Origins of AI\nIntroduce the birth of AI, starting from the 1956 Dartmouth Conference. Use a left-text right-image layout with a timeline on the left and a retro-style computer illustration on the right.\n\nSlide 2: The Rise of Machine Learning\nExplain the shift from rule-based to data-driven approaches. Dark blue background, algorithm comparison chart in the center, key milestones at the bottom.\n\nEach slide can include content, layout, and visual style. Separate slides with blank lines.',
      },
      template: {
        title: 'Select Style Template',
        useTextStyle: 'Use text description for style',
        stylePlaceholder: 'Describe your desired PPT style, e.g., minimalist business style...',
        presetStyles: 'Quick select preset styles:',
        styleTip: 'Tip: Click preset styles to quick fill, or customize',
      },
      actions: {
        selectFile: 'Select reference file',
        parsing: 'Parsing...',
        createProject: 'Create New Project',
      },
      messages: {
        enterContent: 'Please enter content',
        filesParsing: '{{count}} reference file(s) are still parsing, please wait',
        projectCreateFailed: 'Failed to create project',
        uploadingImage: 'Uploading and recognizing image...',
        imageUploadSuccess: 'Image uploaded! Inserted at cursor position',
        imageUploadFailed: 'Failed to upload image',
        fileUploadSuccess: 'File uploaded successfully',
        fileUploadFailed: 'Failed to upload file',
        fileTooLarge: 'File too large: {{size}}MB, maximum 200MB',
        unsupportedFileType: 'Unsupported file type: {{type}}',
        pptTip: 'Tip: Convert PPT to PDF for better parsing results',
        filesAdded: 'Added {{count}} reference file(s)',
        imageRemoved: 'Image removed',
        serviceTestTip: 'Test services in Settings first to avoid issues',
      },
    },
  },
};

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const t = useT(homeI18n); // 组件内翻译 + 自动 fallback 到全局
  const { theme, isDark, setTheme } = useTheme();
  const { initializeProject, isGlobalLoading } = useProjectStore();
  const { show, ToastContainer } = useToast();
  
  const [activeTab, setActiveTab] = useState<CreationType>('idea');
  const [content, setContent] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<File | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedPresetTemplateId, setSelectedPresetTemplateId] = useState<string | null>(null);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [isMaterialCenterOpen, setIsMaterialCenterOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([]);
  const [referenceFiles, setReferenceFiles] = useState<ReferenceFile[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isFileSelectorOpen, setIsFileSelectorOpen] = useState(false);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [useTemplateStyle, setUseTemplateStyle] = useState(false);
  const [templateStyle, setTemplateStyle] = useState('');
  const [hoveredPresetId, setHoveredPresetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  // 检查是否有当前项目 & 加载用户模板
  useEffect(() => {
    const projectId = localStorage.getItem('currentProjectId');
    setCurrentProjectId(projectId);

    // 加载用户模板列表（用于按需获取File）
    const loadTemplates = async () => {
      try {
        const response = await listUserTemplates();
        if (response.data?.templates) {
          setUserTemplates(response.data.templates);
        }
      } catch (error) {
        console.error('加载用户模板失败:', error);
      }
    };
    loadTemplates();
  }, []);

  // 首次访问自动弹出帮助模态框
  useEffect(() => {
    const hasSeenHelp = localStorage.getItem('hasSeenHelpModal');
    if (!hasSeenHelp) {
      // 延迟500ms打开，让页面先渲染完成
      const timer = setTimeout(() => {
        setIsHelpModalOpen(true);
        localStorage.setItem('hasSeenHelpModal', 'true');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleOpenMaterialModal = () => {
    // 在主页始终生成全局素材，不关联任何项目
    setIsMaterialModalOpen(true);
  };

  const textareaRef = useRef<MarkdownTextareaRef>(null);

  // Callback to insert at cursor position in the textarea
  const insertAtCursor = useCallback((markdown: string) => {
    textareaRef.current?.insertAtCursor(markdown);
  }, []);

  // 图片粘贴使用统一 hook（批量支持，不对非图片文件发出警告，由下方 handlePaste 处理文档）
  const { handlePaste: handleImagePaste, handleFiles: handleImageFiles, isUploading: isUploadingImage } = useImagePaste({
    projectId: null,
    setContent,
    showToast: show,
    warnUnsupportedTypes: false,
    insertAtCursor,
  });

  // 检测粘贴事件，图片走 hook，文档走独立逻辑
  const handlePaste = async (e: React.ClipboardEvent<HTMLElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    // 分类：图片 vs 文档 vs 不支持
    let hasImages = false;
    const docFiles: File[] = [];
    const unsupportedExts: string[] = [];

    const allowedDocExtensions = ['pdf', 'docx', 'pptx', 'doc', 'ppt', 'xlsx', 'xls', 'csv', 'txt', 'md'];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind !== 'file') continue;
      const file = item.getAsFile();
      if (!file) continue;

      if (file.type.startsWith('image/')) {
        hasImages = true;
      } else {
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        if (fileExt && allowedDocExtensions.includes(fileExt)) {
          docFiles.push(file);
        } else {
          unsupportedExts.push(fileExt || file.type);
        }
      }
    }

    // 图片交给 hook 处理（批量上传）
    if (hasImages) {
      handleImagePaste(e);
    }

    // 文档文件逐个上传
    if (docFiles.length > 0) {
      if (!hasImages) e.preventDefault();
      for (const file of docFiles) {
        await handleFileUpload(file);
      }
    }

    // 不支持的文件类型提示
    if (unsupportedExts.length > 0 && !hasImages && docFiles.length === 0) {
      show({ message: t('home.messages.unsupportedFileType', { type: unsupportedExts.join(', ') }), type: 'info' });
    }
  };

  // 上传文件
  // 在 Home 页面，文件始终上传为全局文件（不关联项目），因为此时还没有项目
  const handleFileUpload = async (file: File) => {
    if (isUploadingFile) return;

    // 检查文件大小（前端预检查）
    const maxSize = 200 * 1024 * 1024; // 200MB
    if (file.size > maxSize) {
      show({ 
        message: t('home.messages.fileTooLarge', { size: (file.size / 1024 / 1024).toFixed(1) }), 
        type: 'error' 
      });
      return;
    }

    // 检查是否是PPT文件，提示建议使用PDF
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (fileExt === 'ppt' || fileExt === 'pptx') 
      show({ message: `💡 ${t('home.messages.pptTip')}`, type: 'info' });
    
    setIsUploadingFile(true);
    try {
      // 在 Home 页面，始终上传为全局文件
      const response = await uploadReferenceFile(file, null);
      if (response?.data?.file) {
        const uploadedFile = response.data.file;
        setReferenceFiles(prev => [...prev, uploadedFile]);
        show({ message: t('home.messages.fileUploadSuccess'), type: 'success' });
        
        // 如果文件状态为 pending，自动触发解析
        if (uploadedFile.parse_status === 'pending') {
          try {
            const parseResponse = await triggerFileParse(uploadedFile.id);
            // 使用解析接口返回的文件对象更新状态
            if (parseResponse?.data?.file) {
              const parsedFile = parseResponse.data.file;
              setReferenceFiles(prev => 
                prev.map(f => f.id === uploadedFile.id ? parsedFile : f)
              );
            } else {
              // 如果没有返回文件对象，手动更新状态为 parsing（异步线程会稍后更新）
              setReferenceFiles(prev => 
                prev.map(f => f.id === uploadedFile.id ? { ...f, parse_status: 'parsing' as const } : f)
              );
            }
          } catch (parseError: any) {
            console.error('触发文件解析失败:', parseError);
            // 解析触发失败不影响上传成功提示
          }
        }
      } else {
        show({ message: t('home.messages.fileUploadFailed'), type: 'error' });
      }
    } catch (error: any) {
      console.error('文件上传失败:', error);
      
      // 特殊处理413错误
      if (error?.response?.status === 413) {
        show({ 
          message: `文件过大：${(file.size / 1024 / 1024).toFixed(1)}MB，最大支持 200MB`, 
          type: 'error' 
        });
      } else {
        show({ 
          message: `文件上传失败: ${error?.response?.data?.error?.message || error.message || '未知错误'}`, 
          type: 'error' 
        });
      }
    } finally {
      setIsUploadingFile(false);
    }
  };

  // 从当前项目移除文件引用（不删除文件本身）
  const handleFileRemove = (fileId: string) => {
    setReferenceFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // 文件状态变化回调
  const handleFileStatusChange = (updatedFile: ReferenceFile) => {
    setReferenceFiles(prev => 
      prev.map(f => f.id === updatedFile.id ? updatedFile : f)
    );
  };

  // 点击回形针按钮 - 打开文件选择器
  const handlePaperclipClick = () => {
    setIsFileSelectorOpen(true);
  };

  // 从选择器选择文件后的回调
  const handleFilesSelected = (selectedFiles: ReferenceFile[]) => {
    // 合并新选择的文件到列表（去重）
    setReferenceFiles(prev => {
      const existingIds = new Set(prev.map(f => f.id));
      const newFiles = selectedFiles.filter(f => !existingIds.has(f.id));
      // 合并时，如果文件已存在，更新其状态（可能解析状态已改变）
      const updated = prev.map(f => {
        const updatedFile = selectedFiles.find(sf => sf.id === f.id);
        return updatedFile || f;
      });
      return [...updated, ...newFiles];
    });
    show({ message: t('home.messages.filesAdded', { count: selectedFiles.length }), type: 'success' });
  };

  // 获取当前已选择的文件ID列表，传递给选择器（使用 useMemo 避免每次渲染都重新计算）
  const selectedFileIds = useMemo(() => {
    return referenceFiles.map(f => f.id);
  }, [referenceFiles]);

  // 文件选择变化
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      await handleFileUpload(files[i]);
    }

    // 清空 input，允许重复选择同一文件
    e.target.value = '';
  };

  const tabConfig = {
    idea: {
      icon: <Sparkles size={20} />,
      label: t('home.tabs.idea'),
      placeholder: t('home.placeholders.idea'),
      description: t('home.tabDescriptions.idea'),
      example: null as string | null,
    },
    outline: {
      icon: <FileText size={20} />,
      label: t('home.tabs.outline'),
      placeholder: t('home.placeholders.outline'),
      description: t('home.tabDescriptions.outline'),
      example: t('home.examples.outline'),
    },
    description: {
      icon: <FileEdit size={20} />,
      label: t('home.tabs.description'),
      placeholder: t('home.placeholders.description'),
      description: t('home.tabDescriptions.description'),
      example: t('home.examples.description'),
    },
  };

  const handleTemplateSelect = async (templateFile: File | null, templateId?: string) => {
    // 总是设置文件（如果提供）
    if (templateFile) {
      setSelectedTemplate(templateFile);
    }
    
    // 处理模板 ID
    if (templateId) {
      // 判断是用户模板还是预设模板
      // 预设模板 ID 通常是 '1', '2', '3' 等短字符串
      // 用户模板 ID 通常较长（UUID 格式）
      if (templateId.length <= 3 && /^\d+$/.test(templateId)) {
        // 预设模板
        setSelectedPresetTemplateId(templateId);
        setSelectedTemplateId(null);
      } else {
        // 用户模板
        setSelectedTemplateId(templateId);
        setSelectedPresetTemplateId(null);
      }
    } else {
      // 如果没有 templateId，可能是直接上传的文件
      // 清空所有选择状态
      setSelectedTemplateId(null);
      setSelectedPresetTemplateId(null);
    }
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      show({ message: t('home.messages.enterContent'), type: 'error' });
      return;
    }

    // 检查是否有正在解析的文件
    const parsingFiles = referenceFiles.filter(f =>
      f.parse_status === 'pending' || f.parse_status === 'parsing'
    );
    if (parsingFiles.length > 0) {
      show({
        message: t('home.messages.filesParsing', { count: parsingFiles.length }),
        type: 'info'
      });
      return;
    }

    try {
      // 如果有模板ID但没有File，按需加载
      let templateFile = selectedTemplate;
      if (!templateFile && (selectedTemplateId || selectedPresetTemplateId)) {
        const templateId = selectedTemplateId || selectedPresetTemplateId;
        if (templateId) {
          templateFile = await getTemplateFile(templateId, userTemplates);
        }
      }
      
      // 传递风格描述（只要有内容就传递，不管开关状态）
      const styleDesc = templateStyle.trim() ? templateStyle.trim() : undefined;

      // 传递参考文件ID列表，确保 AI 生成时能读取参考文件内容
      const refFileIds = referenceFiles
        .filter(f => f.parse_status === 'completed')
        .map(f => f.id);

      await initializeProject(activeTab, content, templateFile || undefined, styleDesc, refFileIds.length > 0 ? refFileIds : undefined);
      
      // 根据类型跳转到不同页面
      const projectId = localStorage.getItem('currentProjectId');
      if (!projectId) {
        show({ message: t('home.messages.projectCreateFailed'), type: 'error' });
        return;
      }
      
      // 关联未完成解析的参考文件（已完成的在 initializeProject 中关联）
      if (referenceFiles.length > 0) {
        const unassociatedFiles = referenceFiles.filter(f => f.parse_status !== 'completed');
        if (unassociatedFiles.length > 0) {
          console.log(`Associating ${unassociatedFiles.length} remaining reference files to project ${projectId}:`, unassociatedFiles);
          try {
            await Promise.all(
              unassociatedFiles.map(async file => {
                const response = await associateFileToProject(file.id, projectId);
                return response;
              })
            );
          } catch (error) {
            console.error('Failed to associate reference files:', error);
          }
        }
      }
      
      // 关联图片素材到项目（解析content中的markdown图片链接）
      const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
      const materialUrls: string[] = [];
      let match;
      while ((match = imageRegex.exec(content)) !== null) {
        materialUrls.push(match[2]); // match[2] 是 URL
      }
      
      if (materialUrls.length > 0) {
        console.log(`Associating ${materialUrls.length} materials to project ${projectId}:`, materialUrls);
        try {
          const response = await associateMaterialsToProject(projectId, materialUrls);
          console.log('Materials associated successfully:', response);
        } catch (error) {
          console.error('Failed to associate materials:', error);
          // 不影响主流程，继续执行
        }
      } else {
        console.log('No materials to associate');
      }
      
      if (activeTab === 'idea' || activeTab === 'outline') {
        navigate(`/project/${projectId}/outline`);
      } else if (activeTab === 'description') {
        // 从描述生成：直接跳到描述生成页（因为已经自动生成了大纲和描述）
        navigate(`/project/${projectId}/detail`);
      }
    } catch (error: any) {
      console.error('创建项目失败:', error);
      // 错误已经在 store 中处理并显示
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50/30 to-pink-50/50 dark:from-background-primary dark:via-background-primary dark:to-background-primary relative overflow-hidden">
      {/* 背景装饰元素 - 仅在亮色模式显示 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none dark:hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-banana-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-orange-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-yellow-400/5 rounded-full blur-3xl"></div>
      </div>

      {/* 导航栏 */}
      <nav className="relative z-50 h-16 md:h-18 bg-white/40 dark:bg-background-primary backdrop-blur-2xl dark:backdrop-blur-none dark:border-b dark:border-border-primary">

        <div className="max-w-7xl mx-auto px-4 md:px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center">
              <img
                src="/logo.png"
                alt="蕉幻 Banana Slides Logo"
                className="h-10 md:h-12 w-auto rounded-lg object-contain"
              />
            </div>
            <span className="text-xl md:text-2xl font-bold bg-gradient-to-r from-banana-600 via-orange-500 to-pink-500 bg-clip-text text-transparent">
              蕉幻
            </span>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            {/* 桌面端：带文字的素材生成按钮 */}
            <Button
              variant="ghost"
              size="sm"
              icon={<ImagePlus size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={handleOpenMaterialModal}
              className="hidden sm:inline-flex hover:bg-banana-100/60 hover:shadow-sm hover:scale-105 transition-all duration-200 font-medium"
            >
              <span className="hidden md:inline">{t('nav.materialGenerate')}</span>
            </Button>
            {/* 手机端：仅图标的素材生成按钮 */}
            <Button
              variant="ghost"
              size="sm"
              icon={<ImagePlus size={16} />}
              onClick={handleOpenMaterialModal}
              className="sm:hidden hover:bg-banana-100/60 hover:shadow-sm hover:scale-105 transition-all duration-200"
              title={t('nav.materialGenerate')}
            />
            {/* 桌面端：带文字的素材中心按钮 */}
            <Button
              variant="ghost"
              size="sm"
              icon={<FolderOpen size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => setIsMaterialCenterOpen(true)}
              className="hidden sm:inline-flex hover:bg-banana-100/60 hover:shadow-sm hover:scale-105 transition-all duration-200 font-medium"
            >
              <span className="hidden md:inline">{t('nav.materialCenter')}</span>
            </Button>
            {/* 手机端：仅图标的素材中心按钮 */}
            <Button
              variant="ghost"
              size="sm"
              icon={<FolderOpen size={16} />}
              onClick={() => setIsMaterialCenterOpen(true)}
              className="sm:hidden hover:bg-banana-100/60 hover:shadow-sm hover:scale-105 transition-all duration-200"
              title={t('nav.materialCenter')}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/history')}
              className="text-xs md:text-sm hover:bg-banana-100/60 hover:shadow-sm hover:scale-105 transition-all duration-200 font-medium"
            >
              <span className="hidden sm:inline">{t('nav.history')}</span>
              <span className="sm:hidden">{t('nav.history')}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Settings size={16} className="md:w-[18px] md:h-[18px]" />}
              onClick={() => navigate('/settings')}
              className="text-xs md:text-sm hover:bg-banana-100/60 hover:shadow-sm hover:scale-105 transition-all duration-200 font-medium"
            >
              <span className="hidden md:inline">{t('nav.settings')}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsHelpModalOpen(true)}
              className="hidden md:inline-flex hover:bg-banana-50/50"
            >
              {t('nav.help')}
            </Button>
            {/* 移动端帮助按钮 */}
            <Button
              variant="ghost"
              size="sm"
              icon={<HelpCircle size={16} />}
              onClick={() => setIsHelpModalOpen(true)}
              className="md:hidden hover:bg-banana-100/60 hover:shadow-sm hover:scale-105 transition-all duration-200"
              title={t('nav.help')}
            />
            {/* 分隔线 */}
            <div className="h-5 w-px bg-gray-300 dark:bg-border-primary mx-1" />
            {/* 语言切换按钮 */}
            <button
              onClick={() => i18n.changeLanguage(i18n.language?.startsWith('zh') ? 'en' : 'zh')}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 dark:text-foreground-tertiary hover:text-gray-900 dark:hover:text-gray-100 hover:bg-banana-100/60 dark:hover:bg-background-hover rounded-md transition-all"
              title={t('settings.language.label')}
            >
              <Globe size={14} />
              <span>{i18n.language?.startsWith('zh') ? 'EN' : '中'}</span>
            </button>
            {/* 主题切换按钮 */}
            <div className="relative" ref={themeMenuRef}>
              <button
                onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                className="flex items-center gap-1 p-1.5 text-gray-600 dark:text-foreground-tertiary hover:text-gray-900 dark:hover:text-gray-100 hover:bg-banana-100/60 dark:hover:bg-background-hover rounded-md transition-all"
                title={t('settings.theme.label')}
              >
                {theme === 'system' ? <Monitor size={16} /> : isDark ? <Moon size={16} /> : <Sun size={16} />}
                <ChevronDown size={12} className={`transition-transform ${isThemeMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {/* 主题下拉菜单 */}
              {isThemeMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsThemeMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-background-secondary border border-gray-200 dark:border-border-primary rounded-lg shadow-lg dark:shadow-none py-1 min-w-[120px]">
                    <button
                      onClick={() => { setTheme('light'); setIsThemeMenuOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-background-hover transition-colors ${theme === 'light' ? 'text-banana' : 'text-gray-700 dark:text-foreground-secondary'}`}
                    >
                      <Sun size={14} />
                      <span>{t('settings.theme.light')}</span>
                    </button>
                    <button
                      onClick={() => { setTheme('dark'); setIsThemeMenuOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-background-hover transition-colors ${theme === 'dark' ? 'text-banana' : 'text-gray-700 dark:text-foreground-secondary'}`}
                    >
                      <Moon size={14} />
                      <span>{t('settings.theme.dark')}</span>
                    </button>
                    <button
                      onClick={() => { setTheme('system'); setIsThemeMenuOpen(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-background-hover transition-colors ${theme === 'system' ? 'text-banana' : 'text-gray-700 dark:text-foreground-secondary'}`}
                    >
                      <Monitor size={14} />
                      <span>{t('settings.theme.system')}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
            {/* 分隔线 */}
            <div className="h-5 w-px bg-gray-300 dark:bg-border-primary mx-1" />
            {/* GitHub 仓库卡片 */}
            <GithubRepoCard />
            {/* 分隔线 */}
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="relative max-w-5xl mx-auto px-3 md:px-4 py-8 md:py-12">
        {/* Hero 标题区 */}
        <div className="text-center mb-10 md:mb-16 space-y-4 md:space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 dark:bg-background-secondary backdrop-blur-sm rounded-full shadow-sm dark:shadow-none mb-4">
            <span className="text-2xl animate-pulse"><Sparkles size={20} className="text-orange-500 dark:text-banana" /></span>
            <span className="text-sm font-medium text-gray-700 dark:text-foreground-secondary">{t('home.tagline')}</span>
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold leading-tight">
            <span className="bg-gradient-to-r from-yellow-600 via-orange-500 to-pink-500 dark:from-banana-dark dark:via-banana dark:to-banana-light bg-clip-text text-transparent dark:italic" style={{
              backgroundSize: '200% auto',
              animation: 'gradient 3s ease infinite',
            }}>
              {i18n.language?.startsWith('zh') ? `${t('home.title')} · Banana Slides` : 'Banana Slides'}
            </span>
          </h1>

          <p className="text-lg md:text-xl text-gray-600 dark:text-foreground-secondary max-w-2xl mx-auto font-light">
            {t('home.subtitle')}
          </p>

          {/* 特性标签 */}
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 pt-4">
            {[
              { icon: <Sparkles size={14} className="text-yellow-600 dark:text-banana" />, label: t('home.features.oneClick') },
              { icon: <FileEdit size={14} className="text-blue-500 dark:text-blue-400" />, label: t('home.features.naturalEdit') },
              { icon: <Search size={14} className="text-orange-500 dark:text-orange-400" />, label: t('home.features.regionEdit') },

              { icon: <Paperclip size={14} className="text-green-600 dark:text-green-400" />, label: t('home.features.export') },
            ].map((feature, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/70 dark:bg-background-secondary backdrop-blur-sm rounded-full text-xs md:text-sm text-gray-700 dark:text-foreground-secondary border border-gray-200/50 dark:border-border-primary shadow-sm dark:shadow-none hover:shadow-md dark:hover:border-border-hover transition-all hover:scale-105 cursor-default"
              >
                {feature.icon}
                {feature.label}
              </span>
            ))}
          </div>
        </div>

        {/* 创建卡片 */}
        <Card className="p-4 md:p-10 bg-white/90 dark:bg-background-secondary backdrop-blur-xl dark:backdrop-blur-none shadow-2xl dark:shadow-none border-0 dark:border dark:border-border-primary hover:shadow-3xl dark:hover:shadow-none transition-all duration-300 dark:rounded-2xl">
          {/* 选项卡 */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-6 md:mb-8">
            {(Object.keys(tabConfig) as CreationType[]).map((type) => {
              const config = tabConfig[type];
              return (
                <button
                  key={type}
                  onClick={() => setActiveTab(type)}
                  className={`flex-1 flex items-center justify-center gap-1.5 md:gap-2 px-3 md:px-6 py-2.5 md:py-3 rounded-lg dark:rounded-xl font-medium transition-all text-sm md:text-base touch-manipulation ${
                    activeTab === type
                      ? 'bg-gradient-to-r from-banana-500 to-banana-600 dark:from-banana dark:to-banana text-black shadow-yellow dark:shadow-lg dark:shadow-banana/20'
                      : 'bg-white dark:bg-background-elevated border border-gray-200 dark:border-border-primary text-gray-700 dark:text-foreground-secondary hover:bg-banana-50 dark:hover:bg-background-hover active:bg-banana-100'
                  }`}
                >
                  <span className="scale-90 md:scale-100">{config.icon}</span>
                  <span className="truncate">{config.label}</span>
                </button>
              );
            })}
          </div>

          {/* 描述 */}
          <div className="relative">
            <p className="text-sm md:text-base mb-4 md:mb-6 leading-relaxed">
              <span className="inline-flex items-center gap-2 text-gray-600 dark:text-foreground-tertiary">
                <Lightbulb size={16} className="text-banana-600 dark:text-banana flex-shrink-0" />
                <span className="font-semibold">
                  {tabConfig[activeTab].description}
                </span>
                {tabConfig[activeTab].example && (
                  <span className="relative group/tip inline-flex">
                    <HelpCircle size={15} className="text-gray-400 dark:text-foreground-tertiary hover:text-banana-600 dark:hover:text-banana cursor-help transition-colors" />
                    <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tip:block z-50 w-72 md:w-80 p-3 bg-white dark:bg-background-elevated border border-gray-200 dark:border-border-primary rounded-lg shadow-xl dark:shadow-none text-xs text-gray-700 dark:text-foreground-secondary whitespace-pre-line leading-relaxed">
                      {tabConfig[activeTab].example}
                      <span className="absolute left-1/2 -translate-x-1/2 top-full -mt-px w-2 h-2 bg-white dark:bg-background-elevated border-r border-b border-gray-200 dark:border-border-primary rotate-45" />
                    </span>
                  </span>
                )}
              </span>
            </p>
          </div>

          {/* 输入区 - 带工具栏 */}
          <div className="mb-2">
            <MarkdownTextarea
              ref={textareaRef}
              placeholder={tabConfig[activeTab].placeholder}
              value={content}
              onChange={setContent}
              onPaste={handlePaste}
              onFiles={handleImageFiles}
              rows={activeTab === 'idea' ? 4 : 8}
              className="text-sm md:text-base border-2 border-gray-200 dark:border-border-primary dark:bg-background-tertiary dark:text-white focus-within:border-banana-400 dark:focus-within:border-banana transition-colors duration-200"
              toolbarLeft={
                <button
                  type="button"
                  onClick={handlePaperclipClick}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-foreground-tertiary dark:hover:text-foreground-secondary dark:hover:bg-background-hover rounded transition-colors active:scale-95 touch-manipulation"
                  title={t('home.actions.selectFile')}
                >
                  <Paperclip size={18} />
                </button>
              }
              toolbarRight={
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  loading={isGlobalLoading}
                  disabled={
                    !content.trim() ||
                    isUploadingImage ||
                    referenceFiles.some(f => f.parse_status === 'pending' || f.parse_status === 'parsing')
                  }
                  className="shadow-sm dark:shadow-background-primary/30 text-xs md:text-sm px-3 md:px-4"
                >
                  {referenceFiles.some(f => f.parse_status === 'pending' || f.parse_status === 'parsing')
                    ? t('home.actions.parsing')
                    : t('common.next')}
                </Button>
              }
            />
          </div>

          {/* 隐藏的文件输入 */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md"
            onChange={handleFileSelect}
            className="hidden"
          />

          <ReferenceFileList
            files={referenceFiles}
            onFileClick={setPreviewFileId}
            onFileDelete={handleFileRemove}
            onFileStatusChange={handleFileStatusChange}
            deleteMode="remove"
            className="mb-4"
          />

          {/* 模板选择 */}
          <div className="mb-6 md:mb-8 pt-4 border-t border-gray-100 dark:border-border-primary">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div className="flex items-center gap-2">
                <Palette size={18} className="text-orange-600 dark:text-banana flex-shrink-0" />
                <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">
                  {t('home.template.title')}
                </h3>
              </div>
              {/* 无模板图模式开关 */}
              <label className="flex items-center gap-2 cursor-pointer group">
                <span className="text-sm text-gray-600 dark:text-foreground-tertiary group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                  {t('home.template.useTextStyle')}
                </span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={useTemplateStyle}
                    onChange={(e) => {
                      setUseTemplateStyle(e.target.checked);
                      // 切换到无模板图模式时，清空模板选择
                      if (e.target.checked) {
                        setSelectedTemplate(null);
                        setSelectedTemplateId(null);
                        setSelectedPresetTemplateId(null);
                      }
                      // 不再清空风格描述，允许用户保留已输入的内容
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 dark:bg-background-hover peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-banana-300 dark:peer-focus:ring-banana/30 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white dark:after:bg-foreground-secondary after:border-gray-300 dark:after:border-border-hover after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-banana"></div>
                </div>
              </label>
            </div>
            
            {/* 根据模式显示不同的内容 */}
            {useTemplateStyle ? (
              <div className="space-y-3">
                <Textarea
                  placeholder={t('home.template.stylePlaceholder')}
                  value={templateStyle}
                  onChange={(e) => setTemplateStyle(e.target.value)}
                  rows={3}
                  className="text-sm border-2 border-gray-200 dark:border-border-primary dark:bg-background-tertiary dark:text-white dark:placeholder-foreground-tertiary focus:border-banana-400 dark:focus:border-banana transition-colors duration-200"
                />

                {/* 预设风格按钮 */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-600 dark:text-foreground-tertiary">
                    {t('home.template.presetStyles')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_STYLES.map((preset) => (
                      <div key={preset.id} className="relative">
                        <button
                          type="button"
                          onClick={() => setTemplateStyle(t(preset.descriptionKey))}
                          onMouseEnter={() => setHoveredPresetId(preset.id)}
                          onMouseLeave={() => setHoveredPresetId(null)}
                          className="px-3 py-1.5 text-xs font-medium rounded-full border-2 border-gray-200 dark:border-border-primary dark:text-foreground-secondary hover:border-banana-400 dark:hover:border-banana hover:bg-banana-50 dark:hover:bg-background-hover transition-all duration-200 hover:shadow-sm dark:hover:shadow-none"
                        >
                          {t(preset.nameKey)}
                        </button>
                        
                        {/* 悬停时显示预览图片 */}
                        {hoveredPresetId === preset.id && preset.previewImage && (
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                            <div className="bg-white dark:bg-background-secondary rounded-lg shadow-2xl dark:shadow-none border-2 border-banana-400 dark:border-banana p-2.5 w-72">
                              <img
                                src={preset.previewImage}
                                alt={t(preset.nameKey)}
                                className="w-full h-40 object-cover rounded"
                                onError={(e) => {
                                  // 如果图片加载失败，隐藏预览
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                              <p className="text-xs text-gray-600 dark:text-foreground-tertiary mt-2 px-1 line-clamp-3">
                                {t(preset.descriptionKey)}
                              </p>
                            </div>
                            {/* 小三角形指示器 */}
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                              <div className="w-3 h-3 bg-white dark:bg-background-secondary border-r-2 border-b-2 border-banana-400 dark:border-banana transform rotate-45"></div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                <p className="text-xs text-gray-500 dark:text-foreground-tertiary">
                  💡 {t('home.template.styleTip')}
                </p>
              </div>
            ) : (
              <TemplateSelector
                onSelect={handleTemplateSelect}
                selectedTemplateId={selectedTemplateId}
                selectedPresetTemplateId={selectedPresetTemplateId}
                showUpload={true} // 在主页上传的模板保存到用户模板库
                projectId={currentProjectId}
              />
            )}
          </div>

        </Card>
      </main>
      <ToastContainer />
      {/* 素材生成模态 - 在主页始终生成全局素材 */}
      <MaterialGeneratorModal
        projectId={null}
        isOpen={isMaterialModalOpen}
        onClose={() => setIsMaterialModalOpen(false)}
      />
      {/* 素材中心模态 */}
      <MaterialCenterModal
        isOpen={isMaterialCenterOpen}
        onClose={() => setIsMaterialCenterOpen(false)}
      />
      {/* 参考文件选择器 */}
      {/* 在 Home 页面，始终查询全局文件，因为此时还没有项目 */}
      <ReferenceFileSelector
        projectId={null}
        isOpen={isFileSelectorOpen}
        onClose={() => setIsFileSelectorOpen(false)}
        onSelect={handleFilesSelected}
        multiple={true}
        initialSelectedIds={selectedFileIds}
      />
      
      <FilePreviewModal fileId={previewFileId} onClose={() => setPreviewFileId(null)} />
      {/* 帮助模态框 */}
      <HelpModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />
      {/* Footer */}
      <Footer />
    </div>
  );
};
