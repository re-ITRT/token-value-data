# token-value-data

大模型订阅套餐 / API 定价的**数据源仓库**：每 12 小时刷新汇率、检测官方来源页变化，产出 `data/bundle.json` 供前端仓库读取。

- 前端仓库：[token-value-web](https://github.com/re-ITRT/token-value-web)（GitHub Pages 静态站点）
- 数据出口：`data/bundle.json`（raw 地址：`https://raw.githubusercontent.com/re-ITRT/token-value-data/main/data/bundle.json`，支持 CORS）
- 自动更新：`.github/workflows/update.yml`（cron `23 */12 * * *`，也可手动 workflow_dispatch）

## 目录

| 路径 | 说明 |
|---|---|
| `data/sources.json` | **人肉核验的价格数据**（模型 / 按量价 / 套餐），每条都带 source URL 与核验日期 |
| `data/bundle.json` | 给前端的打包产物（sources + state + fx + history），由更新任务生成 |
| `data/state.json` / `fx.json` / `hashes.json` / `history.json` | 汇率、来源页检测状态与运行历史 |
| `updater.mjs` | 更新任务：抓汇率 + 来源页变化检测 + 写 bundle |
| `tools/*.mjs` | 各家数据的采集/校正脚本与审计工具 |

## 本地运行

```bash
npm install              # 只有 playwright 是 devDependency（CI 渲染 JS 页面用）
node updater.mjs         # 跑一次更新
node tools/check.mjs deepseek-v4-flash   # 终端里看某模型的排名
```

浏览器后端：本地默认用 `opencli`（真实浏览器桥）；CI 用 `TV_BROWSER=playwright`。

---

# 每 1 RMB 能买到多少 token

把「订阅套餐」「按量 API」「积分/AFP/Credits 计费」统一换算到同一把尺子上：**选一个模型，按每 1 元人民币能买到的 token 数排序**。

- 看板：http://127.0.0.1:8123
- **购买推荐**：http://127.0.0.1:8123/recommend （填需求和用量 → 枚举套餐组合 → 按总价排序）
- **后台**：http://127.0.0.1:8123/admin （抓取状态、报错明细、运行历史、核验新鲜度）
- 数据更新：每 12 小时（汇率实时抓取 + 17 个官方来源页变化检测）
- 默认用量比例：输入 : 缓存读 : 输出 = **57 : 840 : 18**（可在页面上改，自动重算重排）
- 每次请求 token 数：默认 **0.3M**（按「请求次数」计费的套餐用它折算 token 量）
- 主题：默认**米白**，右上角 ◐ 切深色（记忆在 localStorage）

## 页面结构

- **看板**：一行一个条目，只留必要信息 —— 排名 / 厂商·套餐 / 优惠与时段标签 / 最多 3 个短标记 / 每¥1 token 数 / 月费与月额度。
  鼠标悬停某行看换算过程；右上角「⋯」展开筛选（订阅·按量、优惠价·原价、峰谷细分、估算行）。
- **购买推荐**：见下节。
- **后台**：专门用来盯「官网改版导致抓不到」这类问题，包含
  1. 运行概览：上次/下次运行、触发方式、耗时、汇率，以及**汇率源逐个尝试明细**；
  2. **需要处理的异常**：列出 `changed / flaky / shell / unreachable` 的来源页，带**错误原文**、HTTP 状态、差异率、上次成功时间，以及**受影响条目**（哪个套餐/哪个模型的价格引用了这个来源）；
  3. 来源页健康表：17 个来源逐条状态；
  4. 人工核验新鲜度：`verifiedAt` 距今 ≥14 天的条目；
  5. 运行历史：最近 30 次的耗时、汇率、异常数与明细。

> 需要我改数据时，把后台「需要处理的异常」那张表发过来即可。

## 购买推荐（/recommend）

回答「我每月要用 X 量的模型 A + Y 量的模型 B，最省钱的买法是什么」。

**输入**
- 需求清单：一行一个「模型 + 月用量（M token）」，可加多行，同一模型加多行会自动合并。
- 用量构成（输入:缓存读:输出，默认 57:840:18）与「每次请求 ≈ M token」（折算按请求计费的套餐）。
- **使用时段**：时区下拉 + **两条 24 小时格子带**（工作日 / 周末各一条）——按住拖动可以连续涂色，单击反转单个格子，从已涂色的格子起拖就是反向擦除；
  每条带前面有**勾选框**（可单独关掉某一种日型）和**权重输入**（默认工作日 5 : 周末 1 = 工作日用量 5 倍），权重决定 token 怎么分。
  预设：全选 / 清空 / 反选 / 设为 9–18。带下方实时显示「每天已选 N 小时 · 用量按 5:1 加权 → 工作日 93% / 周末 7% · token 分配：工作日 92.6M / 周末 7.41M」。
  点每条时段规则左侧的 **▤**，可以把它在该时区下的**峰时段叠加到格子上**（格子底部彩色条，颜色与规则一一对应，再点取消）。
- 自动算出的峰时占比**可以逐格手填覆盖**（表格最右列的小输入框）。
- 约束：不许买订阅 / 不接受促销价 / 不接受 5h·周窗口 / 最多买 2 个套餐 / **允许重复购买同一套餐（叠加额度）**。

### 购买约束（这两条是官方规则，不是偏好）

1. **同一条产品线同时只能订阅一档**——档位是互斥的，不能 Small + Medium 一起买；「促销档 + 原价档」这种变相买两次同样禁止。
   产品线记在 `data/sources.json` 的 `line` 字段（见 `tools/patch-lines.mjs`）：`cmdcode` / `ollama` / `volc-agent` / `volc-coding` / `ali-coding` / `baidu-token` / `scnet-token` / `zhipu-coding` / `mm-token` / `kimi-member` …
   依据：百度「每账号限购 1 档」、SCNet「每个账号同时只能订阅一个 Token Plan（不区分档位）」、各家的升配语义。
   **不同产品线可以组合**（SCNet 官方就写明「每账号各限 1 个 Token Plan + 1 个 Coding Plan」），所以「火山 Coding Plan Lite + 火山 Agent Plan Small」是合法方案。
2. **重复购买只在官方允许同周期叠加时开放**——目前只有 **SCNet Token Plan**（官方 FAQ：额度用完后可直接续费，无需等下一周期），上限 3 份。
   开关关掉时，求解器不会给出任何同一套餐买两次的方案；打开后才会出现 `×2 / ×3` 的行。

**峰谷与时区**
数据里每条分时条目带机器可读的 `peakRule`（时区 + 星期 + 小时区间，见 `tools/patch-peakrules.mjs`）。
时区下拉提供 **5 个主要国家/地区**：中国北京 / 日本东京 / 欧洲柏林·巴黎 / 美国东部纽约 / 美国西部洛杉矶，
偏移量用 `Intl.DateTimeFormat` **按当前日期实时算，夏令时自动跟上**（所以欧洲 +2、美国东部 -4 是实时的，不是写死的）。

- **表格里显示的时间一律换算到你选的时区**（悬停格子/规则可看到「原始规则 UTC …」）；
- 峰时占比按「你涂色的格子（带权重）∩ 该规则在你时区下的峰时段」算。
  例：两条带都涂 9–18、权重 5:1 → DeepSeek/Command Code 峰 **65%**、Ollama 0%、智谱 37%、硅基流动 100%（它的谷时只在北京 02–08）；
  把权重改成 1:5 → DeepSeek 峰掉到 **23%**（周末占了大头，而 DeepSeek 峰时只在工作日）；只勾工作日 → 回到 **70%**。
  换时区也会变：洛杉矶同一涂法下 DeepSeek 峰 8%、Ollama 20%，纯按量基准价从 ¥16.1 变 ¥19.3。
- 每条规则的自动占比都**可以手填覆盖**。

**百度 Token Plan 的三档时段（工作日白天/夜间/周末）官方未公布精确小时，推荐器退回标准价并在条目上标注**，不猜倍数。

**求解**
1. 把「订阅套餐 × 档位」和「按量兜底」都变成候选条目，按单位成本排序；
2. 取「最多能省钱」的前 10 个套餐，枚举 1024 种组合（同一套餐的不同档位不会重复买）；
3. 每种组合内按单位成本**贪心分配**各模型用量（套餐额度在模型间共享，按单位扣减），剩下的用最便宜的按量补；
4. 丢掉「买了却一点没用上」的套餐，去重后按总价给出前 6 个方案。

每个方案给出：月总价、相对纯按量的节省、每个套餐的覆盖量与额度利用率、按量兜底明细、以及**每个模型的有效单价**
（套餐费按该模型吃掉的额度占比分摊，所以"买大了"会如实反映成更高的有效单价）。
结果里会给出标签：`纯按量` / `含促销价` / `含窗口限制` / `含请求估算`。属**近似最优**（贪心 + 子集枚举）。

**单模型额度上限**：少数套餐对某些模型有单独的月额度上限（Command Code GOAT 整池 $70，但 DeepSeek 档只有 $60），
求解时按「池子余额 + 该模型的单模型上限」双重约束，不会把整池都算给一个模型。

## 跑起来

```bash
node server.mjs            # 启动站点（默认 127.0.0.1:8123，可用 PORT 覆盖）
node updater.mjs           # 手动跑一次更新任务
node tools/check.mjs deepseek-v4-flash 57:840:18   # 终端里看某个模型的排名（自检用）
node tools/probe-sources.mjs                       # 探测候选来源页能否被原始抓取（挑监控 URL 用）
node tools/patch-vendors.mjs                       # 写入/更新厂商数据（按 id upsert，可反复跑）
```

## 换算口径

**按量 API**：`每 ¥1 的 token 数 = 100万 ÷ 混合单价`，其中
`混合单价 = 输入占比×输入价 + 缓存占比×缓存价 + 输出占比×输出价`（美元价按当日汇率折人民币）。

**订阅套餐**（积分 / AFP / Credits / Token 额度）：

```
单 token 消耗（单位/百万 token） = 输入占比×u_in + 缓存占比×u_cache + 输出占比×u_output
每 ¥1 的 token 数              = (月额度 ÷ 单 token 消耗) × 100万 ÷ 月费
```

- `u_*` 是「每消耗 100 万该类 token，要扣掉多少套餐单位」。
  - Token 额度类（百度/腾讯通用 Token Plan）：`u = 100万`（1 token = 1 单位）
  - 积分/AFP 类（火山 Agent Plan）：`u = 系数 × 100`（系数 0.5 → 50 AFP/百万 token）
  - 美元额度类（Command Code / Ollama）：`u = 该模型的美元单价`
- **峰谷 / 折扣时段**：`u` 乘以倍率变成独立一行（如 Ollama 峰时 ×2、百度夜间 0.5 折 ×0.05）。
- **优惠 / 原价**：`priceVariants` 各生成独立一行。
- **按「请求次数」计费**（火山 Coding Plan、阿里 Coding Plan Pro）：`月额度 × 每次请求 ≈ token ÷ 月费`，
  每次请求的 token 数由页面上那个输入框给（默认 6 万），这类行会打「估算」标签，可用开关隐藏。

## 数据来源与可信度

- `data/sources.json` 是**人肉核验过的官网价格**，每条都带 `source`（官方 URL）与 `verifiedAt`（核验日期）。
- `data/state.json` 由更新任务生成：汇率、来源页变化检测结果、下次更新时间。
- **更新任务不会自动改写价格**：它只做两件事——抓当日汇率、对每个官方页做内容比对。
  某个来源页变了，对应条目会打上「官网有变动·待复核」标签，提醒去人工核对，避免把爬虫的误读当成价格。

### 变化检测怎么做的（为什么不是简单比哈希）

官网页面里嵌着 nonce / uuid / 时间戳 / 构建号，直接比哈希会**满屏误报**（实测同一页面两次抓取字节数完全相同、哈希却不同）。
所以流程是：

1. 去 script/style/注释 → 去标签 → 把日期、时间、UUID、长 token、长数字替换成占位符 → 归一化空白；
2. 以 200 字符窗口、100 步长取样做 **shingle 指纹**；
3. 与上次指纹求**差异率**，超过 **2%** 才算「变了」；
4. 页面归一化后不足 300 字符 = **JS 空壳**（原始抓取拿不到正文），此时**自动借本地浏览器渲染一次再取正文**（`opencli browser`）；
   浏览器也失败就标记为 `shell`（不可监控），不会谎报「无变化」；
5. 差异很大但页面大小剧变（>3×）或页面本身极小 → 标记 `flaky`（疑似抓到了不同渲染形态），不下结论。

状态枚举：`baseline` / `unchanged` / `changed` / `flaky` / `shell` / `unreachable`，页面上可展开逐条查看差异率。

**注意两处工程细节**（都是踩过坑才加的）：

- 厂商站（智谱、Kimi、MiniMax、火山）很多是重 JS 渲染，原始抓取只有几十个字符。这类页面会**自动改用本地浏览器渲染**：
  等 12 秒取样，取不到再等 8 秒重试，成功后把该 URL 固定记为 `mode: browser`，之后每轮都走浏览器，保证与基线同源可比。
- 浏览器只有**一个当前标签**，多个页面并行渲染会互相覆盖（曾出现 4 个不同 URL 拿到完全相同的 3154 字符）。
  因此浏览器兜底是**串行 + 每个 URL 独立 session**，代价是一次完整更新约 60 秒（12 小时一次，可接受）。

- 汇率源：open.er-api.com → frankfurter.dev → exchangerate-api 依次回退；全部失败则沿用上次值并标 `stale`。
- 服务重启时若 `state.json` 超过 12 小时，会在启动后立即补跑一次。

## 已收录（83 个模型 / 100+ 条按量价 / 30 个套餐 / 29 个监控来源）

| 类别 | 条目 |
|---|---|
| 国际订阅 | **OpenCode Go（$10/月，按模型的月度额度 + 5h/周/月窗口）**、Command Code Go / GOAT / Pro、Ollama Cloud Pro |
| 国内云订阅 | 火山方舟 Agent Plan Small/Medium/Large；阿里百炼 Coding Plan Pro；百度千帆 Token Plan Mini/Lite/Pro；腾讯云通用 Token Plan；超算互联网 SCNet Token Plan（基础→旗舰） |
| 厂商直营订阅 | 智谱 GLM Coding Plan Lite/Pro/Max（官方积分公式）、MiniMax Token Plan Plus/Max/Ultra、**小米 MiMo Token Plan Lite/Standard/Pro/Max** |
| 按量 API | **OpenCode Zen（含 6 个限时免费模型）**、DeepSeek 官方、智谱 BigModel + z.ai、Kimi 国内站 + 国际站、MiniMax 国内 + 国际、**小米 MiMo 国内 + 海外**、火山方舟、阿里百炼、腾讯混元、百度千帆、Ollama Cloud、Command Code Provider（**全量 71 个模型**）、超算互联网 SCNet、硅基流动（国内站 + 国际站，含长期免费模型） |
| 无法换算 | 阿里 Token Plan 个人版 Lite（Credits 系数未公开）、腾讯 Hy Token Plan（积分折算未公开）、Kimi 会员 Go/Plus/Pro/Max（官方只给百分比锚） |

**已下架不再统计**（id 记在 `data/sources.json` 的 `removedPlans` / `removedProviders` / `removedApiPrices` 里，防止脚本重新加回）：

| 下架对象 | 原因 |
|---|---|
| 火山方舟 Coding Plan（Lite/Pro） | 用量口径不透明，实际体验与官方「按请求数」折算严重不符 |
| 超算互联网 SCNet Coding Plan（Lite/Pro） | 官方已停售 |
| **阿里百炼（全部：Coding Plan Pro、Token Plan 个人版 Lite、百炼按量价）** | **用户核实后认为用量口径不透明**（Token Plan 的 Credits 系数官方未公开、Coding Plan 限量抢购且禁非交互式调用）。脚本见 `tools/patch-remove-aliyun.mjs` |

> Qwen 系模型并未消失：仍可从 硅基流动（国内站）、超算互联网 SCNet、Command Code Provider 拿到报价。

## 数据脚本的执行顺序

```bash
node tools/patch-vendors.mjs      # 厂商直营数据（智谱/Kimi/MiniMax/SCNet/硅基流动）
node tools/sync-commandcode.mjs   # 从 Command Code 官方页同步全部模型 + 单模型额度
node tools/patch-slots.mjs        # 给时段打 peak/offpeak 语义标记
node tools/patch-peakrules.mjs    # 给时段挂「机器可读的时区规则」
node tools/patch-lines.mjs        # 产品线 + 可重复购买
node tools/audit-independent.mjs  # 审计：哪些行换模型数字不变
```

`sync-commandcode` 会重建 Command Code 三档的模型表，**必须放在 `patch-slots` / `patch-peakrules` 之前**，否则峰谷标记会被覆盖掉。

## 行内标记只有三个语义

- **优惠**：该行是折扣价（促销档位、首购价、季付/年付、限时系数折扣…），悬停看具体口径
- **窗口**：该行额度受限额窗口约束，显示具体窗口（`5h·周·月` / `5h·周` / `7天`）
- **峰 / 谷**：该行属于分时定价的某一时段——**峰**=高峰期（价高/扣分多），**谷**=非高峰（折扣）。
  **鼠标悬停会显示该家的峰时段具体时间，并按看板顶部选的时区换算**，例如：
  - 北京：`高峰时段：价格/积分消耗更高` ⏎ `中国 · 北京（UTC+8）：周一–周五 09:00–12:00、14:00–18:00`
  - 洛杉矶：`… 美国西部 · 洛杉矶（UTC-7）：周日 18:00–21:00、23:00–00:00；周一–周四 18:00–21:00、23:00–03:00；周五 00:00–03:00`
- **与模型无关**：该行数值**不随所选模型变化**，因为套餐额度不是按模型费率计的（见下），悬停有说明
- 「按请求次数」计费的套餐会在数值下方标 `按每次 0.30M token 估算` 和 `每¥1 ≈ N 次请求`

不标记「禁止 API」之类的条款信息——那些写在条目的悬停说明里。

### 时区

看板**顶部右上角有「时区」下拉**（5 个主要国家/地区：中国北京 / 日本东京 / 欧洲柏林·巴黎 / 美国东部纽约 / 美国西部洛杉矶），
选择结果存在 localStorage，只影响**峰/谷时间的显示口径**，不影响排序与计算。
偏移量用 `Intl.DateTimeFormat` 按当前日期实时算，夏令时自动跟上。
时区与时段换算逻辑抽在 **`public/peak.js`**，看板与购买推荐两页共用（`ruleLocalPeakSlots` / `summarizeSlots` / `slotTip`）。

### 为什么有些行"换模型数字不变"

`tools/audit-independent.mjs` 会审计全表：**129 行里有 13 行**换模型后每¥1 token 数完全不变，分两类，都是口径使然、不是算错：

| 类别 | 行 | 原因 |
|---|---|---|
| 按**请求数**计费 | 火山 Coding Plan Lite/Pro、阿里 Coding Plan Pro | 额度以「次」计：18,000 次 × 0.3M/次 = 54 亿 token，与模型无关；所以同时给出 `每¥1 ≈ 450 次请求` |
| 按**原始 token** 发放 | 百度 Token Plan Mini/Lite/Pro（标准档）、腾讯通用 Token Plan、MiniMax Token Plan | 1 token = 1 单位，与模型无关 |

注意这类判断是**按行**做的：百度那些"夜间 5 折/周末 1 折"档只挂在 GLM-5.2 与 DeepSeek-V4-Pro 上，所以同一套餐的折扣档会随模型变、标准档不变。

> 数字不变 ≠ 模型价值相同。要比较"同样花 ¥1，跑不同模型哪个更划算"，得看**每¥1 能买到多少 token × 该模型的实际用量需求**——这正是 `/recommend` 做的事。

## 中英切换（i18n）

右上角 `EN / 中` 切换，语言记忆在 localStorage。实现方式：

- **UI 文案**走 key 词典（`public/i18n.js` 里的 `DICT`），HTML 上用 `data-i18n` 标注静态节点；
- **数据里的中文标签**（厂商名、时段名、档位名、额度单位）走**术语表替换**（`TERMS`，长词优先匹配），所以 `火山方舟`→Volcano Ark、`非高峰 5 折`→off-peak −50%、`5h·周·月`→5h·week·month；
- 数字单位也跟着切：中文 `亿/万`，英文 `B/M/K`；
- **条目的长注释（悬停说明）仍是中文** —— 那是数据侧的原始出处注解，没做逐条翻译。

## 加一个套餐 / 模型

1. 在 `data/sources.json` 的 `models` 里加模型（若无）。
2. 按量计价加进 `apiPrices`：`{ provider, modelId, band, currency, in, cache, out, source, verifiedAt }`。
3. 订阅套餐加进 `plans`：
   - `kind`: `credit`（美元额度）| `points`（积分/AFP）| `tokens`（token 额度）| `requests`（按次）| `uncomputable`
   - `quota` + `quotaUnit`，`priceVariants[{ id:'list'|'promo'|..., label, amount }]`
   - `models[modelId].u = { input, cache, output }`，可选 `bands[{ id, label, mult }]`、`quotaOverride`
   - `models: "any"` 表示该套餐对所有模型成立（按请求计费那种）
   - `source` + `verifiedAt` 必填，否则更新任务检测不到变化

## 已知取舍

- 火山的 AFP 系数是官方公布的模型系数；**缓存读取是否同系数官方未单列**，此处按同系数估算，已写在条目的 note 里。
- 火山 Coding Plan 的 5h/周/月请求数硬数字来自官方文章（当前套餐页未渲染出该表），已标注。
- 百度 Token Plan 的夜间/周末折扣官方只挂在 `GLM-5.2`、`DeepSeek-V4-Pro-0813` 上，因此只给这两个模型挂了折扣行。
- 请求计费类套餐的「每次请求 ≈ token」是用户可调假设（默认 0.3M），排名对这些行高度敏感——它们默认打「估算」标记，
  且模型范围按各家官方清单写死（例如阿里 Coding Plan 不会出现在 Kimi K3 下）。
- **智谱**：Coding Plan 只有 5 小时 + 周两个窗口、无月额度，此处把周积分 ×4.33 折成月量做同口径比较；
  Flash 的积分系数（2.3/0.56/8）与 GLM-5.3（6.9/1.7/24）不同，别混用。GLM-5.3-Flash 的五折促销已于 2026-09-09 结束，看板用标准价 0.8/2.8/0.23。
- **MiniMax**：官方只给「月调用次数 × 单次约 50K token」的量级口径（Plus ≈6 亿、Max ≈18 亿、Ultra ≈71 亿），
  且套餐池按按量目录价扣减、构成未公开，所以这里按总量口径计、不随比例变化；另有一个「积分」是套餐用完后的溢出血包（1,000 积分 = ¥7，零杠杆），不是套餐额度。
- **Kimi**：会员额度官方只给百分比锚与相对倍数（1x/2x/4x/14x），未公开 token 绝对值 → 归入「无法换算」。
  另注意新版 Go 档（¥39）**不含 Kimi Code**，含 Kimi Code 的门槛是 Plus ¥79。
- **超算互联网 SCNet**：官方只给「倍率」与场景锚点（倍率 1.00 下 60,000 Credits ≈ 1.2 亿缓存命中输入 / 720 万非命中输入 / 170 万输出），
  由此反推出每百万 token 的 Credits 消耗（缓存 500 / 输入 8,333 / 输出 35,294 × 模型倍率）；倍率**按周调整**，会漂。SCNet 明确**无闲忙时定价**。
  官方 2026-09-01 倍率**整表照抄**（19 个模型）：GLM-5.3 2.29、GLM-5.3-Flash 0.15、GLM-5.2 0.85、GLM-5.1 1.40、GLM-5 1.11、
  DeepSeek-V4-Pro-0813 1.11、**DeepSeek-V4.1-Flash 0.23**、DeepSeek-V4-Flash-0731 0.40、DeepSeek-V4-Pro 1.06、DeepSeek-V4-Flash 0.13、
  Kimi-K3 4.12、Kimi-K2.7-Code 1.00、Kimi-K2.6 1.00、Kimi-K2.5 0.65、MiniMax-M3 0.43、MiniMax-M2.7 0.43、MiniMax-M2.5 0.30、Qwen3.8-Max 2.10、Qwen3.8-Flash 0.14。
  **SCNet 已下线的档位不再收录**：Coding Plan（Lite ¥20 / Pro ¥100）已不可购买——官方 FAQ 与订阅页当前只描述 Token Plan 四档，
  其 id 记在 `tools/patch-vendors.mjs` 的 `REMOVED_PLANS` 里，防止 upsert 把它加回来。SCNet 按量 API 价仍保留（可单独购买）。
- **硅基流动**：**没有任何订阅套餐**（纯按量 + 余额充值），所以只有按量行；它有两个值得单独看的点——
  谷时（02–08 点）DeepSeek-V4-Flash 五折，以及长期免费模型 `Xing4.0-29B`（256K + 工具调用，限额固定、触顶 429）。
  注意它的缓存命中价（¥0.15–0.30/M）比 DeepSeek 官方（≈¥0.021/M）贵 7–14 倍，缓存密集的编程负载会吃亏——看板里换个比例就能直接看出来。
- **套餐的模型范围按官方清单写死，不做「同厂商有按量价就塞进套餐」的推断**。已知的刻意排除：
  火山 `Doubao-Seed-2.0-Code`（官方标即将下线）、智谱 `GLM-4.7-Flash`（免费按量模型，能否用于 Coding Plan 官方未说明）。
  改数据后可跑一次覆盖审计查非预期漏项：
  ```bash
  node -e "const s=require('./data/sources.json');const g=[];for(const p of s.plans){if(p.kind==='uncomputable'||!p.models||p.models==='any')continue;const v=p.provider.split(' ')[0].replace(/（.*/,'');const a=new Set(s.apiPrices.filter(x=>x.provider.startsWith(v)).map(x=>x.modelId));for(const m of a)if(!(m in p.models))g.push(v+' · '+p.name+' 缺 '+m);}console.log([...new Set(g)].join('\n')||'无缺口')"
  ```
- **火山方舟 Agent Plan 的 AFP 系数整表照抄官方**（[套餐内 AFP 抵扣规则](https://www.volcengine.com/docs/ark/agent-plan-personal-afp-credits-billing-rules?lang=zh)，更新 2026-09-17）：
  DeepSeek V4 Flash 0.5、GLM-5.3-Flash 0.5、**DeepSeek V4.1-Flash 2.5**（不是 0.5，限时 5 折 → 1.25）、MiniMax M3 / Seed-Evolving / Seed-2.1-Turbo 2.5、
  Kimi K2.7 Code / GLM-5.3 4.5、DeepSeek V4 Pro 5.5、Kimi K2.8 Preview 8（限时 6 折 → 4.8）、Kimi K3 10。缓存读取按同系数估算（官方未单列）。Auto 模式系数 0.5（6/10–11/8）。
- **Command Code 的模型表与单模型额度整表同步自官方页**（70 个模型，`tools/sync-commandcode.mjs`）：
  GOAT 的单模型月额度差异很大——DeepSeek V4 Flash $60、Kimi K2.7 Code $60、GLM-5.2 $70、Qwen 3.8 27B $70、GPT-5.6 Sol $70，但 **Kimi K3 / GLM-5.3 只有 $20**。
  Claude Opus / Fable 官方标注需要 Max 档，本目录没有 Max 档，故只出现在 Provider API 按量行。
- **小米 MiMo**：Token Plan 四档 **Lite ¥39 / Standard ¥99 / Pro ¥329 / Max ¥659**（首购与年付 88 折 → 最低 ¥34.32），额度以 Credits 计（4.1B / 11B / 38B / 82B）。
  官方口径是**按 token 扣 Credit**（`mimo-v2.5-pro`：缓存 2.5 / 输入 300 / 输出 600 Credits 每 token），已换算成每百万 token（×1e6）。
  **夜间 0.8 倍消耗**（北京 00:00–08:00）作为折扣时段行；额度耗尽即停服、不扣余额；同账号同时只能有 1 个套餐（可补差价升级）。
  官方按量价：国内 `mimo-v2.5` ¥1 / ¥0.02 / ¥2、`mimo-v2.5-pro` ¥3 / ¥0.025 / ¥6（元/百万 token），海外另有 USD 价。
- 汇率源：open.er-api.com → frankfurter.dev → exchangerate-api 依次回退；全部失败则沿用上次值并标 `stale`。
- **关于「官网有变动」的误报**：数字集合信号很灵敏，浏览器渲染的页面（火山文档等）有时会渲染出不同段落，
  表现为「新增数字」但无「消失数字」——后台会列出具体新增/消失的数字，照着核一遍通常 2 分钟即可判断。
  实测一轮：3 个 flag 里 1 个是真变化（Command Code 新增 longcat-2.0 模型），2 个是渲染差异。

## 两个仓库怎么配合

```
token-value-data（本仓库，每 12 小时跑一次）
   updater.mjs → 抓汇率 + 检测 29 个官方来源页 → 写 data/*.json
                → data/bundle.json（{sources,state,fx,history} 打包）
   GitHub Action 提交变更 → raw.githubusercontent.com 上的固定地址
                                  ↓
token-value-web（GitHub Pages 静态站）
   config.js 指向那个固定地址，data.js 用 TV.load() 读取 → 渲染看板/推荐/后台
```

**渲染器一致性（重要）**：JS 渲染的页面（火山文档、智谱、Kimi 会员、MiMo 等）在本地用真实浏览器桥（opencli）渲染，在 CI 用 Playwright 渲染，
两者取到的文本不同 → **切换渲染器的那一次一定会报「变化」**，第二次就收敛（实测：CI 首轮 5 changed，第二轮 0 changed / 0 flaky）。
所以：**committed 的数据以 CI 为准**，本地跑出来的 state 只用于开发调试，不要推上去。
本地若想和 CI 对齐：`npm i && npx playwright install chromium`，然后 `TV_BROWSER=playwright node updater.mjs`。

## 本机推送（github.com 被重置时）

这台机器上 `git push` 到 github.com 经常被重置（TCP 能连、TLS 被断），但 `api.github.com` 通。
所以用 `tools/gh-push.mjs` 走 API 提交：

```bash
node tools/gh-push.mjs . re-ITRT/token-value-data main "data: xxx"
```

它会用 `git credential fill` 取本机已存的 token（不打印），把当前目录内容通过 Git Data API 写成一个提交。
## 支付方式标注（data/payment.json）

各家**能不能用中国大陆常用方式直接付款**单独维护在这个文件里（支付宝 / 微信 / 境内银联 vs 需境外卡），
更新任务会把它打包进 bundle 的 ``payments`` 字段，前端两个页面据此提供「只看支持中国支付」筛选：

- ``cn: true``：DeepSeek 官方、火山方舟、腾讯云、百度千帆、智谱（国内站）、Kimi（国内站）、MiniMax（国内站）、**Command Code（支付宝）**、
  小米 MiMo（国内档）、超算互联网 SCNet、硅基流动（国内站）
- ``cn: false``：Ollama Cloud、智谱 z.ai（国际）、Kimi 国际站、
  MiniMax 国际站、小米 MiMo 海外站、硅基流动（国际站）

看板的行悬停提示、以及后台的健康表都会带上这个信息。
## OpenCode（tools/sync-opencode.mjs）

数据直接解析官方文档在 GitHub 上的源文件（比渲染后的页面可靠、可重复跑）：
``packages/web/src/content/docs/go.mdx`` 与 ``zen.mdx``。

- **Go 订阅**：$10/月，额度**按模型分别计算**（GLM-5.3-Flash $60、Kimi K3 $15、DeepSeek V4 Flash $30 …），
  窗口为 **5 小时 = 该模型月额度 20%、周 = 50%、月 = 100%**；用满某模型不影响其它模型。
  实现上：套餐 ``quota`` = 各模型额度之和（避免求解器把总池当成共享池），每个模型另有 ``quotaOverride`` 单模型上限。
  DeepSeek 系在文档里分峰/谷两行 → 转成时段带（峰 ×2）。
- **额度促销**：官方表格用 `~~$15~~ **$60**` 表示「划线原价 → 当前促销价」，取数脚本先丢掉删除线部分再取值（否则会取到旧价）。当前 DeepSeek V4.1 Flash 是 4x 促销（$15 → $60，2026-09-20 结束），脚本会在 note 里标明。
- **Zen 按量**：75 条付费价 + 11 条限时免费（Big Pickle、MiMo-V2.5 Free、Ling 3.0 Flash Fin Free、
  Nemotron 3 Ultra Free、Nemotron 3.5 Lightning Free、Muse Spark 1.3 Contributor Free；另有 5 个只出现在 v2 控制台模型列表里的：
  DeepSeek V4 Flash Free、Laguna S 2.1 Free、Ling-3.0-tiny Free、LongCat-2.0 Free、North Mini Code Free，见 `tools/patch-opencode-extra.mjs`）。
- **支付**：官方文档只提到「信用卡手续费 4.4% + $0.30 按成本转嫁」（走 Stripe）；用户实测国内可直接支付（支付宝），
  ``payment.json`` 里按 ``cn: true`` 标注并在 note 里写明来源。
## 国外厂商的官方按量价（2026-09-19 核验）

| 厂商 | 覆盖 | 脚本 | 数据源 |
|---|---|---|---|
| DeepSeek | 4 个模型 | `tools/patch-deepseek-official.mjs` | `api-docs.deepseek.com/quick_start/pricing` |
| xAI（Grok） | 7 个（含 grok-4.3 / 4.20 系） | `tools/sync-xai-official.mjs` | `docs.x.ai/docs/pricing.md`（官方 Markdown 版，可直接抓） |
| Google Gemini | 9 个（含最便宜的 2.5-flash-lite） | `tools/sync-gemini-official.mjs` | `ai.google.dev/gemini-api/docs/pricing` |
| OpenAI | 13 个 | `tools/sync-openai-official.mjs` | `developers.openai.com/api/docs/pricing`（platform 域名被 Cloudflare 拦，403） |
| Anthropic | 11 个 | `tools/sync-anthropic-official.mjs` | `platform.claude.com/docs/en/about-claude/pricing`（本机无法直连 anthropic 域，经 Exa 官方页快照核验，两站数值一致） |

**几个必须注意的口径**（都已写进条目的 note）：

- **Gemini 3.6/3.7/3.8 Flash 现在是限时促销价**（$0.75/$3.75，2027-01-01 起翻倍到 $1.50/$7.50）。第三方网关（Command Code / OpenCode Zen）按的是**翻倍后的价**，所以直接买 Google 官方现在反而便宜一半——看板里能直接看出来。
- **长上下文是「整单加价」**：OpenAI >272K、xAI ≥200K 达到阈值后**整单所有 token** 按长档计费，不是只算超出部分。
- **Claude 无长文加价**（1M 窗口按标准价）；缓存写入 1.25×（5 分钟）/ 2×（1 小时）；Batch 5 折且可与缓存折扣叠加。
- **已停服型号不给官方报价**：`gpt-5.1-codex` / `-max` / `-mini` / `gpt-5.2-codex`（2026-07-23 停服）、`gpt-5-nano`（2026-12-11 停服）只在模型上标注。
- **四家全部不支持中国支付**（只收境外卡，且官方支持地区名单不含中国大陆/香港/澳门），已在 `payment.json` 里标 `cn: false`；**Command Code 与 OpenCode 支持支付宝**（Command Code 由用户 2026-09-21 实测确认，Stripe 结账可选 Alipay）。

审计：`node tools/audit-official-api.mjs` 会列出「有官方渠道但缺官方价」的模型，目前剩 25 个（多为阿里百炼下架后失去官方来源的 Qwen 系，以及厂商已停售的档位）。
## 国外四家的会员套餐（含编码 agent 额度）—— 一律记成「无法换算」

2026-09-19 逐家核验后确认：**四家官方都只公布百分比或相对倍数，从不公布额度的 token / 美元绝对值**，
所以这 15 个档位全部以 `kind: 'uncomputable'` 收录（看板底部「无法换算」区，不参与排名），
只展示价格、窗口结构、可用模型，以及「为什么算不出来」。脚本：`tools/sync-foreign-memberships.mjs`。

| 厂商 | 档位 | 官方额度的说法 | 卡在哪 |
|---|---|---|---|
| Anthropic | Claude Pro $20 / Max 5x $100 / Max 20x $200 | 5h 滚动窗口 + 周窗口，网页/桌面/手机/Claude Code/Cowork **共用一个池**；官方称「there is no fixed message count」，只给百分比 | 官方明确说 `/usage` 里的美元数「对订阅者没有计费意义」；触顶直接阻断不降级 |
| OpenAI | ChatGPT Go $8 / Plus $20 / Pro 5x $100 / Pro 20x $200 | 按模型的「每 5 小时本地消息数**区间**」（如 Luna：Plus 250–2,000、Pro 20x 5,000–40,000） | 区间上下差 10–20 倍、官方自称「不是固定限制」；**每周窗口完全未公布** |
| Google | AI Plus $4.99 / AI Pro $19.99 / Ultra 5x $99.99 / Ultra 20x $199.99 | Antigravity 的 5h + 周双池，「按 API 计价扣减」，Ultra = Pro 的 5×/20× **token 当量** | 基础配额绝对值从未公布（只给相对倍数）；且 2026-06-18 起 Gemini CLI 已停服消费级，旧「1500 次/天」作废 |
| xAI | SuperGrok $30 / Plus $100 / Heavy $300 / X Premium+ $40 | 「一个共享周池，只以百分比展示」 | 只有百分比；同一池内对话/视频/Build 消耗差数量级；官方从不给折算值 |

**共同结论**：这些会员是「包月软配额」，API 是「线性合同价」，两者不可通约——**不要拿它们和 API 的「每元 token 数」做同口径比较**。
唯一有官方美元定价的部分是「超额续跑」：Claude 可开 usage credits（按标准 API 价，bundle 最多省 30%）、
OpenAI 可买 credits（企业 rate card 反推 1 credit ≈ $0.04）、xAI 有 Extra Usage Credits（$5 起，按标准价）、
Google 的 AI credits 按标准 API 价扣减——这些才是可确定性换算的口径。

四家都**不支持中国支付**（只收境外卡，支持地区名单通常不含中国大陆、含港澳台），已在 `payment.json` 标注；
看板打开「只看支持中国支付」时这 15 个档位会一起被过滤掉。