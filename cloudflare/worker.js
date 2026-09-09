// Cloudflare Workers - AI 构图助手（前端+后端一体）
// 部署：Cloudflare Dashboard → Workers & Pages → Create → 粘贴此代码
// 环境变量：AI_API_KEY, AI_MODEL, AI_BASE_URL(可选)

const HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>AI 构图助手</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { width: 100%; height: 100%; background: #000; color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
    overflow: hidden; position: fixed; }
  #wrap { position: relative; width: 100vw; height: 100vh; height: 100dvh; }
  #video { width: 100%; height: 100%; object-fit: cover; display: block; }
  .grid { position: absolute; inset: 0; pointer-events: none; }
  .grid .v { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(255,255,255,0.3); }
  .grid .h { position: absolute; left: 0; right: 0; height: 1px; background: rgba(255,255,255,0.3); }
  #topBar { position: absolute; top: 0; left: 0; right: 0; z-index: 15;
    background: linear-gradient(to bottom, rgba(0,0,0,0.65), transparent);
    padding: max(14px, env(safe-area-inset-top)) 16px 24px; pointer-events: none; }
  #status { display: inline-block; background: rgba(0,0,0,0.5); padding: 5px 14px;
    border-radius: 20px; font-size: 12px; backdrop-filter: blur(8px); margin-bottom: 8px; }
  #advice { font-size: 14px; line-height: 1.5; text-shadow: 0 1px 4px rgba(0,0,0,0.8);
    max-height: 64px; overflow: hidden; }
  #advice .label { font-size: 11px; color: #94D8C3; font-weight: 600; margin-bottom: 2px; }
  #flipBtn { position: absolute; top: max(14px, env(safe-area-inset-top)); right: 16px;
    width: 40px; height: 40px; border-radius: 50%; background: rgba(0,0,0,0.5);
    border: none; color: #fff; font-size: 18px; cursor: pointer; backdrop-filter: blur(8px);
    display: none; align-items: center; justify-content: center; z-index: 20; }
  #targetMarker { position: absolute; width: 72px; height: 72px;
    transform: translate(-50%, -50%); pointer-events: none; display: none; z-index: 10; }
  #targetMarker .ring { position: absolute; inset: 0; border: 2.5px solid #4ade80;
    border-radius: 50%; animation: pulse 1.8s ease-in-out infinite; }
  #targetMarker .ring-inner { position: absolute; inset: 22px; border: 1.5px solid #4ade80;
    border-radius: 50%; opacity: 0.7; }
  #targetMarker .cross-h { position: absolute; top: 50%; left: 8%; right: 8%;
    height: 1.5px; background: #4ade80; transform: translateY(-50%); }
  #targetMarker .cross-v { position: absolute; left: 50%; top: 8%; bottom: 8%;
    width: 1.5px; background: #4ade80; transform: translateX(-50%); }
  #targetMarker .label { position: absolute; top: 100%; left: 50%;
    transform: translateX(-50%); margin-top: 8px; background: rgba(74,222,128,0.92);
    color: #0a0a0a; font-size: 12px; font-weight: 700; padding: 3px 10px;
    border-radius: 10px; white-space: nowrap; }
  @keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.18);opacity:.55} }
  #targetMarker.aligned .ring { border-color: #facc15; animation: none; }
  #targetMarker.aligned .ring-inner { border-color: #facc15; }
  #targetMarker.aligned .cross-h, #targetMarker.aligned .cross-v { background: #facc15; }
  #targetMarker.aligned .label { background: rgba(250,204,21,0.92); }
  #subjectMarker { position: absolute; width: 56px; height: 56px;
    transform: translate(-50%, -50%); pointer-events: none; display: none; z-index: 9; }
  #subjectMarker .ring { position: absolute; inset: 0; border: 2.5px solid #60a5fa;
    border-radius: 50%; background: rgba(96,165,250,0.15); }
  #subjectMarker .dot { position: absolute; top: 50%; left: 50%; width: 8px; height: 8px;
    background: #60a5fa; border-radius: 50%; transform: translate(-50%,-50%); }
  #subjectMarker .label { position: absolute; bottom: 100%; left: 50%;
    transform: translateX(-50%); margin-bottom: 6px; background: rgba(96,165,250,0.92);
    color: #0a0a0a; font-size: 11px; font-weight: 700; padding: 2px 8px;
    border-radius: 8px; white-space: nowrap; }
  #lineSvg { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 8; }
  #alignTip { position: absolute; top: max(56px, calc(env(safe-area-inset-top) + 48px));
    left: 50%; transform: translateX(-50%); background: rgba(250,204,21,0.95);
    color: #0a0a0a; font-size: 14px; font-weight: 700; padding: 8px 20px;
    border-radius: 20px; display: none; z-index: 20; }
  #hint { position: absolute; top: max(52px, calc(env(safe-area-inset-top) + 44px));
    left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.6);
    color: #fff; font-size: 12px; padding: 6px 14px; border-radius: 14px;
    backdrop-filter: blur(8px); white-space: nowrap; z-index: 5; }
  #bottomBar { position: absolute; bottom: 0; left: 0; right: 0; z-index: 25;
    background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);
    padding: 20px 24px max(28px, env(safe-area-inset-bottom));
    display: none; align-items: center; justify-content: space-between; }
  #lastPhoto { width: 48px; height: 48px; border-radius: 8px; overflow: hidden;
    border: 2px solid rgba(255,255,255,0.8); background: rgba(255,255,255,0.1);
    display: flex; align-items: center; justify-content: center; cursor: pointer; }
  #lastPhoto img { width: 100%; height: 100%; object-fit: cover; display: none; }
  #lastPhoto .placeholder { font-size: 20px; opacity: 0.5; }
  #shutterBtn { width: 72px; height: 72px; border-radius: 50%;
    border: 4px solid #fff; background: transparent; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: transform 0.1s ease; padding: 0; }
  #shutterBtn .inner { width: 56px; height: 56px; border-radius: 50%; background: #fff; transition: transform 0.1s ease; }
  #shutterBtn:active { transform: scale(0.92); }
  #shutterBtn:active .inner { transform: scale(0.85); }
  #rightPlaceholder { width: 48px; height: 48px; }
  #flash { position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; z-index: 30; }
  #flash.active { animation: flashAnim 0.3s ease-out; }
  @keyframes flashAnim { 0%{opacity:.9} 100%{opacity:0} }
  #startBtn { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
    padding: 18px 36px; font-size: 18px; font-weight: 600; background: #fff; color: #000;
    border: none; border-radius: 14px; cursor: pointer; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 40; }
  #startBtn:active { transform: translate(-50%,-50%) scale(0.96); }
</style>
</head>
<body>
<div id="wrap">
  <video id="video" autoplay playsinline muted></video>
  <div class="grid">
    <div class="v" style="left:33.33%"></div><div class="v" style="left:66.66%"></div>
    <div class="h" style="top:33.33%"></div><div class="h" style="top:66.66%"></div>
  </div>
  <div id="topBar">
    <div id="status">点击开启相机</div>
    <div id="advice"><div class="label">AI 构图建议</div>开启相机后，AI 将每隔几秒自动分析当前画面构图</div>
  </div>
  <button id="flipBtn">⇄</button>
  <div id="targetMarker"><div class="ring"></div><div class="ring-inner"></div><div class="cross-h"></div><div class="cross-v"></div><div class="label">主体放这里</div></div>
  <div id="subjectMarker"><div class="ring"></div><div class="dot"></div><div class="label">当前主体</div></div>
  <svg id="lineSvg" xmlns="http://www.w3.org/2000/svg"><defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(255,255,255,0.85)"/></marker></defs><line id="guideLine" x1="0" y1="0" x2="0" y2="0" stroke="rgba(255,255,255,0.7)" stroke-width="2" stroke-dasharray="6,4" marker-end="url(#arrow)" style="display:none"/></svg>
  <div id="alignTip">✓ 构图已对齐</div>
  <div id="hint">点击画面选择要拍的主体</div>
  <div id="flash"></div>
  <div id="bottomBar">
    <div id="lastPhoto"><span class="placeholder">🖼️</span><img id="lastPhotoImg" alt=""></div>
    <button id="shutterBtn"><div class="inner"></div></button>
    <div id="rightPlaceholder"></div>
  </div>
  <button id="startBtn">开启相机</button>
</div>
<script>
const API_PATH = '/analyze';
const video = document.getElementById('video');
const statusEl = document.getElementById('status');
const adviceEl = document.getElementById('advice');
const startBtn = document.getElementById('startBtn');
const flipBtn = document.getElementById('flipBtn');
const bottomBar = document.getElementById('bottomBar');
const shutterBtn = document.getElementById('shutterBtn');
const flash = document.getElementById('flash');
const lastPhotoImg = document.getElementById('lastPhotoImg');
const lastPhoto = document.getElementById('lastPhoto');
let stream = null, facing = 'environment', busy = false, timer = null;
let subjectX = null, subjectY = null, hasSubject = false;
const wrap = document.getElementById('wrap');
const subjectMarker = document.getElementById('subjectMarker');
const targetMarker = document.getElementById('targetMarker');
const guideLine = document.getElementById('guideLine');
const alignTip = document.getElementById('alignTip');
const hintEl = document.getElementById('hint');
function selectSubject(cx, cy) {
  const r = wrap.getBoundingClientRect();
  subjectX = Math.max(0, Math.min(1, (cx - r.left) / r.width));
  subjectY = Math.max(0, Math.min(1, (cy - r.top) / r.height));
  hasSubject = true;
  subjectMarker.style.left = (subjectX * 100) + '%';
  subjectMarker.style.top = (subjectY * 100) + '%';
  subjectMarker.style.display = 'block';
  hintEl.style.display = 'none';
  setTimeout(analyze, 300);
}
wrap.addEventListener('click', e => { if (!e.target.closest('button')) selectSubject(e.clientX, e.clientY); });
wrap.addEventListener('touchstart', e => { if (!e.target.closest('button')) { const t = e.touches[0]; selectSubject(t.clientX, t.clientY); } }, { passive: true });
async function openCamera() {
  try {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 } }, audio: false });
    video.srcObject = stream;
    startBtn.style.display = 'none';
    flipBtn.style.display = 'flex';
    bottomBar.style.display = 'flex';
    statusEl.textContent = '相机已开启';
    if (timer) clearInterval(timer);
    timer = setInterval(analyze, 5000);
    setTimeout(analyze, 1500);
  } catch (e) { statusEl.textContent = '相机失败：' + e.message; }
}
async function analyze() {
  if (busy || !stream || !video.videoWidth) return;
  busy = true; statusEl.textContent = '分析中…';
  try {
    const canvas = document.createElement('canvas');
    const w = video.videoWidth, h = video.videoHeight;
    const scale = Math.min(1, 640 / Math.max(w, h));
    canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const img = canvas.toDataURL('image/jpeg', 0.72);
    const res = await fetch(API_PATH, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: img, subject_x: hasSubject ? subjectX : null, subject_y: hasSubject ? subjectY : null }) });
    const data = await res.json();
    if (data.advice) { adviceEl.innerHTML = '<div class="label">AI 构图建议</div>' + escapeHtml(data.advice); statusEl.textContent = '建议已更新'; }
    else statusEl.textContent = '分析失败：' + (data.error || '未知错误');
    if (data.target_x != null && data.target_y != null && data.target_x >= 0 && data.target_x <= 1 && data.target_y >= 0 && data.target_y <= 1) {
      targetMarker.style.left = (data.target_x * 100) + '%';
      targetMarker.style.top = (data.target_y * 100) + '%';
      targetMarker.style.display = 'block';
      const label = targetMarker.querySelector('.label');
      if (label && data.target_label) label.textContent = data.target_label;
      updateLine(data.target_x, data.target_y); checkAlignment(data.target_x, data.target_y);
    } else { targetMarker.style.display = 'none'; guideLine.style.display = 'none'; alignTip.style.display = 'none'; }
  } catch (e) { statusEl.textContent = '网络错误：' + e.message; }
  busy = false;
}
function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function updateLine(tx, ty) {
  if (!hasSubject) { guideLine.style.display = 'none'; return; }
  const r = wrap.getBoundingClientRect();
  const sx = subjectX * r.width, sy = subjectY * r.height, ex = tx * r.width, ey = ty * r.height;
  const dx = ex - sx, dy = ey - sy, dist = Math.sqrt(dx*dx + dy*dy), shrink = dist > 36 ? 30 : dist * 0.5;
  const ex2 = dist > 0 ? ex - dx/dist * shrink : ex, ey2 = dist > 0 ? ey - dy/dist * shrink : ey;
  guideLine.setAttribute('x1', sx); guideLine.setAttribute('y1', sy);
  guideLine.setAttribute('x2', ex2); guideLine.setAttribute('y2', ey2);
  guideLine.style.display = 'block';
}
function checkAlignment(tx, ty) {
  if (!hasSubject) { alignTip.style.display = 'none'; targetMarker.classList.remove('aligned'); return; }
  const dist = Math.sqrt((subjectX-tx)**2 + (subjectY-ty)**2);
  if (dist < 0.06) { alignTip.style.display = 'block'; targetMarker.classList.add('aligned'); }
  else { alignTip.style.display = 'none'; targetMarker.classList.remove('aligned'); }
}
function takePhoto() {
  if (!stream || !video.videoWidth) return;
  flash.classList.remove('active'); void flash.offsetWidth; flash.classList.add('active');
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  if (facing === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  lastPhotoImg.src = dataUrl; lastPhotoImg.style.display = 'block';
  lastPhoto.querySelector('.placeholder').style.display = 'none';
  const link = document.createElement('a'); link.download = 'photo_' + Date.now() + '.jpg'; link.href = dataUrl; link.click();
}
shutterBtn.addEventListener('click', takePhoto);
lastPhoto.addEventListener('click', () => { if (lastPhotoImg.src) window.open(lastPhotoImg.src, '_blank'); });
window.addEventListener('resize', () => { if (targetMarker.style.display === 'block' && hasSubject) { updateLine(parseFloat(targetMarker.style.left)/100, parseFloat(targetMarker.style.top)/100); } });
startBtn.addEventListener('click', openCamera);
flipBtn.addEventListener('click', () => { facing = facing === 'environment' ? 'user' : 'environment'; openCamera(); });
</script>
</body>
</html>`;

const PROMPT_GENERAL = `你是一位专业摄影构图导师。分析这张取景画面的构图，给出改进建议。
必须严格只返回一个 JSON 对象，不要任何其他文字：
{"advice":"简洁建议40字以内","target_x":0.67,"target_y":0.33,"target_label":"主体放这里"}
坐标：(0,0)=左上 (1,1)=右下，经典好位置是三分法交叉点(0.33/0.67, 0.33/0.67)`;

function buildSubjectPrompt(sx, sy) {
  return `你是专业摄影构图导师。用户指定主体在坐标(${sx},${sy})，分析构图给出最理想位置。
必须严格只返回一个 JSON 对象，不要任何其他文字：
{"advice":"简洁建议40字以内","target_x":0.67,"target_y":0.33,"target_label":"主体移到这里"}
坐标：(0,0)=左上 (1,1)=右下，经典好位置是三分法交叉点。若已在理想位置，target可等于当前(${sx},${sy})`;
}

function parseJson(text) {
  try { return JSON.parse(text); } catch (e) {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch (e2) {} }
    return null;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response('', { headers: corsHeaders });
    }

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      return new Response(HTML, {
        headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders },
      });
    }

    if (request.method === 'POST' && url.pathname === '/analyze') {
      try {
        const body = await request.json();
        const image = body.image;
        const subjectX = body.subject_x;
        const subjectY = body.subject_y;

        if (!image) {
          return new Response(JSON.stringify({ error: 'no image' }), {
            status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const apiKey = env.AI_API_KEY;
        const model = env.AI_MODEL;
        const baseURL = env.AI_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';

        if (!apiKey || !model) {
          return new Response(JSON.stringify({ error: 'AI_API_KEY or AI_MODEL not configured' }), {
            status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const prompt = (subjectX != null && subjectY != null)
          ? buildSubjectPrompt(subjectX, subjectY)
          : PROMPT_GENERAL;

        console.log('[analyze] calling AI API, model:', model, 'subject:', subjectX != null);

        const resp = await fetch(`${baseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: image } },
              ],
            }],
            max_tokens: 300,
            temperature: 0.7,
          }),
        });

        const data = await resp.json();
        const text = (data.choices?.[0]?.message?.content || '').trim();
        console.log('[analyze] AI responded, text length:', text.length);

        let result = parseJson(text);
        if (!result) {
          result = { advice: text, target_x: null, target_y: null, target_label: '' };
        }
        result.advice = result.advice || '';
        result.target_label = result.target_label || '主体放这里';

        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (e) {
        console.error('[analyze] ERROR:', e.message);
        return new Response(JSON.stringify({ error: e.message || String(e) }), {
          status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};
