// Netlify Function: AI 构图分析
// 接收图片 + 可选主体坐标，调用豆包/OpenAI 兼容 API，返回建议 + 目标点
const OpenAI = require('openai');

const PROMPT_GENERAL = `你是一位专业摄影构图导师。分析这张取景画面的构图，给出改进建议。

必须严格只返回一个 JSON 对象，不要任何其他文字、解释或 markdown 标记：
{
  "advice": "简洁文字建议，40字以内",
  "target_x": 0.67,
  "target_y": 0.33,
  "target_label": "主体放这里"
}

坐标说明：
- target_x, target_y 是画面主体最理想的放置位置，0到1之间
- (0,0)=左上角，(1,1)=右下角，(0.5,0.5)=画面中心
- 经典好位置：三分法交叉点 (0.33,0.33)、(0.67,0.33)、(0.33,0.67)、(0.67,0.67)
- target_label 用4-6个字描述，如"主体放这里"、"视觉中心"
`;

function buildSubjectPrompt(sx, sy) {
  return `你是一位专业摄影构图导师。用户已在画面中指定了要拍的主体，位置在坐标 (${sx}, ${sy})。
请分析当前构图，给出这个主体最理想的放置位置。

必须严格只返回一个 JSON 对象，不要任何其他文字、解释或 markdown 标记：
{
  "advice": "简洁建议，40字以内，告诉用户怎么移动相机",
  "target_x": 0.67,
  "target_y": 0.33,
  "target_label": "主体移到这里"
}

说明：
- target_x, target_y 是这个主体最理想的放置位置，0到1之间
- (0,0)=左上角，(1,1)=右下角
- 经典好位置：三分法交叉点 (0.33,0.33)、(0.67,0.33)、(0.33,0.67)、(0.67,0.67)
- 如果主体已经在理想位置，target 可以等于当前 (${sx}, ${sy})
- target_label 4-6字，如"往左挪"、"往下放"、"对齐这里"
`;
}

function parseJson(text) {
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
    const model = process.env.AI_MODEL;
    const baseURL = process.env.AI_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3';
    console.log('[analyze] env check - apiKey exists:', !!apiKey, 'model:', model, 'baseURL:', baseURL);

    if (!apiKey || !model) {
      return { statusCode: 500, body: JSON.stringify({ error: 'AI_API_KEY or AI_MODEL not configured' }) };
    }

    const client = new OpenAI({
      baseURL,
      apiKey,
      timeout: 25000, // 25秒超时，避免等到Netlify 30秒超时
    });

    const prompt = (subjectX != null && subjectY != null)
      ? buildSubjectPrompt(subjectX, subjectY)
      : PROMPT_GENERAL;

    console.log('[analyze] calling AI API, model:', model, 'subject:', subjectX != null);
    const startTime = Date.now();

    const resp = await client.chat.completions.create({
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
    });

    const elapsed = Date.now() - startTime;
    console.log('[analyze] AI API responded in', elapsed, 'ms');

    const text = (resp.choices[0].message.content || '').trim();
    console.log('[analyze] response text length:', text.length, 'preview:', text.substring(0, 100));

    let result = parseJson(text);
    if (!result) {
      result = { advice: text, target_x: null, target_y: null, target_label: '' };
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
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: e.message || String(e) }),
    };
  }
};
