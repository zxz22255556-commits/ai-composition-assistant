"""
AI 构图助手 - 后端
手机打开网页 → 调用摄像头 → 自动抓帧 → AI 分析构图 → 返回建议
"""
import os
import base64
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse
from openai import OpenAI

app = FastAPI()

# ========== AI 配置（改成你自己的）==========
# 默认用豆包（火山引擎方舟），国内访问快、有免费额度、支持 OpenAI 兼容格式
# 也可以换成 DeepSeek、通义、GPT-4o 等任何 OpenAI 兼容的 API
AI_BASE_URL = os.getenv("AI_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3")
AI_API_KEY  = os.getenv("AI_API_KEY",  "在这里填入你的API_KEY")
AI_MODEL    = os.getenv("AI_MODEL",    "在这里填入你的视觉模型接入点ID，如 ep-xxxxxx")

client = OpenAI(base_url=AI_BASE_URL, api_key=AI_API_KEY)

# 通用版 prompt：AI 自己判断主体
PROMPT_GENERAL = """你是一位专业摄影构图导师。分析这张取景画面的构图，给出改进建议。

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
"""

# 带主体坐标的 prompt：用户已指定主体位置
PROMPT_WITH_SUBJECT = """你是一位专业摄影构图导师。用户已在画面中指定了要拍的主体，位置在坐标 ({subject_x}, {subject_y})。
请分析当前构图，给出这个主体最理想的放置位置。

必须严格只返回一个 JSON 对象，不要任何其他文字、解释或 markdown 标记：
{{
  "advice": "简洁建议，40字以内，告诉用户怎么移动相机",
  "target_x": 0.67,
  "target_y": 0.33,
  "target_label": "主体移到这里"
}}

说明：
- target_x, target_y 是这个主体最理想的放置位置，0到1之间
- (0,0)=左上角，(1,1)=右下角
- 经典好位置：三分法交叉点 (0.33,0.33)、(0.67,0.33)、(0.33,0.67)、(0.67,0.67)
- 如果主体已经在理想位置，target 可以等于当前 ({subject_x}, {subject_y})
- target_label 4-6字，如"往左挪"、"往下放"、"对齐这里"
"""


@app.post("/api/analyze")
async def analyze(request: Request):
    """接收前端抓的帧（base64）+ 可选的主体坐标，调用 AI 返回构图建议+目标点"""
    try:
        data = await request.json()
        image_data = data.get("image", "")
        subject_x = data.get("subject_x")
        subject_y = data.get("subject_y")
        if not image_data:
            return JSONResponse({"error": "no image"}, status_code=400)

        # 根据是否选择了主体，使用不同 prompt
        if subject_x is not None and subject_y is not None:
            prompt = PROMPT_WITH_SUBJECT.format(subject_x=subject_x, subject_y=subject_y)
        else:
            prompt = PROMPT_GENERAL

        resp = client.chat.completions.create(
            model=AI_MODEL,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": image_data}},
                ],
            }],
            max_tokens=300,
            temperature=0.7,
        )
        text = resp.choices[0].message.content.strip()
        # 尝试解析 JSON（AI 可能在外面包了 markdown 代码块，做容错）
        import json, re
        result = None
        try:
            result = json.loads(text)
        except Exception:
            # 提取第一个 { 到最后一个 } 之间的内容
            m = re.search(r'\{[\s\S]*\}', text)
            if m:
                try:
                    result = json.loads(m.group())
                except Exception:
                    pass
        if result is None:
            # 降级：只返回文字
            result = {"advice": text, "target_x": None, "target_y": None, "target_label": ""}
        # 确保字段存在
        result.setdefault("advice", "")
        result.setdefault("target_x", None)
        result.setdefault("target_y", None)
        result.setdefault("target_label", "主体放这里")
        return JSONResponse(result)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@app.get("/")
async def index():
    """返回前端页面"""
    with open(os.path.join(os.path.dirname(__file__), "static", "index.html"), "r", encoding="utf-8") as f:
        return HTMLResponse(f.read())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
