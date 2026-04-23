export type LegalSection = {
  id: string;
  title: string;
  summary?: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalDocument = {
  slug: 'privacy' | 'terms';
  title: string;
  eyebrow: string;
  lead: string;
  intro: string;
  lastUpdatedLabel: string;
  lastUpdatedValue: string;
  tocLabel: string;
  factsLabel: string;
  facts: string[];
  sections: LegalSection[];
};

export type LegalLocale = {
  brand: string;
  tagline: string;
  home: string;
  openApp: string;
  back: string;
  serviceMode: string;
  switchTerms: string;
  switchPrivacy: string;
  note: string;
  privacy: LegalDocument;
  terms: LegalDocument;
};

export const legalContent: Record<'zh' | 'en', LegalLocale> = {
  zh: {
    brand: 'Banana Slides',
    tagline: 'Vibe your slides like Vibe Coding',
    home: '返回首页',
    openApp: '进入应用',
    back: '返回',
    serviceMode: '托管版 SaaS',
    switchTerms: '服务条款',
    switchPrivacy: '隐私政策',
    note: '以下页面按当前 Banana Slides SaaS 的实际功能编写，重点覆盖账号、文件上传、AI 生成、积分购买与可编辑 PPTX 导出。',
    privacy: {
      slug: 'privacy',
      title: '隐私政策',
      eyebrow: 'PRIVACY POLICY',
      lead: '本政策说明 Banana Slides 在您使用官网、Web 应用、API 及相关服务时如何收集、使用、共享、存储和处理与您有关的信息。',
      intro: '当您访问、注册、登录、上传文件、生成内容、购买积分、导出文件或以其他方式使用 Banana Slides 时，即表示您已阅读并理解本政策。除非另有明确说明，本政策中的“Banana Slides”“我们”均指该 SaaS 服务的运营方及其受托服务提供者。',
      lastUpdatedLabel: '最后更新',
      lastUpdatedValue: '2026 年 3 月 29 日',
      tocLabel: '页面目录',
      factsLabel: '重点摘要',
      facts: [
        '我们会处理账号信息、设备与日志信息、支付订单信息，以及您主动提交到服务中的提示词、文档、图片、项目内容和生成结果。',
        '为提供、维护、安全防护、排障、计费、风控和改进服务，您授权我们及代表我们处理数据的第三方服务商对上述内容进行必要的存储、传输、解析、转换和分析。',
        '除为履行服务、完成支付、满足法律要求、打击滥用或保护权利所必需外，我们不会出售您的个人信息。',
      ],
      sections: [
        {
          id: 'scope',
          title: '1. 适用范围',
          paragraphs: [
            '本政策适用于 Banana Slides 托管版 SaaS 服务，包括官网、注册登录流程、项目编辑器、文件上传、AI 生成、积分系统、支付流程、导出服务、通知邮件以及与之直接相关的支持沟通。',
            '本政策不适用于第三方网站、支付渠道、模型服务商或外部链接页面。您访问这些第三方服务时，还应同时遵守其各自的隐私政策和使用规则。',
          ],
        },
        {
          id: 'collect',
          title: '2. 我们收集的信息',
          bullets: [
            '账号与身份信息：邮箱、用户名、登录凭证、邮箱验证状态、密码重置令牌、最近登录时间、账户创建时间及与账户安全相关的信息。',
            '项目与内容信息：您输入的主题、提示词、大纲、描述、页面内容、素材说明、模板风格、上传的文档与图片、生成的中间结果、导出的文件及相关元数据。',
            '交易与订单信息：积分套餐、订单编号、支付渠道、支付状态、支付金额、币种、交易时间及与风控、对账、售后相关的信息。完整支付卡信息通常由支付服务商自行处理，我们不直接保存第三方支付机构要求保管的全部敏感支付凭据。',
            '设备与日志信息：IP 地址、浏览器与设备信息、操作系统、语言、访问时间、请求日志、错误日志、性能数据、Cookies、本地存储标识符及反滥用记录。',
            '沟通信息：您通过邮件、工单、反馈表单、社区或其他渠道发送给我们的意见、问题、截图、附件与往来记录。',
          ],
        },
        {
          id: 'use',
          title: '3. 我们如何使用信息',
          bullets: [
            '提供账号注册、登录认证、邮件验证、密码找回与账户安全控制。',
            '处理您上传的资料、调用模型与解析能力，完成大纲生成、页面描述生成、图片生成、素材解析、局部重绘、可编辑 PPTX 导出等核心功能。',
            '计算、扣减、赠送、补发或回退积分，创建订单，完成支付回调、对账、财务审计与风控。',
            '维护服务稳定性，进行故障排查、性能优化、容量规划、安全监测、反作弊、反刷量、反滥用与争议处理。',
            '改进产品体验、功能设计、模型调用策略、质量评估与运营决策；为此我们可能对日志、输入内容、输出结果和使用行为进行人工抽检或自动化分析。',
            '在法律允许或要求的范围内，履行法定义务、回应执法或司法请求、主张或防御法律权利。',
          ],
        },
        {
          id: 'basis',
          title: '4. 处理依据与您的授权',
          paragraphs: [
            '在适用法律要求我们说明处理依据的情况下，我们通常基于以下一种或多种依据处理信息：履行与您之间的合同、遵守法律义务、保护我们或他人的合法权益、为运营和改进服务所需的正当利益，以及在特定场景下取得您的同意。',
            '就您主动提交到服务中的文本、文档、图片、页面内容、提示词、生成结果及相关元数据，您授予我们一项非独占、全球范围、可转授权、免版税的许可，用于存储、复制、传输、缓存、格式转换、解析、索引、展示、生成衍生中间结果，并在提供、维护、安全防护、排障、风控、合规与改进服务所必需的范围内进行处理。',
          ],
        },
        {
          id: 'share',
          title: '5. 我们如何共享信息',
          bullets: [
            '与基础设施和托管服务商共享：用于服务器托管、对象存储、邮件发送、日志监控、内容分发和备份恢复。',
            '与模型、OCR、解析和其他技术供应商共享：用于完成 AI 生成、图像处理、文件解析、表格识别、内容提取等您主动触发的功能。',
            '与支付及风控服务商共享：用于创建订单、确认支付状态、打击欺诈、处理退款或争议。',
            '与专业顾问、审计机构、执法机关或法院共享：在符合法律要求、保护权利或处理交易、纠纷、合规事项时。',
            '在发生合并、收购、资产转让、重组、融资或类似交易时，我们可能在合理必要范围内转移相关数据。',
          ],
          paragraphs: [
            '我们不会将您的个人信息出售给第三方，也不会无关地向第三方披露您的项目内容；但为完成您所请求的服务，第三方受托处理是服务运行的一部分。',
          ],
        },
        {
          id: 'retention',
          title: '6. 保存期限',
          paragraphs: [
            '我们会在实现本政策所述目的所必需的期限内保存信息，并可在合理必要范围内继续保存备份、副本、日志和审计记录，以履行法律义务、解决争议、执行协议、进行安全取证、恢复灾备或防止欺诈与滥用。',
            '即使您删除部分内容或停止使用服务，缓存、日志、备份或异步任务中的副本也可能在一段合理期间内继续存在，并在后续滚动覆盖或清理流程中删除。',
          ],
        },
        {
          id: 'cookies',
          title: '7. Cookies、本地存储与跟踪技术',
          paragraphs: [
            '我们会使用 Cookies、本地存储和类似技术维持登录状态、记住语言与界面偏好、保障安全、统计错误、优化性能并支持基础运营功能。禁用这些技术后，部分功能可能不可用或体验下降。',
            '目前我们不承诺对所有浏览器的“Do Not Track”信号作出统一响应；如未来支持特定机制，我们会通过更新本政策或站内说明予以公告。',
          ],
        },
        {
          id: 'security',
          title: '8. 数据安全',
          paragraphs: [
            '我们会采取与服务阶段、数据类型和运营规模相适应的技术与组织安全措施，例如访问控制、凭证保护、日志审计、备份、最小权限和安全监测等。',
            '但任何互联网传输、第三方依赖或电子存储方案都无法保证绝对安全；因此，我们不能承诺所有数据在任何情况下都不会被访问、披露、篡改、丢失或滥用。',
          ],
        },
        {
          id: 'rights',
          title: '9. 您的权利与选择',
          bullets: [
            '您可以通过账户设置或服务内功能更新部分账号资料。',
            '您可以停止使用服务；如适用法律赋予您访问、更正、删除、限制处理、数据可携、撤回同意或提出异议等权利，您可向我们提出请求。',
            '为保护账户安全、遵守法律义务、保护他人权利、防止欺诈滥用或因技术限制、备份恢复需求所致，我们可能无法在所有情况下完全满足您的请求。',
            '若您所在地区法律要求提供特定补充披露或权利机制，则我们在适用范围内按该等强制性法律执行。',
          ],
        },
        {
          id: 'transfer',
          title: '10. 跨境处理',
          paragraphs: [
            'Banana Slides 所依赖的云服务、模型服务、邮件服务、日志服务和支付服务可能位于您所在国家或地区之外，因此您的信息可能在不同司法辖区被传输、存储或处理。',
            '当适用法律要求采取额外保护措施时，我们会在合理可行范围内采取相应安排；但不同法域的数据保护标准可能并不完全一致。',
          ],
        },
        {
          id: 'children',
          title: '11. 未成年人',
          paragraphs: [
            '本服务原则上面向具备完全民事行为能力或已获得有效监护人授权的用户。若您属于适用法律下的未成年人，请在监护人同意与指导下使用本服务。',
            '若我们发现未在必要授权前提下收集了未成年人的个人信息，我们可能采取删除、限制处理或关闭相关账户等措施。',
          ],
        },
        {
          id: 'changes',
          title: '12. 政策更新',
          paragraphs: [
            '我们可根据产品变化、运营安排、法律合规要求或风险控制需要不时更新本政策。更新后的版本将在本页面公布，并以页面所载“最后更新”日期为准。',
            '如更新内容依法需要取得您的同意或以其他方式通知您，我们会按适用法律采取相应措施。若您在更新生效后继续使用服务，通常将被视为接受更新后的政策。',
          ],
        },
        {
          id: 'contact',
          title: '13. 联系我们',
          paragraphs: [
            '与隐私相关的请求、通知或投诉，您可以通过服务中公示的联系方式与我们联系。当前联系邮箱为 anionex@qq.com；若运营方后续在官网、控制台或法律页面公示了新的联系地址，则以后者为准。',
          ],
        },
      ],
    },
    terms: {
      slug: 'terms',
      title: '服务条款',
      eyebrow: 'TERMS OF SERVICE',
      lead: '本条款约束您对 Banana Slides 托管版 SaaS 服务的访问与使用，包括账号系统、AI 生成、文件上传、积分购买、导出与相关网站页面。',
      intro: '请在使用前仔细阅读本条款。注册账号、购买积分、上传资料或继续使用服务，即表示您与 Banana Slides 的运营方之间已成立具有约束力的协议，并同意接受本条款及其后续更新的约束。',
      lastUpdatedLabel: '最后更新',
      lastUpdatedValue: '2026 年 3 月 29 日',
      tocLabel: '页面目录',
      factsLabel: '重点摘要',
      facts: [
        '您保留对自身输入内容依法享有的权利，但为运行、维护和改进服务，必须授予我们处理这些内容的必要许可。',
        'AI 输出可能存在错误、遗漏、侵权风险或不适用情况；您应在公开发布、汇报、对外分发或商业使用前自行审查。',
        '积分、订单和付费功能默认按现状提供，除非法律另有要求或我们另行书面承诺，已完成的订单和已发放的积分通常不支持退款。',
        '我们可基于运营、安全、合规或产品调整需要随时修改、限制、中止或下线全部或部分服务，并可对滥用账户采取冻结、限流或终止措施。',
      ],
      sections: [
        {
          id: 'acceptance',
          title: '1. 接受条款与适用对象',
          paragraphs: [
            '您必须具备订立具有法律约束力协议的资格，或在获得有效授权的情况下代表组织使用本服务。若您代表组织使用，则您声明并保证自己有权使该组织受本条款约束。',
            '若您不同意本条款的任何部分，请不要访问、注册、购买或使用 Banana Slides。',
          ],
        },
        {
          id: 'service',
          title: '2. 服务内容与变更',
          paragraphs: [
            'Banana Slides 提供的服务包括但不限于：注册与登录、积分系统、主题转大纲、逐页描述生成、图片生成、素材上传与解析、局部重绘、项目管理、导出普通或可编辑 PPTX，以及与此相关的网页、接口、通知和支持能力。',
            '我们可以基于商业安排、技术路线、成本结构、风险控制、可用性、合规义务或第三方依赖变化，随时新增、修改、限制、替换、暂停或下线任何功能、套餐、额度、模型、接口、参数、价格或可用范围，且无义务持续提供完全相同的版本。',
          ],
        },
        {
          id: 'account',
          title: '3. 账号与安全',
          bullets: [
            '您应提供真实、准确、完整并保持更新的注册信息。',
            '您应妥善保管登录凭证，对以您账号发生的活动承担责任，但法律明确另有规定的除外。',
            '若您发现账号被盗用、存在异常访问或其他安全事件，应立即通知我们并及时采取修改密码等措施。',
            '我们可以拒绝、限制、冻结或终止可疑、重复、批量注册、冒名、机器人、欺诈、绕过风控或其他存在安全风险的账号。',
          ],
        },
        {
          id: 'content',
          title: '4. 用户内容与授权',
          paragraphs: [
            '您对自己提交到服务中的文本、提示词、文档、图片、品牌资产、演示稿材料、导出文件及其他内容负责，并保证您已取得上传、处理、生成、展示、修改、导出和分发这些内容所需的全部权利、许可和授权。',
            '在您与我们之间，除本条款明确授予我们的权利外，您保留对用户内容依法享有的权利；但您授予我们一项非独占、全球范围、可转授权、免版税的许可，用于托管、复制、缓存、传输、存储、格式转换、解析、索引、展示、修改、衍生中间结果生成，以及为提供、维护、调试、安全防护、风控、合规和改进服务所必需的其他处理。',
            '如我们合理认为相关内容违法、侵权、含敏感或受限数据、带来合规风险、造成系统不稳定或违反本条款，我们可拒绝处理、限制访问、删除、屏蔽或保留必要证据，而无需事先承担通知义务。',
          ],
        },
        {
          id: 'acceptable-use',
          title: '5. 禁止行为',
          bullets: [
            '上传、生成、传播违法、侵权、诽谤、骚扰、欺诈、恶意代码、绕过风控、侵犯隐私或其他有害内容。',
            '上传您无权处理的保密资料、商业秘密、个人敏感信息或受法律、合同限制的数据，除非您已自行取得充分授权并承担相应风险。',
            '逆向工程、抓取、镜像、超量调用、规避额度限制、批量注册、转售账号、转售积分、转租服务、滥用接口或干扰服务稳定运行。',
            '利用本服务生成误导性、虚假或高风险内容并在缺乏人工审查的情况下对外使用，尤其是在法律、医疗、金融、招聘、教育评分、安全关键或其他高风险场景。',
          ],
        },
        {
          id: 'ai-output',
          title: '6. AI 输出与人工审查义务',
          paragraphs: [
            'Banana Slides 使用第三方模型、解析能力和自动化流水线生成内容。AI 输出可能不准确、不完整、存在事实错误、排版错误、版权风险、商标风险、风格偏差、幻觉、偏见或不符合您的业务目的。',
            '您有义务在公开展示、客户交付、课堂使用、商业发行、对外传播或提交给第三方前，独立审查并决定是否采用相关输出。我们不保证输出一定可用、可商用、可获知识产权保护或不会侵犯第三方权利。',
          ],
        },
        {
          id: 'payments',
          title: '7. 积分、付费、订单与退款',
          bullets: [
            '积分是您在服务内使用特定功能的有限许可，不是法定货币、储值卡、银行存款、证券或可自由流通财产，不产生利息，也不得在未经我们明确允许的情况下转让、兑现或转售。',
            '我们可随时调整积分价格、套餐内容、赠送规则、功能消耗规则、支付方式、限购政策和活动规则；变更通常仅对后续订单生效。',
            '订单一经创建并进入支付流程，即可能受到支付渠道、风控规则和第三方条款约束。因支付渠道失败、风控拦截、用户操作错误、网络异常或第三方服务问题导致的延迟、失败或重复通知，我们会在合理范围内处理，但不对第三方系统本身负责。',
            '除非适用法律另有要求，或我们另行书面承诺，已支付订单、已发放积分、已消耗积分及已完成的服务默认不予退款。涉嫌欺诈、拒付、盗刷、洗钱、滥用活动、倒卖或其他异常行为的，我们可冻结、扣回或作废相关积分与权益。',
            '促销积分、赠送积分、补偿积分、测试额度或邀请奖励，可按照活动说明、系统规则或风控判断被限制使用、单独设置有效条件，或在发现异常时被取消。',
          ],
        },
        {
          id: 'open-source',
          title: '8. 开源代码与托管服务的区分',
          paragraphs: [
            'Banana Slides 的部分源代码可能依据 AGPL-3.0 或其他开源许可发布。该等开源许可适用于您对源代码仓库、自托管版本或相关组件的使用、复制、修改和分发。',
            '本条款仅适用于 Banana Slides 托管版 SaaS 服务及其商业化运营环境。即使部分代码开源，也不意味着托管服务、账号体系、积分体系、品牌、托管基础设施、线上配置、模型额度、支付能力或运营支持向您开放或转让任何额外权利。',
          ],
        },
        {
          id: 'ip',
          title: '9. 我们的知识产权',
          paragraphs: [
            '服务本身及其中的界面、品牌、商标、域名、代码、页面设计、流程设计、数据库结构、运营内容和文档，除用户内容与第三方内容外，均由我们或我们的许可方拥有并保留全部权利。',
            '在遵守本条款的前提下，我们授予您一项有限的、可撤销的、不可转让、不可再许可的权利，仅用于按服务预期方式访问和使用 Banana Slides。',
          ],
        },
        {
          id: 'third-party',
          title: '10. 第三方服务',
          paragraphs: [
            '本服务可能依赖第三方模型、云服务、支付渠道、邮件服务、OCR 或文件解析服务。第三方服务的中断、涨价、规则变更、限流、封禁、输出变化或不可用，可能导致 Banana Slides 的部分功能不可用、效果变化或成本调整。',
            '第三方服务受其自身条款与政策约束。我们不对第三方独立提供的产品、网站、内容或行为承担责任。',
          ],
        },
        {
          id: 'termination',
          title: '11. 暂停与终止',
          paragraphs: [
            '您可以随时停止使用服务。我们可在不承担责任的前提下，基于违约、风险控制、系统安全、合规要求、第三方限制、争议处理、拖欠费用、欺诈嫌疑、长时间闲置或运营策略调整，随时限制、暂停或终止您访问全部或部分服务。',
            '终止后，您对服务的访问权将立即停止，但条款中按其性质应继续有效的条款仍持续有效，包括但不限于付款、知识产权、授权、免责、责任限制、赔偿、争议解决和数据保留相关条款。',
          ],
        },
        {
          id: 'disclaimer',
          title: '12. 免责声明',
          paragraphs: [
            '在适用法律允许的最大范围内，Banana Slides 及其全部功能按“现状”“可用时”提供。我们不作任何明示、默示或法定保证，包括但不限于适销性、特定用途适用性、非侵权性、连续可用性、无错误、无病毒、结果准确性、结果完整性或满足您预期业务目标的保证。',
            '我们不保证服务不会中断、不会被攻击、不会出现延迟、不会丢失数据，也不保证任何输出一定符合演讲、教学、投标、商业化、合规或审美要求。',
          ],
        },
        {
          id: 'liability',
          title: '13. 责任限制',
          paragraphs: [
            '在适用法律允许的最大范围内，对于因使用或无法使用 Banana Slides 引起的任何间接、附带、特殊、惩罚性或后果性损失，以及利润损失、商誉损失、数据损失、业务中断、替代采购成本或第三方索赔，我们不承担责任，即使我们已被告知此类损失可能发生。',
            '在适用法律允许的最大范围内，我们因本条款或服务引起的累计赔偿责任总额，不超过相关索赔发生前十二个月内您实际向我们支付的服务费用；如您在该期间内未向我们支付任何费用，则我们的累计责任上限为人民币 100 元。',
          ],
        },
        {
          id: 'indemnity',
          title: '14. 赔偿',
          paragraphs: [
            '若因您的内容、您的使用行为、您违反本条款、您侵犯任何第三方权利或您违反适用法律，导致我们、关联方、管理人员、员工、合作方或服务商遭受索赔、调查、损失、责任、处罚、成本和费用（包括合理律师费），您应予以赔偿并使其免受损害。',
          ],
        },
        {
          id: 'law',
          title: '15. 法律适用与争议解决',
          paragraphs: [
            '本条款的解释、效力、履行以及与本服务相关的争议，应在适用法律允许的范围内依照服务运营方所选择并公示的规则处理；如适用法律存在强制性要求，则以该等强制性要求为准。',
            '因本条款或服务引起或与之相关的争议，双方应先友好协商处理；如协商未果，则按届时适用的强制性法律、平台规则或运营方公示的争议处理机制执行。',
          ],
        },
        {
          id: 'misc',
          title: '16. 其他',
          bullets: [
            '隐私政策、支付页面规则、活动规则、功能说明、价格页面说明以及我们在服务中另行公示的补充条款，均构成本条款的一部分。',
            '若本条款某一部分被认定无效或不可执行，不影响其余部分的效力。',
            '我们未行使或延迟行使任何权利，不构成对该权利的放弃。',
            '我们可以在发生重组、并购、资产转让或同类交易时转让本条款项下的权利义务；未经我们书面同意，您不得转让本条款项下的权利义务。',
          ],
        },
      ],
    },
  },
  en: {
    brand: 'Banana Slides',
    tagline: 'Vibe your slides like Vibe Coding',
    home: 'Home',
    openApp: 'Open App',
    back: 'Back',
    serviceMode: 'Hosted SaaS',
    switchTerms: 'Terms',
    switchPrivacy: 'Privacy',
    note: 'These pages are written against the current Banana Slides SaaS flow, with coverage for accounts, uploads, AI generation, credits, payments, and editable PPTX export.',
    privacy: {
      slug: 'privacy',
      title: 'Privacy Policy',
      eyebrow: 'PRIVACY POLICY',
      lead: 'This Policy explains how Banana Slides collects, uses, shares, stores, and otherwise processes information about you when you use our website, web application, APIs, and related services.',
      intro: 'By visiting, registering for, logging into, uploading files to, generating content with, purchasing credits from, exporting files from, or otherwise using Banana Slides, you acknowledge that you have read and understood this Policy. Unless we state otherwise, “Banana Slides,” “we,” and “our” refer to the operator of the hosted SaaS service and its service providers acting on its behalf.',
      lastUpdatedLabel: 'Last updated',
      lastUpdatedValue: 'March 29, 2026',
      tocLabel: 'On this page',
      factsLabel: 'Quick facts',
      facts: [
        'We process account information, device and log data, order and payment records, and the prompts, files, project content, and outputs you submit to the Service.',
        'To provide, maintain, secure, troubleshoot, bill, enforce, and improve the Service, you authorize us and our processors to store, transmit, parse, transform, and analyze that data as reasonably necessary.',
        'We do not sell personal information except as otherwise required or permitted by law; however, sharing with infrastructure, model, payment, and other technical providers is part of how the Service operates.',
      ],
      sections: [
        {
          id: 'scope',
          title: '1. Scope',
          paragraphs: [
            'This Policy applies to the hosted Banana Slides SaaS, including our website, registration and login flows, project editor, file uploads, AI generation features, credits system, payment flow, export features, transactional emails, and directly related support communications.',
            'This Policy does not apply to third-party websites, payment channels, model providers, or external destinations that may be linked from the Service. Those parties operate under their own terms and privacy notices.',
          ],
        },
        {
          id: 'collect',
          title: '2. Information We Collect',
          bullets: [
            'Account and identity data: email address, username, login credentials, email verification status, password reset tokens, last login time, account creation time, and account security information.',
            'Project and content data: topics, prompts, outlines, slide descriptions, page content, style settings, uploaded documents and images, generated outputs, exported files, and related metadata.',
            'Transaction and order data: package selection, order identifiers, payment method, payment status, amounts, currency, timestamps, and records needed for fraud prevention, reconciliation, support, and accounting. Full card or wallet credentials are generally processed by the payment provider rather than stored by us in full.',
            'Device and usage data: IP address, browser and device information, operating system, language, timestamps, request logs, error logs, performance data, cookies, local storage identifiers, and anti-abuse signals.',
            'Communications: messages, attachments, screenshots, feedback, and support history you send to us through email, forms, community channels, or other contact methods.',
          ],
        },
        {
          id: 'use',
          title: '3. How We Use Information',
          bullets: [
            'To register and authenticate accounts, send verification emails, reset passwords, and protect account security.',
            'To process uploads and invoke models and parsing tools so we can generate outlines, slide descriptions, images, material analysis, local edits, and editable PPTX exports.',
            'To calculate, deduct, grant, restore, or refund credits, create and audit orders, process payment callbacks, and manage fraud, disputes, and financial records.',
            'To operate, maintain, secure, debug, monitor, scale, and improve the Service, including abuse detection, quality review, and reliability work.',
            'To analyze usage, logs, prompts, outputs, and system behavior for product, operations, quality, and risk decisions, including manual review where reasonably necessary.',
            'To comply with legal obligations and to establish, exercise, or defend legal claims.',
          ],
        },
        {
          id: 'basis',
          title: '4. Legal Basis and Your Authorization',
          paragraphs: [
            'Where applicable law requires a legal basis, we generally rely on one or more of the following: performance of a contract with you, compliance with legal obligations, our legitimate interests in operating and improving the Service, protection of rights and security, and your consent where specifically requested.',
            'For the text, files, images, prompts, generated outputs, and metadata you submit to the Service, you grant us a non-exclusive, worldwide, sublicensable, royalty-free license to host, copy, cache, transmit, format, parse, index, display, generate intermediate derivatives from, and otherwise process that content as needed to provide, maintain, secure, troubleshoot, enforce, comply with law, and improve the Service.',
          ],
        },
        {
          id: 'share',
          title: '5. How We Share Information',
          bullets: [
            'With infrastructure and hosting providers for servers, storage, email delivery, logging, monitoring, backups, and content delivery.',
            'With model, OCR, parsing, and other technical vendors when needed to perform AI generation, image processing, document parsing, table recognition, or related features you trigger.',
            'With payment and risk vendors to create orders, confirm payment status, prevent fraud, and handle disputes or refunds.',
            'With professional advisers, auditors, courts, regulators, law enforcement, or counterparties when legally required or reasonably necessary to protect rights, complete a transaction, or address a dispute or compliance matter.',
            'As part of a merger, acquisition, financing, restructuring, asset transfer, or similar transaction.',
          ],
          paragraphs: [
            'We do not sell your personal information in the ordinary sense of that term. Still, limited disclosure to processors and service providers is essential to operate the Service.',
          ],
        },
        {
          id: 'retention',
          title: '6. Retention',
          paragraphs: [
            'We retain information for as long as reasonably necessary for the purposes described in this Policy, including to provide the Service, comply with law, keep business and security records, resolve disputes, enforce agreements, support backups, and prevent fraud or abuse.',
            'Even after content is deleted or an account becomes inactive, copies may remain for a reasonable period in caches, logs, backups, archives, or asynchronous processing systems before they are overwritten or purged.',
          ],
        },
        {
          id: 'cookies',
          title: '7. Cookies, Local Storage, and Tracking Technologies',
          paragraphs: [
            'We use cookies, local storage, and similar technologies to keep you signed in, remember language and interface settings, support security, measure errors, improve performance, and provide baseline operational functionality. If you disable them, portions of the Service may not function properly.',
            'We do not currently commit to responding uniformly to browser “Do Not Track” signals. If we adopt a specific DNT response in the future, we may describe it in an updated Policy or a service notice.',
          ],
        },
        {
          id: 'security',
          title: '8. Security',
          paragraphs: [
            'We use technical and organizational safeguards that are appropriate to the stage of the Service, the types of data involved, and our operational scale, such as access controls, credential protection, audit logging, backups, least-privilege practices, and security monitoring.',
            'No internet transmission, third-party dependency, or electronic storage system is perfectly secure. We therefore cannot guarantee that information will never be accessed, disclosed, altered, lost, or misused.',
          ],
        },
        {
          id: 'rights',
          title: '9. Your Rights and Choices',
          bullets: [
            'You may update some account details through the Service.',
            'You may stop using the Service at any time. Where applicable law grants you additional rights, such as access, correction, deletion, restriction, portability, withdrawal of consent, or objection, you may submit a request to us.',
            'We may decline or narrow a request where necessary to protect security, comply with law, protect the rights of others, prevent fraud or abuse, or account for technical limitations, records retention, or backup integrity.',
            'If a local law imposes additional disclosures or rights mechanisms, we will honor those requirements to the extent they apply to us.',
          ],
        },
        {
          id: 'transfer',
          title: '10. International Processing',
          paragraphs: [
            'Banana Slides relies on cloud, model, email, logging, and payment services that may be located outside your country or region. As a result, information may be transferred to, stored in, or processed in other jurisdictions.',
            'Where applicable law requires additional safeguards for cross-border transfers, we will take reasonable steps to implement them, but data protection standards may differ across jurisdictions.',
          ],
        },
        {
          id: 'children',
          title: '11. Children',
          paragraphs: [
            'The Service is intended for users who can form binding agreements or who have appropriate guardian or organizational authorization. If you are a minor under applicable law, use the Service only with proper permission and supervision.',
            'If we learn that we collected personal information from a child without the required authorization, we may delete the information, restrict processing, or close the related account.',
          ],
        },
        {
          id: 'changes',
          title: '12. Changes to This Policy',
          paragraphs: [
            'We may update this Policy from time to time to reflect product changes, operational decisions, legal requirements, or risk-management needs. The updated version will appear on this page with a revised “Last updated” date.',
            'If applicable law requires additional notice or consent for a particular change, we will take the steps required by that law. Your continued use of the Service after an updated Policy becomes effective will generally mean you accept the revised Policy.',
          ],
        },
        {
          id: 'contact',
          title: '13. Contact',
          paragraphs: [
            'For privacy requests, notices, or complaints, you may contact us using the contact method published in the Service. The current contact email is support@bananaslides.online. If the operator later publishes a different legal or support contact on the website, console, or legal pages, that published contact will control.',
          ],
        },
      ],
    },
    terms: {
      slug: 'terms',
      title: 'Terms of Service',
      eyebrow: 'TERMS OF SERVICE',
      lead: 'These Terms govern your access to and use of the hosted Banana Slides SaaS, including the account system, AI generation features, file uploads, credits purchases, exports, and related website pages.',
      intro: 'Please read these Terms carefully before using the Service. By registering an account, purchasing credits, uploading materials, or otherwise accessing or using Banana Slides, you enter into a binding agreement with the Service operator and agree to these Terms, as updated from time to time.',
      lastUpdatedLabel: 'Last updated',
      lastUpdatedValue: 'March 29, 2026',
      tocLabel: 'On this page',
      factsLabel: 'Quick facts',
      facts: [
        'You keep rights you lawfully have in your own inputs, but you must give us the permissions needed to host, process, secure, and improve the Service.',
        'AI outputs can be wrong, incomplete, infringing, or unfit for your purpose. You are responsible for human review before public, classroom, client, or commercial use.',
        'Credits and paid orders are generally final. Unless law requires otherwise or we expressly promise otherwise in writing, completed orders and delivered credits are usually non-refundable.',
        'We may change, limit, suspend, or discontinue features at any time for business, security, legal, or operational reasons, and may act against abusive or risky accounts.',
      ],
      sections: [
        {
          id: 'acceptance',
          title: '1. Acceptance and Eligibility',
          paragraphs: [
            'You must be legally capable of forming a binding agreement, or be validly authorized to act for an organization that is using the Service. If you use the Service on behalf of an organization, you represent and warrant that you have authority to bind that organization.',
            'If you do not agree to these Terms, do not access, register for, purchase, or use Banana Slides.',
          ],
        },
        {
          id: 'service',
          title: '2. Service Description and Changes',
          paragraphs: [
            'Banana Slides includes, among other things, account registration and login, credits, topic-to-outline generation, per-slide description generation, image generation, material uploads and parsing, local edits, project management, standard and editable PPTX export, and associated web pages, APIs, notices, and support tools.',
            'We may add, modify, limit, replace, suspend, or discontinue any feature, package, quota, model, parameter, API, pricing, or availability at any time based on business strategy, technical direction, cost, risk, compliance, third-party changes, or operational needs, and we are not required to keep providing any prior version in the same form.',
          ],
        },
        {
          id: 'account',
          title: '3. Accounts and Security',
          bullets: [
            'You must provide accurate, complete, and up-to-date registration information.',
            'You are responsible for safeguarding your credentials and for activity under your account except where applicable law says otherwise.',
            'You must promptly notify us of suspected unauthorized use, suspicious access, or other security incidents involving your account.',
            'We may refuse, limit, freeze, or terminate accounts that appear fake, duplicated, automated, fraudulent, abusive, evasive of controls, or otherwise risky.',
          ],
        },
        {
          id: 'content',
          title: '4. Your Content and License to Us',
          paragraphs: [
            'You are responsible for the text, prompts, documents, images, brand assets, presentation materials, exported files, and other content you submit to the Service. You represent and warrant that you have all rights, permissions, and authorizations needed to upload, process, generate from, display, edit, export, and distribute that content.',
            'As between you and us, you retain whatever rights you lawfully have in your content, except for the rights you grant us in these Terms. You grant us a non-exclusive, worldwide, sublicensable, royalty-free license to host, copy, cache, transmit, store, format, parse, index, display, modify, generate intermediate derivatives from, and otherwise process your content as necessary to provide, maintain, debug, secure, enforce, comply with law, and improve the Service.',
            'If we reasonably believe content is unlawful, infringing, risky, sensitive, unstable for the system, or in breach of these Terms, we may refuse to process it, restrict access to it, remove it, block it, or preserve evidence relating to it.',
          ],
        },
        {
          id: 'acceptable-use',
          title: '5. Prohibited Conduct',
          bullets: [
            'Uploading, generating, or distributing unlawful, infringing, defamatory, harassing, fraudulent, malicious, privacy-invasive, or otherwise harmful content.',
            'Submitting confidential or regulated information, trade secrets, or personal sensitive data that you are not authorized to process through the Service.',
            'Reverse engineering, scraping, mirroring, excessive calling, circumventing limits, creating accounts in bulk, reselling accounts or credits, sublicensing access, or interfering with Service stability.',
            'Using the Service for legal, medical, financial, hiring, educational scoring, safety-critical, or other high-risk decisions without appropriate human review and responsibility.',
          ],
        },
        {
          id: 'ai-output',
          title: '6. AI Output and Human Review',
          paragraphs: [
            'Banana Slides relies on third-party models, parsers, OCR, and other automated systems. Outputs may contain inaccuracies, omissions, formatting issues, hallucinations, bias, copyright or trademark concerns, or other defects.',
            'You are solely responsible for reviewing outputs before using them in classrooms, client deliverables, public presentations, commercial contexts, or any downstream workflow. We do not guarantee that outputs are accurate, complete, commercially usable, protectable as intellectual property, or non-infringing.',
          ],
        },
        {
          id: 'payments',
          title: '7. Credits, Fees, Orders, and Refunds',
          bullets: [
            'Credits are a limited license to use certain in-service functionality. They are not currency, stored value, bank deposits, securities, or freely transferable property; they do not earn interest and may not be redeemed, resold, or transferred unless we expressly allow it.',
            'We may change credit prices, package contents, bonus rules, feature consumption rules, payment methods, promotional rules, and purchase limits at any time. Changes generally apply prospectively.',
            'Orders may be subject to payment-channel rules, fraud checks, and third-party provider terms. We will reasonably try to address delays or failures, but we are not responsible for payment-provider downtime, network failures, or third-party errors outside our control.',
            'Except where applicable law requires otherwise or we expressly agree in writing, paid orders, delivered credits, consumed credits, and completed services are non-refundable. We may freeze, cancel, claw back, or void credits and benefits associated with suspected fraud, chargebacks, stolen payment methods, abuse, arbitrage, or policy violations.',
            'Promotional, bonus, compensation, testing, or invitation-based credits may have separate conditions or restrictions and may be limited, revoked, or adjusted if abuse or anomalies are detected.',
          ],
        },
        {
          id: 'open-source',
          title: '8. Open-Source Code vs. Hosted Service',
          paragraphs: [
            'Portions of Banana Slides may be made available under AGPL-3.0 or other open-source licenses. Those licenses govern your use, copying, modification, and distribution of the codebase or self-hosted components to the extent they apply.',
            'These Terms govern only the hosted Banana Slides SaaS. The existence of open-source code does not grant you rights to our hosted environment, account system, credits system, brand, configuration, infrastructure, model quotas, payment rails, or operational support unless we expressly say so.',
          ],
        },
        {
          id: 'ip',
          title: '9. Our Intellectual Property',
          paragraphs: [
            'Except for user content and third-party content, the Service and its interface, branding, trademarks, domains, code, design, database structure, documentation, and operational materials are owned by us or our licensors and remain protected by applicable intellectual property laws.',
            'Subject to these Terms, we grant you a limited, revocable, non-transferable, non-sublicensable right to access and use the Service only as intended.',
          ],
        },
        {
          id: 'third-party',
          title: '10. Third-Party Services',
          paragraphs: [
            'The Service may depend on third-party models, cloud infrastructure, payment channels, email providers, OCR systems, and file parsing services. Their outages, pricing changes, policy changes, throttling, blocking, output shifts, or discontinuation can affect Banana Slides.',
            'Third-party services are governed by their own terms and policies. We are not responsible for third-party products, sites, content, or conduct that we do not control.',
          ],
        },
        {
          id: 'termination',
          title: '11. Suspension and Termination',
          paragraphs: [
            'You may stop using the Service at any time. We may, without liability, limit, suspend, or terminate access to some or all of the Service based on breach, abuse, fraud risk, security concerns, legal or regulatory requirements, third-party restrictions, inactivity, unpaid amounts, disputes, or business decisions.',
            'Upon termination, your right to access the Service ends immediately, but provisions that by their nature should survive will remain in effect, including those on payment, intellectual property, licenses, disclaimers, limitation of liability, indemnity, dispute resolution, and data retention.',
          ],
        },
        {
          id: 'disclaimer',
          title: '12. Disclaimers',
          paragraphs: [
            'To the maximum extent permitted by law, Banana Slides is provided “as is” and “as available,” without warranties of any kind, whether express, implied, statutory, or otherwise, including implied warranties of merchantability, fitness for a particular purpose, title, non-infringement, availability, security, or results.',
            'We do not guarantee uninterrupted operation, immunity from attack, freedom from delay, preservation of data, or that any output will meet your presentation, teaching, compliance, commercial, or aesthetic expectations.',
          ],
        },
        {
          id: 'liability',
          title: '13. Limitation of Liability',
          paragraphs: [
            'To the maximum extent permitted by law, we are not liable for any indirect, incidental, special, exemplary, punitive, or consequential damages, or for any loss of profits, goodwill, data, business interruption, replacement costs, or third-party claims arising from or related to the Service, even if advised of the possibility of such damages.',
            'To the maximum extent permitted by law, our aggregate liability for all claims arising out of or relating to these Terms or the Service will not exceed the amount you actually paid us for the Service during the twelve months preceding the event giving rise to the claim, or CNY 100 if you paid us nothing during that period.',
          ],
        },
        {
          id: 'indemnity',
          title: '14. Indemnity',
          paragraphs: [
            'You will defend, indemnify, and hold harmless us, our affiliates, and our personnel, partners, and service providers from and against claims, investigations, liabilities, damages, losses, costs, and expenses (including reasonable attorneys’ fees) arising out of or related to your content, your use of the Service, your breach of these Terms, your violation of law, or your infringement of any third-party rights.',
          ],
        },
        {
          id: 'law',
          title: '15. Governing Law and Disputes',
          paragraphs: [
            'These Terms, their interpretation, performance, and disputes relating to the Service will be handled under the rules selected and published by the Service operator to the extent permitted by applicable law. Any mandatory legal requirement that cannot be waived will control over inconsistent language in these Terms.',
            'Any dispute should first be addressed through good-faith negotiation. If negotiation does not resolve the matter, the dispute will be handled according to then-applicable mandatory law, platform rules, or the dispute-resolution mechanism published by the operator.',
          ],
        },
        {
          id: 'misc',
          title: '16. Miscellaneous',
          bullets: [
            'Our Privacy Policy, pricing page disclosures, promotion rules, feature notices, and any supplemental terms published in the Service form part of these Terms where applicable.',
            'If any provision is held invalid or unenforceable, the remaining provisions remain effective.',
            'A failure or delay by us to enforce any right does not waive that right.',
            'We may assign these Terms in connection with a restructuring, acquisition, financing, or asset transfer. You may not assign your rights or obligations without our prior written consent.',
          ],
        },
      ],
    },
  },
};
