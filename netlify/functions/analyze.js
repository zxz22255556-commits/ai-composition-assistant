// Netlify Function: AI 构图分析
// 接收图片 + 可选主体坐标，调用 OpenAI 兼容 API，返回建议 + 目标点
const OpenAI = require('openai');

const PROMPT_GENERAL = `分析这张照片的构图，给出最佳构图位置。

只返回JSON，不要其他文字：
{"advice":"40字以内建议","target_x":0.67,"target_y":0.33,"target_label":"主体放这里"}

坐标：(0,0)=左上 (1,1)=右下 (0.5,0.5)=中心。好位置：三分法交叉点(0.33/0.67, 0.33/0.67)。`;

function buildSubjectPrompt(sx, sy) {
  return `用户指定主体在(${sx},${sy})。分析构图，给出这个主体最理想的放置位置。

只返回JSON，不要其他文字：
{"advice":"40字以内，告诉用户怎么移动手机","target_x":0.67,"target_y":0.33,"target_label":"主体移到这里"}

坐标：(0,0)=左上 (1,1)=右下。好位置：三分法交叉点。如果主体已在好位置，target等于当前坐标。`;
}

function parseJson(text) {
  if (!text || !text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch (e2) { /* ignore */ }
    }
    return null;
  }
}

// 调用 AI API，带重试
async function callAI(client, model, prompt, image, maxRetries = 2) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[analyze] attempt ${attempt + 1}/${maxRetries + 1}`);
      const resp = await client.chat.completions.create({
        model,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: image } },
          ],
        }],
        max_tokens: 200,
        temperature: 0.3,
      });

      const text = (resp.choices[0].message.content || '').trim();
      console.log(`[analyze] attempt ${attempt + 1} response length:`, text.length, 'preview:', text.substring(0, 80));

      const result = parseJson(text);
      if (result && result.target_x != null && result.target_y != null) {
        return result;
      }
      console.log(`[analyze] attempt ${attempt + 1} failed to parse, retrying...`);
    } catch (e) {
      console.log(`[analyze] attempt ${attempt + 1} error:`, e.message);
      if (attempt === maxRetries) throw e;
    }
  }
  return null;
}

exports.handler = async (event) => {
  console.log('[analyze] function started, method:', event.httpMethod);

  // CORS 预检
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const image = body.image;
    const subjectX = body.subject_x;
    const subjectY = body.subject_y;

    if (!image) {
      return { statusCode: 400, body: JSON.stringify({ error: 'no image' }) };
    }

    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL || 'agnes-2.5-flash';
    const baseURL = process.env.AI_BASE_URL || 'https://apihub.agnes-ai.com/v1';
    console.log('[analyze] env check - apiKey exists:', !!apiKey, 'model:', model, 'baseURL:', baseURL);

    if (!apiKey || !model) {
      return { statusCode: 500, body: JSON.stringify({ error: 'AI_API_KEY or AI_MODEL not configured' }) };
    }

    const client = new OpenAI({
      baseURL,
      apiKey,
      timeout: 28000, // 28秒超时，Netlify 30秒上限
    });

    const prompt = (subjectX != null && subjectY != null)
      ? buildSubjectPrompt(subjectX, subjectY)
      : PROMPT_GENERAL;

    console.log('[analyze] calling AI API, model:', model, 'subject:', subjectX != null);
    const startTime = Date.now();

    let result = await callAI(client, model, prompt, image, 2);

    const elapsed = Date.now() - startTime;
    console.log('[analyze] total elapsed:', elapsed, 'ms, result:', result ? 'success' : 'failed');

    // 如果 AI 失败，返回默认三分法建议
    if (!result) {
      console.log('[analyze] AI failed, using fallback suggestion');
      result = {
        advice: '建议使用三分法构图，将主体放在画面交叉点位置',
        target_x: 0.67,
        target_y: 0.33,
        target_label: '主体放这里',
        fallback: true,
      };
    }

    result.advice = result.advice || '';
    result.target_label = result.target_label || '主体放这里';

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(result),
    };
  } catch (e) {
    console.error('[analyze] ERROR:', e.message, e.stack ? e.stack.substring(0, 300) : '');
    // 即使出错也返回默认建议，避免前端显示空
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        advice: '建议使用三分法构图，将主体放在画面交叉点位置',
        target_x: 0.67,
        target_y: 0.33,
        target_label: '主体放这里',
        fallback: true,
        error: e.message || String(e),
      }),
    };
  }
};
