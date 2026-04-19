from services.prompts import get_design_generation_prompt, get_image_generation_prompt


class TestDesignGenerationPrompt:
    def test_includes_template_style_when_available(self):
        prompt = get_design_generation_prompt(
            page_description="页面文字：AI 趋势",
            outline_text="1. 封面\n2. AI 趋势",
            template_style="现代极简，蓝白配色",
            has_template_image=True,
            page_index=2,
            aspect_ratio="16:9",
        )

        assert "<template_style>" in prompt
        assert "现代极简，蓝白配色" in prompt
        assert "布局方式" in prompt
        assert "构图指令" in prompt
        assert "元素风格" in prompt
        assert "视觉层次" in prompt
        assert "配色应用" in prompt

    def test_handles_template_image_only(self):
        prompt = get_design_generation_prompt(
            page_description="页面文字：增长数据",
            outline_text="1. 封面\n2. 增长数据",
            template_style=None,
            has_template_image=True,
            page_index=2,
            aspect_ratio="4:3",
        )

        assert "项目存在模板图片" in prompt
        assert "4:3" in prompt

    def test_handles_no_template_constraints(self):
        prompt = get_design_generation_prompt(
            page_description="页面文字：总结",
            outline_text="1. 封面\n2. 总结",
            template_style=None,
            has_template_image=False,
            page_index=2,
            aspect_ratio="16:9",
        )

        assert "没有模板图片也没有风格描述" in prompt

    def test_mentions_cover_page_handling(self):
        prompt = get_design_generation_prompt(
            page_description="页面文字：公司年度报告",
            outline_text="1. 公司年度报告",
            template_style="商务风",
            has_template_image=False,
            page_index=1,
            aspect_ratio="16:9",
        )

        assert "当前页面为第 1 页" in prompt
        assert "如果是第一页，请按封面页处理" in prompt


class TestImageGenerationPromptWithDesign:
    def test_includes_design_instructions_when_design_text_present(self):
        prompt = get_image_generation_prompt(
            page_desc="Test page",
            outline_text="Test outline",
            current_section="Section 1",
            design_text="布局方式：左文右图",
        )

        assert "<design_instructions>" in prompt
        assert "布局方式：左文右图" in prompt
        assert "严格按照设计指令进行视觉设计" in prompt
        assert "自动设计最完美的构图" not in prompt

    def test_keeps_legacy_behavior_without_design_text(self):
        prompt = get_image_generation_prompt(
            page_desc="Test page",
            outline_text="Test outline",
            current_section="Section 1",
            design_text=None,
        )

        assert "<design_instructions>" not in prompt
        assert "自动设计最完美的构图" in prompt
