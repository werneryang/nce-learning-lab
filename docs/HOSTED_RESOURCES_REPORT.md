# 仓库音频和字幕接入 — 实际交付记录

本次按用户明确指令连接并发布其已加入仓库的第二至第四册 MP3/LRC。基础版本为 main 的 `b461e8d1250da958643e3a336a09d58d7a0b8406`。原 Phase 0–2 报告记录的是之前版本。

## 实现范围

- 第二册 96 课、第三册 60 课、第四册 48 课，共 204 个课目与 408 个音频/字幕文件（530,423,898 字节）。精确文件名、大小和 SHA-256 在 `content/source-manifest/hosted.json`，不是按标题猜路径。
- 页面打开课程即加载本网站字幕和音频元数据，点击 Play 后真实播放；不需要 Import。支持拖动、点击字幕定位、倍速、循环和隐藏字幕。网络加载失败可独立重试音频或字幕。
- 三册目录筛选、标题搜索及深链接。前五课保留原有人工设计的候选词块和任务；其他课提供通用听写/默写/改写流程，不声称已有逐课定制教案。
- 字幕加载校验内容哈希，作为纯文字解析并本地缓存。问题及其他未审核片段不会自动成为默写参考；仍由用户选择、确认正文。
- 私人草稿、历史与掌握度继续本地保存；写作不自动请求 Tutor。已存在的本地音频/字幕替换优先，不自动覆盖；本地音频在备份恢复后缺失时可使用仓库音频，并提示重新核对字幕匹配。
- 构建只复制清单中的 204 MP3/204 LRC 到 `dist/media`，三个 PDF 不进入网站。扫描改为精确清单及哈希核对，仍拒绝其他媒体、异常全文及所列凭证模式；不是关闭扫描。
- 用户指令允许本次部署操作，但没有据此把出版社许可标成 permitted；rightsStatus 仍为 unverified。没有新增从第三方下载的原版媒体。

## 验证状态

本地 lint/typecheck/build 通过。单元与集成 46 passed、1 skipped：新检查解析仓库内所有 204 课 LRC；跳过的是原可选、需要仓库外五课文件的历史检查。浏览器完整回归 36 passed；新增音频失败重试在 Chromium / WebKit / iPhone 13 WebKit 模拟各通过，3 passed。最终功能提交 `52bbce74b2f4e87aed716c09b49c48e5f7539aae` 的远端 CI 已完整运行 39 个场景，全部通过；lint/typecheck/build/scan 通过，依赖审计 0 个已报告漏洞。CI 的单元结果同为 46 passed / 1 skipped。

`npm run scan` 核对 408 个部署资源的大小与哈希，并确认无 PDF 进入 dist。构建有原有 Zod 注释提示和单个 JS 超过 500 kB 的体积提醒，构建成功；没有因此改变检查阈值。网站按当前课程加载，不在浏览器中一次下载全部音频。

[GitHub Actions run 38010835477](https://github.com/werneryang/nce-learning-lab/actions/runs/38010835477) 的 validate 与 deploy 均 success。正式网址：https://werneryang.github.io/nce-learning-lab/ 。

正式 HTTPS 核验：408/408 资源 HEAD 为 HTTP 200，Content-Length 与清单逐项匹配；三册首课的字幕 SHA-256 均匹配，MP3 范围请求均返回 206 和正确的 Content-Range。首页、JS 和 CSS 与本地最终构建逐字节相同。详情在 `HOSTED_DEPLOYMENT_VERIFICATION.json`；这些核验不是逐课人工听完全部音频。

原生 Mac Safari 正式站点实际操作：打开第二册第二课，字幕及 1:21 音频时长自动出现，没有选择任何文件。点击 Play，计时从 0:00 推进到 0:22；暂停后点击 0:16 的字幕行，进度定位到 0:16。全程不用 Import。首次浏览器页面可能仍用旧缓存，普通刷新后观察到新版。

随后提交的最终报告及部署证据仅修改文档，不修改上述已发布的运行代码，复用该提交验证。iPhone 仅完成 WebKit 模拟，尚未真机验收。真实 AI 状态仍为 not_configured。
