# AIUI 能力调研：自动派遣 + 居民对话是否可行

> 目的：把手动打捞改成「派遣居民出海 + AIUI 大模型扮演居民说话」之前，先查清 AIUI 的真实能力。
> 来源：官方仓库 [yodaos-project/AIUI](https://github.com/yodaos-project/AIUI)，commit `b65aa11`（2026-11-16）。下文路径都相对该仓库，例如 `documentation/3-api/ai/language-model.md` 对应 `https://github.com/yodaos-project/AIUI/blob/main/documentation/3-api/ai/language-model.md`。
> 标记：**已确认** = 文档明确写了；**未找到** = 文档没写，需要真机或问官方；**推断** = 由文档内容推出，未验证。

## 结论速览

| 问题 | 结论 | 状态 |
|---|---|---|
| 页面能不能直接调大模型 | 能：`LanguageModel.create()` + `prompt()` / `promptStreaming()`，支持多轮、system 提示 | 已确认 |
| 大模型能不能改游戏状态 | 能：创建会话时声明 `tools`，模型调用时页面收到 `toolcall` 事件，由我们的 JS 去改 `game.js` 状态 | 已确认 |
| 页面能不能把状态推给系统智能体 | 能：`getApp().getAgent().provideContext()` 发布只读背景数据；但沉浸式页面主要应自己建 LLM 会话 | 已确认 |
| 全屏页面里能不能说话（TTS） | 能：`speechSynthesis.speak()`，有 11 种音色 | 已确认 |
| 全屏页面里能不能听（ASR） | 能：`SpeechRecognition`，需声明 `RECORD_AUDIO`，`start()` 必须在用户交互中调用 | 已确认 |
| 唤醒词会不会把页面切走 | 页面有 `onVoiceWakeup`，`preventDefault()` 可拦截宿主默认行为；不拦截时宿主具体做什么 | 未找到 |
| 延迟 | 文档没有任何 LLM / TTS / ASR 延迟数据 | 未找到 |
| 本地存储 | `localStorage` / `wx.setStorageSync` / OPFS | 已确认 |
| 关掉智能体后后台计时 | 不行：Agent Worker 只有 `instant` / `foreground`，`background` 是预留值且不支持 | 已确认 |
| 角色专属音色 | 只能从 11 个固定音色里选，不能定制；`getVoices()` 未暴露 | 已确认 |
| LLM 配额 / 费用 | 文档没写；Agent 会话错误类型里有 `QuotaExceededError` | 未找到 |

## 1. 页面 ↔ 大模型：状态能否推进去、模型能否改回来

### 1.1 页面直接调大模型（推荐路径）— 已确认

- `LanguageModel.availability()` 判断可用 → `LanguageModel.create({ initialPrompts, tools })` 建会话 → `session.prompt()` 或 `promptStreaming()`。
  来源：`documentation/3-api/ai/language-model.md`、`documentation/0-guide/basic/ai/llm.md`
- `initialPrompts` 放 system 约束（适合放居民人设）。文档建议「不要把每次用户输入都塞进去」。来源同上「注意事项」。
- **工具调用**：`tools` 用 OpenAI 风格的 function 声明；模型要调用时触发 `session.addEventListener('toolcall', e => …)`，事件含 `callId / functionName / arguments`。
  来源：`documentation/3-api/ai/language-model.md`「tools 调用示例」「toolcall 事件对象」
  - 文档的能力清单只写了「接收结构化调用请求」，**没写怎么把工具执行结果回传给模型继续生成**（未找到）。稳妥做法：工具只做「改状态」类动作，执行后用下一次 `prompt()` 把结果当文本告诉模型。
- 限制：同一会话同一时间只能有一个活跃请求；不用时 `destroy()`；没传 `model` 时用运行环境默认模型。来源同上。

### 1.2 页面 ↔ 系统智能体会话（Agent Session）— 已确认

- `getApp().getAgent()` 可以：`provideContext({ key, description, value })` 发布背景数据、`conversation.sendMessage()` 以用户身份发消息、`sendCard()` 发卡片、`callTool()` 调远端工具。
  来源：`documentation/3-api/ai/agent-session.md`
- 要点：
  - 「应用状态和日志不会自动成为模型输入」，必须显式发布；上下文是**模型只读**的，不是双向共享状态。
  - 最多 128 条上下文，payload 上限 1 MiB，默认超时 30 秒。
  - 这条通道的模型回复**不回到页面**，页面拿不到回复文本。
  - 卡片显示在 Rokid AI App 的会话里。
- 对我们的意义：适合「玩家退出游戏后问系统助手『我的方舟怎样了』」这类场景。游戏内的居民对话应该走 1.1。

### 1.3 对话式页面可作为模型的 UI 工具 — 已确认

- 页面 `script def` 写 `description` + `schema.data` 后，模型可以带参数打开这个页面（卡片）。沉浸式智能体则直接进入 `app.json` 第一个页面。
  来源：`documentation/1-framework/open-agent-format/page-definition.md`、`documentation/0-guide/quickstart/first-immersive.md`
- 可用于做一张「方舟日报」小卡片（可选，非必须）。

## 2. 全屏页面里的语音

### 2.1 沉浸式页面要自己搭语音链路 — 已确认

- 原文：「沉浸式 AIUI 则是一个独立运行的上下文。开发者如果还需要继续使用 ASR、LLM、TTS 等能力，就需要自己……把整套语音交互链路接起来」。也就是说，我们的游戏页面不会自动拥有系统助手的对话能力，要自己串起 ASR → LLM → TTS。
  来源：`documentation/0-guide/quickstart/first-immersive.md`「区别 2」

### 2.2 说话（TTS）— 已确认

- `speechSynthesis.speak(new SpeechSynthesisUtterance(text), 'enqueue' | 'immediate')`。兼容写法：`wx.speech.playTTS(text)`。
- 也可以用 `speechSynthesis.synthesize()` 拿音频分片和**字幕 cue**，适合在眼镜上边播边显示台词。
- `cancel / pause / resume / getVoices` 当前**未暴露**，所以说到一半没法打断；`lang` 设置无效。
  来源：`documentation/3-api/ai/speech-synthesis.md`「当前能力范围」

### 2.3 听（ASR）— 已确认

- `new SpeechRecognition()`，可设 `lang`、`continuous`、`interimResults`。兼容写法：`wx.speech.startRecognition()`。
- **`start()` 必须在用户交互中调用**：玩家要按一下确认键才开始听，不能常开监听。
- 需要在 `app.json` 声明 `RECORD_AUDIO`，并获得平台授权；已不需要单独的 `SPEECH_RECOGNITION` 权限。
  来源：`documentation/3-api/ai/speech-recognition.md`、`documentation/3-api/permissions.md`

### 2.4 唤醒词与是否退出页面

- 页面级 `onVoiceWakeup(event)`：说「乐奇 / Hi Rokid」或触控唤醒时触发；`event.preventDefault()` 可拦截宿主默认行为，然后页面自己开始识别。**已确认**。
  来源：`documentation/1-framework/open-agent-format/page-events.md`
- 不拦截时宿主默认做什么（会不会盖住或切出游戏页面）：**未找到**，需要真机测试。
- `Backspace` 的默认行为是「返回上一级或请求关闭应用」，我们现在已经接管。**已确认**，来源同上。

### 2.5 延迟 — 未找到

- 文档没有 LLM 首字、TTS、ASR 的延迟数据。调试文档只要求「在真机上重点验证语音……启动耗时」。
  来源：`documentation/0-guide/debug/real_device_debug.md`
- 设计时按「一次回复要等几秒」来做：先在界面显示「铆钉在想……」，用 `promptStreaming()` 逐字显示，台词控制在 1–2 句。

## 3. 权限、存储、后台计时

### 3.1 权限 — 已确认

| 需要 | 声明 | 说明 |
|---|---|---|
| 麦克风（语音和居民说话） | `RECORD_AUDIO` | 声明不等于授权，要处理拒绝 |
| 网络 | `INTERNET`（建议） | 「当前并非所有网络 API 都检查此声明」 |
| TTS / LLM | 文档未列单独权限 | **未找到**是否需要 `INTERNET`；建议一并声明 |

来源：`documentation/1-framework/open-agent-format/app-json.md`「声明应用需要的权限」

→ 我们的 [AGENTS.md](../agent/AGENTS.md) 现在写着「不使用麦克风、网络；无需任何 permissions」，做这个方案就要改。

### 3.2 本地存储 — 已确认

- `localStorage`、`wx.setStorageSync`（我们已在用）、OPFS 私有目录。
  来源：`documentation/3-api/storage.md`

### 3.3 后台计时 / 离线派遣

- Agent Worker 的 `lifetime` 只有 `instant`（跑完就停）和 `foreground`（有 Page 或 Widget 开着才运行）；**`background` 是预留值，当前不支持**。**已确认**。
  来源：`documentation/1-framework/open-agent-format/agent-worker.md`
- 所以游戏关掉后不能真正在后台跑。**可行替代（推断）**：派遣时把出发时间 `Date.now()` 存进存档，下次打开时在 `onLoad` 里按经过的真实时间一次性结算。这完全在本地完成，不需要后台。
- 「派遣回来了」的提醒：AIUI Cloud 能从**我们自己的服务器**向用户眼镜推送通知，点击后可以打开指定页面并带参数。**已确认**。但这需要服务端、账号 SK 和用户账号 ID，对单机小游戏来说太重，不建议做。
  来源：`documentation/5-cloud/notifications.md`、`documentation/5-cloud/overview.md`
- 另有常驻 Widget（`placement: persistent`，1x1 / 1x2），理论上可以显示「派遣中 3/5」。Widget 能否在游戏关闭时自己刷新**未找到**。
  来源：`documentation/1-framework/open-agent-format/app-json.md`

## 4. 音色与费用

### 4.1 TTS 音色 — 已确认

固定 11 种，用 `utterance.voice = 'ID'` 选择，不能定制：

| Voice ID | 类型 | 可以给谁（建议） |
|---|---|---|
| `male-qn-qingse` | 中文青年男声（默认） | 铆钉 |
| `male-qn-jingying` | 中文成熟男声 | 铁梁 |
| `female-yujie` | 中文成熟御姐 | 锈锚 |
| `female-tianmei` | 中文甜美女声 | 珊瑚 |
| `Chinese (Mandarin)_Radio_Host` | 中文电台男声 | 灯塔叔 |
| `Chinese (Mandarin)_News_Anchor` | 中文新闻女声 | 林博士 / 广播 |
| `clever_boy` | 中文男童 | 小锅 |
| `lovely_girl` | 中文女童 | 气泡 |
| 其余 3 个 | 英文 | — |

来源：`documentation/3-api/ai/speech-synthesis.md`「可用音色」。角色对应只是建议，要按《故事》里居民的设定再定。

### 4.2 LLM 配额 / 费用 — 未找到

- 文档没写运行时 `LanguageModel` 的默认模型、调用次数上限或计费。
- 能找到的只有两条：
  - Agent 会话的错误类型里有 `QuotaExceededError`（来源：`documentation/3-api/ai/agent-session.md`）。
  - AIUI Editor 开发时免费提供 DeepSeek V4 Pro，这是给开发工具用的，**不代表**游戏运行时也免费（来源：`documentation/7-tools/editor.md`）。
- 发布前要问 Rokid 官方，或在 AIUI Studio 后台确认。设计上要有「模型不可用」时的退路（`availability()` 返回 `unavailable`）。

## 5. 方案在 AIUI 上的可行做法

### 可行

1. **派遣（纯本地逻辑，不依赖 AI）**
   - 在建造页式的列表里选居民和海域，存下出发时间。
   - 用游戏内天数结算，或下次打开时按真实时间补算。
   - 收获由 `game.js` 的掉落表决定，**不交给大模型**。这样可测试、可平衡，也不怕模型编数字。
2. **居民汇报（LLM + TTS）**
   - 居民回来后，页面把这趟的结构化结果（海域、捞到什么、有没有遇到巨鲨）和居民人设交给 `LanguageModel`，生成 1–2 句汇报。
   - 用该居民的音色 `speak()`，同时在弹窗里显示字幕。
3. **和居民聊天（ASR → LLM → TTS）**
   - 主界面加「找 XX 聊聊」。按确认开始听（满足 `start()` 必须在用户交互中调用的要求），识别文字交给该居民的 LLM 会话，回复用流式显示加播报。
4. **让模型做有限的动作（tools）**
   - 只开放少量安全工具，例如 `suggest_dispatch(zone)`（「明天让我去沉城吧」→ 界面上预选好，由玩家确认）、`give_affection(+1)`（每天有上限）。
   - 工具在页面里执行，规则仍在 `game.js` 里，模型不能直接加资源。
5. **退路**
   - `availability()` 不可用、没网或被拒绝麦克风时，汇报退回到《故事》里写好的固定台词。游戏必须能完全离线玩。

### 不可行或有风险

| 项 | 原因 |
|---|---|
| 关掉游戏后真正在后台计时 | `background` lifetime 不支持；只能下次打开时补算 |
| 派遣完成时主动提醒（不开游戏） | 需要自建服务器 + Cloud 通知 + 用户账号 ID，成本过高 |
| 常开监听、随时插话 | `start()` 必须由用户交互触发；也很费电 |
| 打断正在播报的语音 | `speechSynthesis.cancel()` 未暴露 |
| 给每个角色定制声音 | 只有 11 个固定音色 |
| 依赖系统助手的对话能力 | 沉浸式页面是独立上下文；系统会话回复不回到页面 |
| 把收获、数值交给模型决定 | 不可测、可能编数字；只让模型说话，不让它算账 |

### 需要真机或官方确认（建议下一步）

1. 写一个最小测试页：`LanguageModel.availability()`、一次 `prompt()` 的耗时、一次 `speak()` 的耗时、`onVoiceWakeup` 不拦截时的表现。
2. 问官方：运行时 LLM 的默认模型、调用配额和计费；`toolcall` 的结果怎么回传；TTS 和 LLM 是否需要 `INTERNET` 声明。
3. 确认后改 [AGENTS.md](../agent/AGENTS.md) 和 `app.json` 的权限声明。
