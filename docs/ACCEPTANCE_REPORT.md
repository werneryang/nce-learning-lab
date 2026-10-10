# NCE Learning Lab — 实际验收报告

验收日期：2026-10-09（America/New_York）。依据：用户提供的 Complete Specification v1.1，按 Phase 0 → Phase 1 → Phase 2 实施。本报告区分技术验证、用户实际教材验收及尚未启用的服务。

| §16 交付字段          | 实际结果                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------- |
| Project               | NCE Learning Lab                                                                             |
| Repository URL        | https://github.com/werneryang/nce-learning-lab                                               |
| Branch / Pull Request | `codex/learning-lab`；https://github.com/werneryang/nce-learning-lab/pull/1（Draft，未合并） |
| Live demo URL         | https://werneryang.github.io/nce-learning-lab/                                               |
| AI Tutor status       | `not_configured`；未配置真实 AI 后端、服务认证或模型计费                                     |

## 已实现（Implemented）

- 独立公开代码仓库，已核实账号 `werneryang` 的读取、推送、管理权限；现有个人主页仓库未修改。完整代码在开发分支，默认 main 保留初始化内容，PR 等待用户审阅。
- 第二册前五课目录、原创学习目标、24 个不同义项的候选 Chunk、25 条课程关联及 10 个原创写作/口语任务。
- 真实本地 MP3/LRC 导入与 IndexedDB 保存；播放器支持播放/暂停、进度定位、快退/快进、0.75×/1×/1.25×、句子循环。显示句/行级同步字幕，可隐藏或只显示当前行；切课停止并释放旧资源。原生音频控件作为 Safari 可用入口保留。
- LRC 元数据、Unicode、多时间戳、异常/重复时间与源行号处理；问题、其他文字及未审核片段保持独立。只有用户确认的正文用于原文对照。音频标签 US/UK 由用户明确选择，未伪造口音自动识别。
- 听写、脱稿默写、引导改写；单句、自选片段组/段落、完整已确认正文范围。默写默认隐藏字幕，记忆默写重听需用户主动允许。
- 静默编辑、700 ms 本地防抖保存、手动 Save、Continue Later、刷新恢复。输入、粘贴、输入法组合事件、停顿及失焦不触发 Tutor 请求、不改写文字。
- 用户主动 Hint 的三个层级，按草稿版本重新开始；主动 Review/Revise/Recheck/Finish、每一稿快照、历史及旧版本提示。原文差异按最小 token 插入/删除/替换计算，支持词序与标点分类，WER 的口径公开。改写不按逐字一致度评分。
- 候选词块 Accept/Edit/Merge/Reject、搜索、分类、义项和跨课关联。相同义项跨课复用，同字不同义保留独立卡；既有掌握度不因再次遇见而清空。
- 私人 Mistake Bank 保存、检索、编辑、关联 Chunk、删除；Recognition/Writing/Speaking 独立自评与排程，Again/Hard/Good/Easy，到期队列及进度。
- Speaking 原创任务、用户自行提供的转录/反思、独立 Attempt/自评；浏览器支持时可以用户点击后进行本地 MediaRecorder 录音。没有自动转写或发音评分。
- 校验和及运行时 schema 验证的 JSON 备份/恢复；备份包含私人导入文字、草稿、答题、历史与错题，明确排除 MP3 和录音。恢复为显式替换，清理旧媒体避免错误配对，须重新导入音频。
- 单条写作会话可显式确认删除，同时清理其草稿、反馈、Attempt 和相关错题；其他会话、课程媒体及技能排程保留。也支持单独移除媒体/字幕及清空全部私人数据。
- 响应式页面、键盘入口、减少动态效果设置、GitHub CI 和 Pages 发布；README、数据模型、版权与来源、状态机、Tutor 接口与测试文档。

## 部分实现（Partially implemented）与未实现/阻塞（Not implemented / blocked）

**AI 不可用是明确的条件性限制。** 当前网页的真实功能是本地原文比对和有限规则；英语规则目前只检查明确的 “about to + 动词原形” 问题，不能判定一般语法、意思等价或自然度。合理同义改写只标为原文差异，不冒充已获得语义正确性判断。手动复制到 ChatGPT、主动选择是否包含参考原文、保存用户确认的反馈均可使用。`TutorAdapter`/HTTPS 请求适配器和校验契约已编写；认证、限流、成本上限及服务端密钥管理仅为接入要求，未部署。没有用模板模拟实时 AI。

未实现云同步、FSRS、自动语音转写、真实发音/口音评测、英音素材验证或应用离线缓存；这些属于未授权服务或后续 Phase 3–4 范围。中文开关提供词块释义，未提供完整双语 AI 反馈。

原版教材 MP3 的合法取得与真人朗读集成没有由本次测试代替：用户需在自己的设备上选择有权使用的原文件。iPhone 真机仍未验证。可选麦克风录音没有进行真实设备录音验收。

## 来源与版权处理（Source and copyright treatment）

固定来源：[tangx/New-Concept-English](https://github.com/tangx/New-Concept-English)，commit `635746ac5f696b193311bc1a7e8ffac3b252eb75`。完整树核查未截断：第二册美音目录 96 个 MP3、96 个 LRC；前五课十条精确路径、Git blob SHA、文件大小均已核实。未发现 LICENSE/LICENCE/COPYING 文件，rightsStatus 保持 `unverified`。此结果不是再分发许可。

五个原始 LRC 在仓库外私有核查目录完成实际解析：Lesson 1–5 分别为 18、19、14、13、12 个片段，均无解析警告；问题及未审核片段没有自动归入正文。原始教材文字、音频、PDF 未提交、未部署。公开站点不会自动下载这些资源。

公开代码/产物核查：禁止媒体文件类型、常见凭证模式、过量时间戳模式、Git 历史文件名；并对比五课原始 LRC 的连续三行、超过 100 字符的段落，未在提交文件或 bundle 发现匹配。这是列明范围的核查，不是通用法律许可或无限制秘密扫描。

## 实际测试与浏览器核验（Test commands / Test results / Manual verification）

**验证的运行代码：** `cfcda92166d888028590de9499e3dc56950bdb92`。文档交付在该版本之后提交，不改变运行代码；复用该版本的验证结果。

| 检查                                                    | 实际结果与范围                                                                                                                                                                                                                                 |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                                          | PASS，无 ESLint 错误                                                                                                                                                                                                                           |
| `npm run typecheck`                                     | PASS                                                                                                                                                                                                                                           |
| `NCE_SOURCE_VERIFY_DIR=../source-verification npm test` | 本地 45 passed：44 项核心检查及 1 项五个私人 LRC 的集成检查                                                                                                                                                                                    |
| `npm test`（GitHub CI）                                 | 44 passed、1 skipped；跳过的仅是需要仓库外教材文件的集成检查，不是零问题声明                                                                                                                                                                   |
| `npm run test:e2e`（GitHub CI，FFmpeg 已安装）          | 30 passed：10 个场景 × Chromium desktop / WebKit desktop / iPhone 13 WebKit 模拟；0 failed                                                                                                                                                     |
| 本地 `npm run test:e2e`                                 | 完整回归 27 passed；补充的单会话删除测试 3 passed；最终完整 30 项在 CI 重跑通过                                                                                                                                                                |
| `npm run build`                                         | PASS；两条 Zod 注释提示见下文                                                                                                                                                                                                                  |
| `npm audit`                                             | 0 个已报告漏洞                                                                                                                                                                                                                                 |
| `npm run verify:sources`                                | PASS；重新核对固定来源 commit 的完整树、精确路径、大小及 blob SHA，不下载 MP3                                                                                                                                                                  |
| `npm run scan`（最终运行代码）                          | PASS；48 个已提交路径、3 个构建资产，无禁止媒体、所列凭证模式或完整计时字幕命中                                                                                                                                                                |
| 原始字幕段落与历史扫描                                  | 五课文件、连续三行且超过 100 字符的原文段落：0 个公开文件/构建命中；所有 refs 的历史文件名无 MP3/LRC/PDF 等媒体                                                                                                                                |
| Pages 发布                                              | [实际发布 run 38007193908](https://github.com/werneryang/nce-learning-lab/actions/runs/38007193908) 的 validate 与 deploy 均 success；[PR run 38007197267](https://github.com/werneryang/nce-learning-lab/actions/runs/38007197267) 也 success |
| 正式 HTTPS 验证                                         | 首页、JS、CSS 均 HTTP 200，内容与本地构建逐字节相同；下表保留 SHA-256                                                                                                                                                                          |

| 线上资产             | 字节数 | SHA-256                                                            |
| -------------------- | -----: | ------------------------------------------------------------------ |
| `index-Byzsbalk.js`  | 429371 | `3dff71200530a98106fc99b2d51df05c9689b4a5d1132fb8400a76aad5fc804a` |
| `index-CofSKooh.css` |  16340 | `edba12a772aa183a3ee7a9e115b4961bf817602c9f181a7754b5fd65ac53cd8f` |

交付文档加入后另做范围检查：50 个已提交路径、3 个构建资产，0 个所列资源/凭证/字幕模式命中；五课原文段落核查仍为 0 个匹配。该文档提交不修改运行代码。

**复现命令：** 在开发分支执行 `npm ci`，然后 `npm run lint`、`npm run typecheck`、`npm test`、`npm run build`、`npm run scan`、`npm audit`、`npm run verify:sources`。浏览器测试先执行 `npx playwright install chromium webkit`，安装含 `libmp3lame` 的 FFmpeg，再运行 `npm run test:e2e`。本地使用 `FFMPEG_PATH=<可用编码器路径>`，私人字幕集成使用上表的 `NCE_SOURCE_VERIFY_DIR`；这些文件不会被提交。CI 配置及所有场景见 `.github/workflows/ci-pages.yml`、`tests/core.test.ts`、`tests/source-local.test.ts`、`tests/e2e/learning.spec.ts`。

**规格验收映射：** T01/T03/T07 的缺失和异常输入；T02 的真实音频播放及字幕；T04–T06 的长文本、保存和静默 Hint；T08/T09 的原文差异与英语错误区分；T10 的旧反馈；T11 的修订历史；T12/T13 的跨课去重和独立技能；T14 的备份；T15 的未配置 AI；T16 的恶意文字作为数据；T17 的上述资源扫描；T18 的窄屏及键盘操作。每项测试或手动步骤在 `docs/TEST_PLAN.md` 对应列出。真实 AI 教学评价、原版音频的真人朗读以及 iPhone 真机可用性仍未完成，不计为 PASS。

**原生 Mac Safari，实际 UI 操作（本地运行页面）：** 选择原创 MP3/LRC，观察播放计时推进、字幕/正文确认、点击句子定位；开始听写隐藏字幕，输入完整草稿，点击 Save、Review，得到 1/9 token 差异与支持的规则反馈；自行修改后 Recheck 得到 0/9，Finish，再刷新恢复草稿、隐藏字幕和两次反馈历史。随后在正式 HTTPS 页面实际打开首页和全部五课目录。

**iPhone 尺寸验证：** Playwright WebKit 的 iPhone 13 触控/视口模拟，包含真实 MP3 解码播放、同步/循环、长文本、键盘焦点、无横向溢出、校对、备份恢复。它不是 iPhone 真机 Safari 验收，未把模拟设备结果写成真机兼容认证。

MP3 自动测试使用项目自创 10 秒音频和原创短 LRC；这些是测试输入，生产页面没有模拟播放器或预置教材替代品。五课原 LRC 解析是另外的来源核查；未将原创测试音频冒充教材美音。

## 已知限制及最短下一步（Known issues / Next recommended actions）

- 数据保存在当前浏览器；清理浏览器或存储驱逐可能丢失记录。普通 JSON 包含私人字幕文字，备份应保密；音频需另存原文件，设备间没有自动同步。
- 比对每侧最多 2,000 token；草稿/LRC 文本上限 100,000 字符，MP3 上限 100 MB，备份上限 10 MB。超限/编码/解码/保存错误会明确提示，长课可拆分练习。
- 构建有两条 Zod 依赖注释提示：Rollup 移除不能解释的纯函数注释，构建成功。安装时 ESLint 9 显示维护版本提示；已安装依赖的审计结果为 0 个已报告漏洞。CI 的 GitHub Pages 官方 Action 另有 Node 20/弃用 API 提示，在 runner 的 Node 24 兼容运行下发布成功。这些不代表已做通用安全认证。
- 下一步：在 Mac/iPhone 真机导入用户有权使用的 Lesson 1 原版 MP3/LRC，确认正文并完成一次私人学习与备份；以后选择和授权安全 AI 后端/供应商，再做真实 AI 联调。

技术交付与列明测试完成，不等于用户的教材许可确认、真机人工验收或对所有英语表达的教学判断。
