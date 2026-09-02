# haiyou HANDOFF 交接文档

> 会话结束时的项目状态快照，供下一会话（或数小时后的自己）无缝接手。
> 生成时间：2026-09-02 · 最后提交 `b74258d`（工作树干净、已推、live 字节全等验证过）。

---

## 一、我们在做什么任务

**haiyou** — Vue 3 + Vite + TS + Pinia + Vant 4 + Tailwind v4（+ PWA）的 B2C 医院×企业健康增值服务 H5，给**海油医院**用。三端角色：**学员(student) / 康复教练(coach) / 营养师(dietitian)**（医生、运营已并入营养师，只是保留各自账号名）。

- 仓库：`BAOWEIDONG/haiyou`，base `/haiyou/`，live https://baoweidong.github.io/haiyou/
- 核心业务：不是训练营，是医院健康服务。学员端=健康活动信息流+报告健康解读+健康答疑+个人历程+健康档案+打卡。营养师端=服务台(解读/答疑队列)+批注+配置(hub)。无营期竞赛/无排行/无积分奖励/无实时聊天(异步+私域)。

本会话（2026-09-02）一口气完成了 **4 个交付**，全部部署并 live 字节验证。

---

## 二、已经完成了什么（本会话 4 个 commit，全部部署验证）

| commit | 内容 | live 主入口 |
|---|---|---|
| `c58abc8` | **品牌海洋色换色**：主色 `#0B6BCB` 深海蓝，CTA/头部渐变伙伴 `#12B5C2` 碧浪青，teal `#14B8A6`→`#12B5C2` 统一，基色 `#E9F7FF`→`#E8F3FB` 海沫，van-primary 同步。语义绿/营养师橙/运营紫**保留** | index-T9MhXyXq.js |
| `0e8f3ff` | **答疑/解读可选填手机号取代私域索取**（见下"关键设计"） | index-CSgrfsaB.js |
| `b2c22f4` | **首屏提速 manualChunks**：主 bundle 354KB→175KB（-51%） | index-m3xsbNkU.js |
| `b74258d` | **营养师端看全学员内容 + 无体成分隐藏体成分卡** | index-AsHhbACt.js |

当前 live 主入口 = `assets/index-AsHhbACt.js` = **174816 B**（与 `dist/` 本地一致，已比对）。

### 0e8f3ff 关键设计（学员手机号取代索取/转私域）
- `types.ts`：`InterpretationRequest` 与 `ConsultThread` 各加 `studentPhone?: string`（学员可选填）；**删掉** 旧 `ConsultThread.contact`。
- `store/app.ts`：**删 `setConsultContact`**；`submitInterpretationRequest` 加第 5 参 `studentPhone`、`askConsult` 加第 4 参 `studentPhone`，均存 `值.trim()||undefined`。
- 学员端：答疑提问弹窗加「联系电话(选填)」；解读表单加「联系电话(选填)」+说明"不填也不影响线上解读"。删「申请电话/微信」按钮。
- 营养师端：**删「转私域」按钮 + 登记凭证弹窗**；线程/解读卡片展示学员填写的「学员联系电话」。
- mock 种子无这些字段，删 contact 类型安全。

### b74258d 关键（本会话最后一笔，务必知其所以然）
- 学员 `req.question`/`t.question` **营养师之前只在列表头 `truncate`/`line-clamp`，点击展开后正文没有它** → 看不全。修复：展开线程顶部加「学员待解读问题/学员问题」卡 `whitespace-pre-wrap` 完整展示。受害者：DoctorInterpretationView、DoctorConsultView 两处。
- 个人服务报告：体成分卡原来**永远显示**，无数据时落空态"暂无体成分检测数据"(像坏了)。改 `v-if=有前后值` 整卡隐藏，**对齐化验指标卡"有才展示"**；体重/打卡/建议仍在，空报告不再显空卡。

---

## 三、当前卡在哪儿 / 没做

- **无阻塞**。工作树干净，已推 main，live 与 dist 字节全等。
- 尚未真机冒烟验证本轮按钮删改、手机号输入、隐藏卡效果的**手感**（真机扫码确认要做的点，见"下一步"）。
- 首屏参考现状：render-blocking 首载 ≈ 主入口 175KB + 共享块 index.es~160KB + CSS 280KB（CSS 是 Tailwind+Vant 上限，**不动**）。主 bundle 提速已做；若仍嫌慢，方向是懒加载整页 + 图片 `loading=lazy`（已在以往 commit 做过，这轮没动）。

---

## 四、下一步计划

1. **真机冒烟**（重要）：用 `npm run build` 后起静态服务或直接扫码 live，过一遍
   - 答疑发起新提问（含/不含手机号）、营养师端展开看完整问题与手机号。
   - 解读提交（含/不含手机号）、营养师端展开「学员待解读问题」+报告材料 + 手机号。
   - 个人服务报告：一个无体成分数据的学员账号 → 确认体成分卡隐藏、其余卡仍在、导出 PDF/微信长图正常。
   - 整体首页首开速度体感（manualChunks 后）。
2. 若用户再报"某内容看不全"，**先查该视图展开态是否漏了源文本**（本项目的老坑）。
3. 维护记忆：`MEMORY.md` + `haiyou-student-health-hub.md` 已更新到 b74258d，后续 commit 记得追加同格式一行。
4. 任何交付都走 `unset http(s)_proxy`→设代理→`npm run build`→commit→push→轮询 live `index.html` 主 hash→比对字节数 的闭环（见"部署"）。

---

## 五、踩过的坑，别重复踩（本会话 + 历史硬约束）

**部署管线（必须严格遵守）**
- 设代理推远端：`unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY; export http_proxy=http://172.16.10.254:12000 https_proxy=http://172.16.10.254:12000`
- push 形式：`git push "https://BAOWEIDONG:<TOKEN>@github.com/BAOWEIDONG/haiyou.git" main`
- **TOKEN 绝不落盘**（只 `env` 内联）。push 后查 `.git` 无 `ghp_`。
- **3 连 401 = token 真过期**别当抖动；**push 被拒先 `fetch + rebase`**（他端会话会推远端）。
- 部署验证：轮询 live `https://baoweidong.github.io/haiyou/index.html` 里的 `assets/index-*.js` 主 hash，直到 hash 变新，再用 `curl xxx.js | wc -c` 比对 == 本地 `dist/assets/` 对应文件字节。
- **token 不落盘**：只 `env` 内联。若需 token 值，看记忆中 `git-push-token.md`（单独文件，未写进本交接）。

**构建/代码坑**
- **vue-router 无此依赖**：manualChunks 里写 `vue-router` 会 `Could not resolve`。拆 `vue:['vue','pinia']` 即可。
- 已拆独立块：`vue`(vue+pinia)/`vant`/`icons`(lucide-vue-next)/`date`(date-fns)。主入口 cache hash 会随内容变。
- **Vue 模板不支持对象字面量 `as` 断言**（如 `(b as {...})`），须在 `<script>` 写辅助函数窄化。
- **图标清理勿只删 import**：须按模板实际使用复核（历史 d6bc2d2 误删仍用的 X/ChevronRight 致线上图标静默消失，vue-tsc 不兜底）。
- 视图是 `defineAsyncComponent` lazy chunk；只改子视图时主入口字节不变（本轮验证过）。
- 沙箱(Linux)装的 node_modules 不能给 macOS 用，rollup/esbuild 原生平台不匹配。

**业务/口径坑**
- **★教练/营养师名字勿 rename**（用户硬性约束）。
- ★有歧义的产品行为/口径 → 必须 AskUserQuestion 问用户，勿凭"合理猜测"乱改；交付按"原话 vs 我做的"逐条核对。
- 营养师端服务列表头 `truncate`/`line-clamp`，但**展开态必须能看全学员提交的完整文本**——本次 b74258d 教训。
- 报告/统计展示口径："有才展示"优先于"空卡占位"（对齐化验指标 vs 体成分）。
- `weightLossPercent` 单位已是 %，勿再 ×100；`weightLossKg` 正=减重。
- 医疗边界文案：解读定位"健康减重建议非医疗诊断"；线上无法处置→引导线下就医。

---

## 六、关键文件路径

项目根（工作目录，含 .git）：`outputs/haiyou/`
（bash 内映射：`/sessions/sweet-jolly-cerf/mnt/outputs/haiyou`）

| 用途 | 路径 |
|---|---|
| 主入口动态加载/惰性视图 | `src/App.vue` |
| store(单一数据源+全部 actions) | `src/store/app.ts` |
| 类型定义(含 studentPhone) | `src/types.ts` |
| mock 种子(MOCK_ACCOUNTS/CAMPS/threads/interpretation) | `src/mock/data.ts` |
| 品牌色/构建? 主题在样式类 | `src/index.css` |
| 学员端-答疑 | `src/components/ConsultView.vue` |
| 学员端-提交解读 | `src/components/InterpretationRequestView.vue` |
| 学员端-解读结果 | `src/components/InterpretationResultView.vue` |
| 学员端-个人服务报告★ | `src/components/CampReportView.vue` |
| 营养师端-答疑线程★ | `src/components/DoctorConsultView.vue` |
| 营养师端-解读线程★ | `src/components/DoctorInterpretationView.vue` |
| 学员端-消息中心(解读/答疑提醒) | `src/components/MessagesView.vue` |
| 营养师端-内容管理/图文卡 | `src/components/OpsContentView.vue` |
| 营养师-全屏发布 | `src/components/OpsContentEditView.vue` |
| 报告计算引擎(勿删 generateStudentReport) | `src/lib/campReport.ts` |
| 营期/批次工具(日期) | `src/lib/camps.ts` |
| 导出 PDF/微信长图 | `src/lib/exportPDF.ts` |
| 构建配置(manualChunks/代理无关) | `vite.config.ts` |
| 部署环境变量(API_BASE/BASE/USE_MOCK) | `.env*` |

记忆（跨会话）：`…/memory/memory/` 下 `MEMORY.md`（索引）+ `haiyou-student-health-hub.md`（详细，本会话更新到 b74258d）。