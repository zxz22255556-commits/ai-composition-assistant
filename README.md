# AI 构图助手

打开手机网页 → 自动调用摄像头 → AI 每隔几秒分析当前画面构图 → 把建议显示在屏幕上。
不用手动上传照片，打开就是取景画面，三分法网格常驻。

## 效果
- 全屏相机取景 + 三分法构图网格
- 每 5 秒自动抓一帧，发给 AI 分析构图
- 点击画面选择主体（蓝点），AI 给出目标位置（绿点），虚线箭头指示移动方向
- 对齐后绿点变金色，顶部弹出「✓ 构图已对齐」
- 底部浮层显示 AI 给的具体调整建议
- 可切换前后摄像头
- 可"添加到主屏幕"，像 App 一样用

## 一、准备 AI API（以豆包为例，国内最快）

1. 打开 [火山引擎方舟控制台](https://console.volcengine.com/ark)，注册/登录
2. 左侧「模型推理」→「接入点」→「创建接入点」
3. 模型选 **doubao-1.5-vision-pro**（或最新的视觉模型），创建后得到接入点 ID，格式如 `ep-2024xxxxxx-xxxxx`
4. 右上角「API Key 管理」→ 创建 API Key，复制保存
5. 新用户有免费额度，够日常用

> 也可以用 DeepSeek、通义千问 VL、GPT-4o 等任何 OpenAI 兼容的 API，改环境变量 `AI_BASE_URL` 即可。

## 二、部署到 Netlify（推荐，最方便）

部署到 Netlify 后：自动 HTTPS、手机直接打开就能调摄像头、不用电脑一直开着、不用 cloudflared 隧道。

### 步骤

1. **把项目推到 GitHub**（本仓库已推送）

2. **Netlify 连接仓库**
   - 打开 https://app.netlify.com → 「Add new site」→「Import an existing project」
   - 选择 GitHub，授权后选 `ai-composition-assistant` 仓库
   - Build command 留空，Publish directory 填 `static`（netlify.toml 已配置，会自动识别）
   - 点「Deploy site」

3. **配置环境变量**
   - 部署完成后，进入站点 → 「Site configuration」→「Environment variables」
   - 添加三个变量：
     - `AI_API_KEY` = 你的豆包 API Key
     - `AI_MODEL` = 你的视觉模型接入点 ID（如 `ep-xxxxxx`）
     - `AI_BASE_URL`（可选）= 默认豆包 `https://ark.cn-beijing.volces.com/api/v3`，用其他 API 时改
   - 保存后回到「Deploys」→ 点「Trigger deploy」→「Deploy site」重新部署一次（让环境变量生效）

4. **手机访问**
   - 部署完成后得到一个 `https://xxxx.netlify.app` 的地址
   - iPhone Safari 打开 → 允许摄像头 → 点「开启相机」
   - 分享 →「添加到主屏幕」，桌面就有 App 图标了

### 目录结构（Netlify 部署用）

```
ai-composition-assistant/
├── static/
│   └── index.html              # 前端页面
├── netlify/
│   └── functions/
│       └── analyze.js          # Netlify Function（后端）
├── netlify.toml                # Netlify 配置
├── package.json                # Node 依赖（openai）
├── app.py                      # 本地运行用的 Python 后端（Netlify 不需要）
├── requirements.txt            # 本地运行用（Netlify 不需要）
└── README.md
```

## 三、本地运行（备选，电脑上操作）

```bash
cd ai-composition-assistant
pip install -r requirements.txt
```

用环境变量配置（推荐，不用改代码）：

```bash
# Windows PowerShell
$env:AI_API_KEY="你的API_KEY"
$env:AI_MODEL="ep-xxxxxx"
python app.py

# macOS / Linux
export AI_API_KEY="你的API_KEY"
export AI_MODEL="ep-xxxxxx"
python app.py
```

启动后看到 `Uvicorn running on http://0.0.0.0:8000` 就成功了。

手机访问需要 HTTPS，用 cloudflared 做隧道：

```bash
cloudflared tunnel --url http://localhost:8000
```

得到 `https://xxxx.trycloudflare.com` 地址，手机 Safari 打开即可。

## 四、使用方法

1. 打开网页，点「开启相机」，允许摄像头权限
2. **点击画面**选择要拍的主体（出现蓝色圈「当前主体」）
3. AI 分析后，在理想位置出现**绿色圈**「目标位置」，两点之间有虚线箭头
4. **移动相机**让蓝色圈对齐绿色圈
5. 对齐后绿点变**金色**，顶部弹出「✓ 构图已对齐」
6. 拍照，搞定

不选主体也能用：AI 会自己判断画面主体，直接给出目标位置和文字建议。

## 五、常见问题

**Q：手机打开后点「开启相机」没反应？**
A：必须是 https 地址，http 地址浏览器会拒绝调用摄像头。

**Q：建议更新很慢或一直「分析中」？**
A：AI API 调用需要 1-3 秒，加上网络传输。如果一直卡着，检查 Netlify Functions 日志有没有报错，通常是 API key 或模型 ID 填错了。

**Q：能改分析频率吗？**
A：可以，`static/index.html` 里 `setInterval(analyze, 5000)` 的 5000 就是毫秒数，改成 3000 就是 3 秒一次（但会消耗更多 API 额度）。

**Q：每次分析大概多少 token？**
A：图片（640×480）约 390 token + 文本 prompt 约 600 token + 输出约 150 token，总计约 1100-1300 token/次。豆包视觉模型约 0.005 元/次。

**Q：Netlify 免费额度够吗？**
A：函数每月 12.5 万次调用，每次 10 秒超时。每 5 秒一次连续开 7 天才会用完，日常完全够。
