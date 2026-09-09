# Cloudflare Workers 部署指南（最简单）

> 一个文件搞定前端+后端，免费额度大（每天10万次请求），全球 CDN 可能能访问国内火山引擎 API。

## 部署步骤（5分钟）

### 第一步：注册 Cloudflare
1. 打开 https://dash.cloudflare.com/sign-up 注册账号（免费）
2. 登录后进入控制台

### 第二步：创建 Worker
1. 左侧菜单点「Workers & Pages」
2. 点「Create」→ 选「Workers」
3. 给 Worker 起个名字（比如 `ai-composition`），点「Deploy」
4. 部署成功后点「Edit code」进入代码编辑器

### 第三步：粘贴代码
1. 打开本项目的 `cloudflare/worker.js` 文件，全选复制（Ctrl+A → Ctrl+C）
2. 回到 Cloudflare 代码编辑器，全选删除原有代码，粘贴（Ctrl+V）
3. 点右上角「Deploy」部署

### 第四步：配置环境变量
1. 回到 Worker 详情页（点左上角返回）
2. 点「Settings」→「Variables and Secrets」
3. 点「Add variable」，添加两个：
   - 名称：`AI_API_KEY`，值：你的豆包 API Key（`ark-xxxxxx`），点「Encrypt」加密
   - 名称：`AI_MODEL`，值：你的视觉模型接入点 ID（`ep-xxxxxx`），点「Encrypt」加密
4. 点「Save」保存

### 第五步：手机访问
1. Worker 详情页能看到一个 URL（类似 `https://ai-composition.你的用户名.workers.dev`）
2. 手机 Safari 打开这个 URL
3. 点「开启相机」→ 允许摄像头权限
4. 点击画面选主体，AI 给目标位置，移动对齐，点底部快门拍照
5. 分享 →「添加到主屏幕」

## 常见问题

**Q：还是网络错误/超时？**
A：说明 Cloudflare 也访问不了火山引擎 API。那就只能：
- 换海外 AI API（OpenAI/Claude），把 AI_BASE_URL 和 AI_MODEL 改成对应的
- 或者用本地运行方案

**Q：免费额度够吗？**
A：Workers 免费版每天 10 万次请求，每次分析算一次，完全够用。

**Q：怎么看日志？**
A：Worker 详情页 →「Logs」→「Begin log stream」，可以实时看 console.log 输出和报错。

**Q：需要域名吗？**
A：不需要，用 workers.dev 的免费子域名就行。
