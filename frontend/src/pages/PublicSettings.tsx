import { useT } from "@/hooks/useT";
import { settingsI18n } from "@/components/settings/settingsI18n";
import { SettingsPageFrame } from "@/components/settings/SettingsPageFrame";
import { SettingsProviderPicker } from "@/components/settings/SettingsProviderPicker";
import { SettingsApiGuidance } from "@/components/settings/SettingsApiGuidance";
import {
  SettingsField,
  type SettingsFieldConfig,
} from "@/components/settings/SettingsField";
import {
  SettingsSection,
  SettingsAdvanced,
  SettingsServiceRow,
  SettingsActions,
} from "@/components/settings/SettingsLayout";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Key,
  Lock,
  FileText,
  Image,
  Zap,
  Globe,
  Brain,
  Volume2,
  Save,
  RotateCcw,
  Lightbulb,
} from "lucide-react";
import { apiClient } from "@/api/client";
import { publicPartners } from "@/utils/publicDemo";
import { Button, Input, useToast, useConfirm } from "@/components/shared";
import { getSettings } from "@/api/endpoints";

import { ASPECT_RATIO_OPTIONS } from "@/config/aspectRatio";

type Data = Record<string, unknown>;
type ServiceResult = {
  status: "running" | "success" | "error";
  provider: string;
  message: string;
  detail?: string;
};
const services = [
  ["text-model", "文本模型"],
  ["caption-model", "图片识别"],
  ["image-model", "图像生成"],
  ["mineru-pdf", "MinerU 解析"],
  ["baidu-ocr", "百度 OCR"],
  ["baidu-inpaint", "百度图像修复"],
] as const;
const editableFields = [
  "partner",
  "image_resolution",
  "image_aspect_ratio",
  "max_description_workers",
  "max_image_workers",
  "output_language",
  "description_generation_mode",
  "enable_text_reasoning",
  "text_thinking_budget",
  "enable_image_reasoning",
  "image_thinking_budget",
  "enable_image_quality_control",
  "elevenlabs_enabled",
  "elevenlabs_voice_id",
];
const secretFields = [
  ["api_key", "API Key"],
  ["mineru_token", "MinerU Token"],
  ["baidu_api_key", "百度 OCR API Key"],
  ["elevenlabs_api_key", "ElevenLabs API Key"],
];
export function PublicSettings({ embedded = false }: { embedded?: boolean }) {
  const location = useLocation();
  const t = useT(settingsI18n);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const { show, ToastContainer } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [data, setData] = useState<Data>({});
  const [saved, setSaved] = useState<Data>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, ServiceResult>>(
    {},
  );
  const activeTests = useRef(new Map<string, AbortController>());
  const keyDrafts = useRef<Record<string, string>>({});
  useEffect(() => {
    const running = activeTests.current;
    return () => {
      running.forEach((controller) => controller.abort());
      running.clear();
    };
  }, []);
  const [error, setError] = useState("");
  const apply = (next: Data) => {
    keyDrafts.current = {};
    setSaved(next);
    setData({
      ...next,
      ...Object.fromEntries(secretFields.map(([key]) => [key, ""])),
    });
  };
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getSettings();
      apply(response.data as unknown as Data);
    } catch {
      setError("设置加载失败，请重试。");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const set = (key: string, value: string | number | boolean) =>
    setData((prev) => ({ ...prev, [key]: value }));
  const partner = publicPartners[String(data.partner)];
  const copyProviderLink = async (url = partner?.signup) => {
    if (!url) return;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = url;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        try {
          textarea.select();
          if (!document.execCommand("copy")) throw new Error("Copy failed");
        } finally {
          textarea.remove();
        }
      }
      show({ message: "链接已复制到剪贴板", type: "success" });
    } catch {
      show({ message: "复制失败，请手动复制链接", type: "error" });
    }
  };
  const keyLengths = saved.provider_key_lengths as
    Record<string, number> | undefined;
  const hasSavedKey =
    Number(
      keyLengths?.[String(data.partner)] ??
        (data.partner === saved.partner ? saved.api_key_length : 0),
    ) > 0;
  const siteManagedServices = new Set(
    Array.isArray(saved.site_managed_services)
      ? saved.site_managed_services.map(String)
      : [],
  );
  const managedSecretFields = new Set([
    ...(siteManagedServices.has("mineru") ? ["mineru_token"] : []),
    ...(siteManagedServices.has("baidu") ? ["baidu_api_key"] : []),
  ]);
  const dirty =
    editableFields.some((key) => data[key] !== saved[key]) ||
    secretFields.some(
      ([key]) => !managedSecretFields.has(key) && Boolean(data[key]),
    );
  const selectProvider = (next: string) => {
    keyDrafts.current[String(data.partner)] = String(data.api_key || "");
    setData((prev) => ({
      ...prev,
      partner: next,
      api_key: keyDrafts.current[next] || "",
    }));
  };
  const save = async () => {
    setSaving(true);
    const fields = [
      ...editableFields,
      ...secretFields
        .map(([key]) => key)
        .filter((key) => !managedSecretFields.has(key)),
    ];
    try {
      const response = await apiClient.put(
        "/api/settings",
        Object.fromEntries(
          fields
            .filter((key) => data[key] !== undefined)
            .map((key) => [key, data[key]]),
        ),
      );
      apply(response.data.data);
      show({ message: "设置保存成功", type: "success" });
    } catch {
      show({ message: "设置保存失败，请重试。", type: "error" });
    } finally {
      setSaving(false);
    }
  };
  const reset = () =>
    confirm(
      "将清空你保存的所有 API 提供商密钥及个人配置，其他访客不受影响。",
      () => {
        void performReset();
      },
      { title: "重置个人设置" },
    );
  const performReset = async () => {
    setSaving(true);
    try {
      const response = await apiClient.post("/api/settings/reset");
      apply(response.data.data);
      show({ message: "个人设置已重置", type: "success" });
    } catch {
      show({ message: "重置失败，请重试。", type: "error" });
    } finally {
      setSaving(false);
    }
  };
  const test = async (name: string) => {
    if (activeTests.current.has(name) || saving || dirty) return;
    const controller = new AbortController();
    activeTests.current.set(name, controller);
    const provider =
      name === "mineru-pdf" && siteManagedServices.has("mineru")
        ? "站点 MinerU"
        : name.startsWith("baidu-") && siteManagedServices.has("baidu")
          ? "站点百度"
          : publicPartners[String(saved.partner)]?.name || "";
    const update = (
      status: ServiceResult["status"],
      message: string,
      detail?: string,
    ) => {
      setTestResults((prev) => ({
        ...prev,
        [name]: { status, message, detail, provider },
      }));
    };
    update("running", "正在测试…");
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 600000);
    try {
      const response = (
        await apiClient.post(
          `/api/settings/tests/${name}`,
          {},
          { signal: controller.signal },
        )
      ).data;
      const taskId = response.data?.task_id;
      if (!taskId) throw new Error("服务测试未启动");
      while (!controller.signal.aborted) {
        const response = await apiClient.get(
          `/api/settings/tests/${taskId}/status`,
          { signal: controller.signal },
        );
        const state = response.data.data;
        if (state?.status === "COMPLETED") {
          const result = state.result || {};
          const detail =
            result.reply ||
            result.caption ||
            result.recognized_text ||
            result.content_preview ||
            (result.image_size ? result.image_size.join(" × ") : "");
          update(
            result.success === false ? "error" : "success",
            state.message || result.message || "测试完成",
            String(detail),
          );
          return;
        }
        if (state?.status === "FAILED")
          throw new Error(state.error || "服务测试失败");
        await new Promise<void>((resolve) => {
          const finish = () => {
            clearTimeout(timer);
            controller.signal.removeEventListener("abort", finish);
            resolve();
          };
          const timer = setTimeout(finish, 1500);
          controller.signal.addEventListener("abort", finish, { once: true });
        });
      }
    } catch (e) {
      if (!controller.signal.aborted)
        update("error", e instanceof Error ? e.message : "服务测试失败");
    } finally {
      if (timedOut) update("error", "等待结果超时，请稍后重试。");
      clearTimeout(timeout);
      activeTests.current.delete(name);
    }
  };
  const field = (config: SettingsFieldConfig) => (
    <SettingsField
      key={config.key}
      field={config}
      t={t}
      value={data[config.key] as string | number | boolean}
      placeholder={
        secretFields.some(([key]) => key === config.key) &&
        Number(saved[config.key + "_length"]) > 0
          ? "已保存，留空保持不变"
          : config.placeholder
      }
      onChange={(value) => set(config.key, value)}
    />
  );
  const description = (key: string) => t(`settings.fields.${key}`);
  const providerId = String(data.partner);
  const promotions = ["apimart", "volcengine"].map((id) => ({
    key: id,
    testId: `provider-plan-${id}`,
    active: providerId === id,
    name: t(`settings.providerComparison.${id}.name`),
    tagline: t(`settings.providerComparison.${id}.tagline`),
    suitedFor: t(`settings.providerComparison.${id}.suitedFor`),
    points: [1, 2, 3].map((n) =>
      t(`settings.providerComparison.${id}.point${n}`),
    ),
    cta: t(`settings.providerComparison.${id}.cta`),
    activeLabel: t(`settings.providerComparison.${id}.active`),
    note: "提供商的接口与模型已固定，选择后填写对应 Key 即可。",
    onSelect: () => selectProvider(id),
    href: publicPartners[id]?.signup || "",
    linkLabel: t(`settings.providerComparison.${id}.link`),
  }));
  // Keep the public provider identity and signup URLs while sharing the original guide presentation.
  const guideT: typeof t = (key, params) => {
    if (key === "settings.apiKeyTip.linkLabel") return "Inferera 申请 API Key";
    if (key === "settings.apiKeyHelp.linkLabel") return "访问 Inferera 官网 →";
    if (
      key === "settings.apiKeyHelp.step1" ||
      key === "settings.apimartKeyHelp.step1"
    )
      return `前往 ${partner?.name} 注册或登录：{{link}}`;
    if (key === "settings.apiKeyHelp.step2") return "按平台说明完成充值";
    if (key === "settings.apiKeyHelp.step3")
      return "进入 API Key 管理页面创建密钥";
    if (key === "settings.apiKeyHelp.step4")
      return "复制 API Key，填入本页并保存";
    if (key === "settings.volcengineKeyHelp.step1")
      return "前往 火山 Agent Plan 注册或登录，并订阅服务：";
    return t(key, params);
  };
  const body = (
    <>
      <div className="space-y-8">
        {!embedded && location.state?.needsApiKey && (
          <p
            role="status"
            className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 text-sm"
          >
            请先选择 API 提供商并填写你的 API
            Key。保存后返回首页继续，刚才的输入已保留。
          </p>
        )}
        {!embedded && location.state?.apiVerificationFailed && (
          <p
            role="alert"
            className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3 text-sm"
          >
            API Key 验证失败，请检查所选 API
            提供商、密钥及账户用量后重试。刚才的文字输入已保留。
          </p>
        )}
        {loading ? (
          <p role="status">正在加载个人设置…</p>
        ) : error ? (
          <div role="alert">
            {error}
            <Button onClick={() => void load()}>重试</Button>
          </div>
        ) : (
          <>
            <fieldset disabled={saving} className="min-w-0 space-y-8">
              <SettingsSection
                title="API 配置"
                icon={<Key size={20} />}
                description="选择适合你的 API 提供商，填写自己的 Key 后保存。"
              >
                <div className="space-y-3">
                  <div>
                    <p className="block text-sm font-medium text-gray-700 dark:text-foreground-secondary mb-2">
                      API 提供商
                    </p>
                    <SettingsProviderPicker
                      dismissPromotionOnSelect
                      label="API 提供商"
                      selectedGlobalProvider={providerId}
                      selectGlobalProvider={selectProvider}
                      providerPromotions={promotions}
                      globalProviderSources={[
                        "inferera",
                        "apimart",
                        "volcengine",
                      ]
                        .filter((id) => publicPartners[id])
                        .map((id) => ({
                          value: id,
                          label: publicPartners[id].name,
                          hint:
                            id === "apimart"
                              ? t(
                                  "settings.providerComparison.apimart.providerHint",
                                )
                              : id === "volcengine"
                                ? t("settings.volcenginePromo.providerHint")
                                : undefined,
                        }))}
                    />
                    <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">
                      {partner?.key_hint}。切换 API 提供商后使用各自保存的密钥。
                    </p>
                  </div>
                  <div className="space-y-3 pl-3 border-l-2 border-banana-300 dark:border-banana-600">
                    <div>
                      <Input
                        label="API Key"
                        aria-label="API Key"
                        type="password"
                        autoComplete="new-password"
                        value={String(data.api_key || "")}
                        onChange={(e) => set("api_key", e.target.value)}
                        placeholder={
                          hasSavedKey
                            ? "已保存，留空保持不变"
                            : "输入该 API 提供商的 API Key"
                        }
                      />
                      <p className="mt-1 text-sm text-gray-500 dark:text-foreground-tertiary">
                        留空则保持当前设置不变，输入新值则更新
                      </p>
                    </div>
                  </div>
                </div>
                <SettingsApiGuidance
                  t={guideT}
                  usesVolcengineCampaignPromo={providerId === "volcengine"}
                  providerFormat={providerId}
                  volcengineAgentPlansUrl={
                    publicPartners.volcengine?.signup || ""
                  }
                  volcengineLogoUrl="/volcengine/huoshan.png"
                  isZh
                  activeVolcenginePromoKey="settings.volcenginePromo"
                  activeApiKeyHelpKey={
                    providerId === "volcengine"
                      ? "settings.volcengineKeyHelp"
                      : providerId === "apimart"
                        ? "settings.apimartKeyHelp"
                        : "settings.apiKeyHelp"
                  }
                  activeApiKeyTipKey={
                    providerId === "apimart"
                      ? "settings.apimartApiKeyTip"
                      : "settings.apiKeyTip"
                  }
                  activeApiKeyHelpUrl={partner?.signup || ""}
                  copyToClipboard={(url) => {
                    void copyProviderLink(url);
                  }}
                />
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <Lock size={14} />
                  你的密钥仅用于你的请求，不会与其他访客共享。
                </p>
              </SettingsSection>
              {!siteManagedServices.has("mineru") && (
                <SettingsSection
                  title={t("settings.sections.mineruConfig")}
                  icon={<FileText size={20} />}
                >
                  {field({
                    key: "mineru_token",
                    label: "MinerU Token",
                    type: "password",
                    placeholder: "输入 MinerU Token",
                    description: description("mineruTokenDesc"),
                    link: "https://mineru.net/apiManage/token",
                  })}
                </SettingsSection>
              )}
              <SettingsSection
                title={t("settings.sections.imageConfig")}
                icon={<Image size={20} />}
              >
                {field({
                  key: "image_resolution",
                  label: "图像清晰度",
                  type: "select",
                  options: ["1K", "2K", "4K"].map((value) => ({
                    value,
                    label: `${value} (${Number(value[0]) * 1024}px)`,
                  })),
                  description: description("imageResolutionDesc"),
                })}
                {field({
                  key: "image_aspect_ratio",
                  label: "默认图像比例",
                  type: "select",
                  options: ASPECT_RATIO_OPTIONS,
                  description: "创建新项目时使用的默认图片比例。",
                })}
                {field({
                  key: "enable_image_quality_control",
                  label: "图像质量检查",
                  type: "switch",
                  description: description("enableImageQualityControlDesc"),
                })}
              </SettingsSection>
              <SettingsSection
                title={t("settings.sections.outputLanguage")}
                icon={<Globe size={20} />}
              >
                {field({
                  key: "output_language",
                  label: "输出语言",
                  type: "buttons",
                  options: [
                    { value: "zh", label: "简体中文" },
                    { value: "en", label: "English" },
                    { value: "ja", label: "日本語" },
                    { value: "auto", label: "自动" },
                  ],
                  description: description("defaultOutputLanguageDesc"),
                })}
              </SettingsSection>
              {!siteManagedServices.has("baidu") && (
                <SettingsSection
                  title={t("settings.sections.baiduOcr")}
                  icon={<FileText size={20} />}
                >
                  {field({
                    key: "baidu_api_key",
                    label: "百度 OCR API Key",
                    type: "password",
                    placeholder: "输入 百度 OCR API Key",
                    description: description("baiduOcrApiKeyDesc"),
                    link: "https://console.bce.baidu.com/iam/#/iam/apikey/list",
                  })}
                </SettingsSection>
              )}
              <SettingsSection
                title={t("settings.sections.elevenlabs")}
                icon={<Volume2 size={20} />}
              >
                {field({
                  key: "elevenlabs_api_key",
                  label: "ElevenLabs API Key",
                  type: "password",
                  placeholder: "输入 ElevenLabs API Key",
                  description: description("elevenLabsApiKeyDesc"),
                  link: "https://elevenlabs.io/app/settings/api-keys",
                })}
                {field({
                  key: "elevenlabs_enabled",
                  label: "启用 ElevenLabs 视频配音",
                  type: "switch",
                })}
                {field({
                  key: "elevenlabs_voice_id",
                  label: "ElevenLabs Voice ID",
                  type: "text",
                })}
              </SettingsSection>
              <SettingsAdvanced
                open={advancedOpen}
                onToggle={() => setAdvancedOpen(!advancedOpen)}
                label="高级设置"
              >
                <SettingsSection
                  title={t("settings.sections.performanceConfig")}
                  icon={<Zap size={20} />}
                >
                  {field({
                    key: "description_generation_mode",
                    label: "描述生成模式",
                    type: "select",
                    options: [
                      { value: "streaming", label: "流式" },
                      { value: "parallel", label: "并行" },
                    ],
                  })}
                  {[
                    [
                      "max_description_workers",
                      "描述生成最大并发数",
                      "maxDescriptionWorkersDesc",
                    ],
                    [
                      "max_image_workers",
                      "图像生成最大并发数",
                      "maxImageWorkersDesc",
                    ],
                  ].map(([key, label, hint]) =>
                    field({
                      key,
                      label,
                      type: "number",
                      min: 1,
                      max: 20,
                      description: description(hint),
                    }),
                  )}
                </SettingsSection>
                <SettingsSection
                  title={t("settings.sections.textReasoning")}
                  icon={<Brain size={20} />}
                >
                  {field({
                    key: "enable_text_reasoning",
                    label: "文本推理模式",
                    type: "switch",
                    description: description("enableTextReasoningDesc"),
                  })}
                  {Boolean(data.enable_text_reasoning) &&
                    field({
                      key: "text_thinking_budget",
                      label: "文本推理预算",
                      type: "number",
                      min: 1,
                      max: 8192,
                      description: description("textThinkingBudgetDesc"),
                    })}
                </SettingsSection>
                <SettingsSection
                  title={t("settings.sections.imageReasoning")}
                  icon={<Brain size={20} />}
                >
                  {field({
                    key: "enable_image_reasoning",
                    label: "图像推理模式",
                    type: "switch",
                    description: description("enableImageReasoningDesc"),
                  })}
                  {Boolean(data.enable_image_reasoning) &&
                    field({
                      key: "image_thinking_budget",
                      label: "图像推理预算",
                      type: "number",
                      min: 1,
                      max: 8192,
                      description: description("imageThinkingBudgetDesc"),
                    })}
                </SettingsSection>
              </SettingsAdvanced>
            </fieldset>
            <SettingsSection
              title="服务测试"
              icon={<FileText size={20} />}
              description={t("settings.serviceTest.description")}
            >
              {siteManagedServices.size > 0 && (
                <p
                  data-testid="site-managed-services"
                  className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-300"
                >
                  {siteManagedServices.has("mineru") &&
                  siteManagedServices.has("baidu")
                    ? "MinerU 解析、百度 OCR 与百度图像修复由站点提供，无需填写凭据。"
                    : siteManagedServices.has("mineru")
                      ? "MinerU 解析由站点提供，无需填写凭据。"
                      : "百度 OCR 与百度图像修复由站点提供，无需填写凭据。"}
                </p>
              )}
              <div className="pl-4 border-l-4 border-yellow-300 dark:border-yellow-600">
                <p className="text-sm text-gray-700 dark:text-foreground-secondary flex items-start gap-1.5">
                  <Lightbulb size={15} className="flex-shrink-0 mt-0.5" />
                  使用已保存的配置。各项可同时运行，结果独立显示；图像生成可能需要数分钟，最长等待
                  10 分钟。
                </p>
              </div>
              {dirty && (
                <p
                  role="status"
                  className="text-sm text-amber-700 dark:text-amber-400"
                >
                  设置有未保存的修改，请先保存后再开始新测试。已运行的测试继续使用启动时的配置。
                </p>
              )}
              <div className="space-y-4">
                {services.map(([name, label]) => {
                  const result = testResults[name];
                  const running = result?.status === "running";
                  const hintKeys: Record<string, string> = {
                    "text-model": "textModel",
                    "caption-model": "captionModel",
                    "image-model": "imageModel",
                    "mineru-pdf": "mineruPdf",
                    "baidu-ocr": "baiduOcr",
                    "baidu-inpaint": "baiduInpaint",
                  };
                  return (
                    <SettingsServiceRow
                      key={name}
                      testId={`service-test-${name}`}
                      title={label}
                      description={t(
                        `settings.serviceTest.tests.${hintKeys[name]}.description`,
                      )}
                      action={
                        <Button
                          variant="secondary"
                          size="sm"
                          aria-label={
                            running ? `正在测试${label}…` : `测试${label}`
                          }
                          disabled={running || saving || dirty}
                          onClick={() => void test(name)}
                        >
                          {running ? "测试中…" : "开始测试"}
                        </Button>
                      }
                    >
                      {result && (
                        <div
                          role="status"
                          className={`text-sm ${result.status === "error" ? "text-red-600" : result.status === "success" ? "text-green-600" : "text-gray-500"}`}
                        >
                          <p>
                            {result.provider} · {result.message}
                          </p>
                          {result.detail && (
                            <p className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-words">
                              {result.detail}
                            </p>
                          )}
                        </div>
                      )}
                    </SettingsServiceRow>
                  );
                })}
              </div>
            </SettingsSection>
            <SettingsActions>
              <Button
                variant="secondary"
                icon={<RotateCcw size={18} />}
                onClick={() => void reset()}
                disabled={saving}
              >
                重置设置
              </Button>
              <Button
                icon={<Save size={18} />}
                onClick={() => void save()}
                disabled={saving}
              >
                {saving ? "正在保存…" : "保存设置"}
              </Button>
            </SettingsActions>
          </>
        )}
      </div>
      <ToastContainer />
      {ConfirmDialog}
    </>
  );
  return embedded ? (
    body
  ) : (
    <SettingsPageFrame
      title="个人设置"
      subtitle="配置你的 API 与生成参数，其他访客不受影响"
    >
      {body}
    </SettingsPageFrame>
  );
}
