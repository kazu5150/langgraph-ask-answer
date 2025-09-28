from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import operator
import re
import base64
import io
from PIL import Image
from dotenv import load_dotenv

# LangChain / LangGraph
from langchain_openai import ChatOpenAI
from langchain_core.runnables import ConfigurableField
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langgraph.graph import StateGraph, END
from pydantic import BaseModel as PydBaseModel

load_dotenv()

# ==============================
# FastAPI 基本設定 & CORS
# ==============================
app = FastAPI(title="Ask-Then-Answer API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Vercelデプロイ後は本番URLに変更推奨
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================
# LangGraph 用の定義
# ==============================
ROLES = {
    "1": {
        "name": "一般知識エキスパート",
        "description": "幅広い分野の一般的な質問に答える",
        "details": "幅広い分野の一般的な質問に対して、正確で分かりやすい回答を提供してください。"
    },
    "2": {
        "name": "生成AI製品エキスパート",
        "description": "生成AIや関連製品、技術に関する専門的な質問に答える",
        "details": "生成AIや関連製品、技術に関する専門的な質問に対して、最新の情報と深い洞察を提供してください。"
    },
    "3": {
        "name": "カウンセラー",
        "description": "個人的な悩みや心理的な問題に対してサポートを提供する",
        "details": "個人的な悩みや心理的な問題に対して、共感的で支援的な回答を提供し、可能であれば適切なアドバイスも行ってください。"
    }
}

class State(PydBaseModel):
    query: str
    current_role: str = ""
    messages: List[str] = []
    current_judge: bool = False
    judgement_reason: str = ""
    retry_count: int = 0
    max_retries: int = 2
    need_clarification: bool = False
    clarification_questions: List[str] = []
    extra_context: str = ""
    image_description: str = ""  # 画像の説明を保存

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
llm = llm.configurable_fields(max_tokens=ConfigurableField(id="max_tokens"))

# Vision用のLLM（画像解析用）
vision_llm = ChatOpenAI(model="gpt-4o", temperature=0)

# 画像を解析してテキスト説明を生成する関数
def analyze_image(image_base64: str) -> str:
    """単一画像をGPT-4oで解析してテキスト説明を返す"""
    from langchain_core.messages import HumanMessage

    message = HumanMessage(
        content=[
            {
                "type": "text",
                "text": "この画像について詳しく説明してください。画像に含まれる要素、テキスト、オブジェクト、人物、背景などを具体的に記述してください。"
            },
            {
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}
            }
        ]
    )

    response = vision_llm.invoke([message])
    return response.content

# 複数画像を解析してまとめた説明を生成する関数
def analyze_multiple_images(images_base64: List[str]) -> str:
    """複数画像をGPT-4oで解析してまとめた説明を返す"""
    from langchain_core.messages import HumanMessage

    if len(images_base64) == 1:
        return analyze_image(images_base64[0])

    # 複数画像の場合、まとめて解析
    content = [
        {
            "type": "text",
            "text": f"以下の{len(images_base64)}枚の画像について、それぞれの内容を説明し、全体として何を表しているかを分析してください。画像間の関連性や違いも含めて詳しく説明してください。"
        }
    ]

    # 各画像を追加
    for i, image_base64 in enumerate(images_base64):
        content.append({
            "type": "text",
            "text": f"\n【画像{i+1}】"
        })
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}
        })

    message = HumanMessage(content=content)
    response = vision_llm.invoke([message])
    return response.content

# 1) ロール選択
selection_prompt = ChatPromptTemplate.from_template(
    """
あなたは質問応答システムのロール選択器です。
次のユーザー質問に最も適したロール番号を **半角数字1つ（1/2/3）だけ** 出力してください。説明や語尾は不要です。

ユーザーの質問:
{query}

ロールの選択肢:
1: {r1_name}: {r1_desc}
2: {r2_name}: {r2_desc}
3: {r3_name}: {r3_desc}
""".strip()
)
selection_chain = selection_prompt | llm.with_config(configurable={"max_tokens": 3}) | StrOutputParser()

def _pick_role_number(raw: str) -> str:
    m = re.search(r"[123]", raw)
    return m.group(0) if m else "1"

def selection_node(state: State) -> Dict[str, Any]:
    raw = selection_chain.invoke({
        "query": state.query,
        "r1_name": ROLES["1"]["name"], "r1_desc": ROLES["1"]["description"],
        "r2_name": ROLES["2"]["name"], "r2_desc": ROLES["2"]["description"],
        "r3_name": ROLES["3"]["name"], "r3_desc": ROLES["3"]["description"],
    })
    role_num = _pick_role_number(raw.strip())
    selected_role = ROLES.get(role_num, ROLES["1"])["name"]
    return {"current_role": selected_role}

# 2) 追加情報が必要か（不足判定）
class ClarifyDecision(PydBaseModel):
    need: bool
    reasons: List[str] = []
    questions: List[str] = []

clarify_prompt = ChatPromptTemplate.from_template(
    """
あなたは問い合わせの要件定義補助AIです。
次のユーザー質問を読み、回答に必要な前提/制約が欠けているか判定してください。

出力は JSON として:
- need: 追加質問が必要なら true、十分なら false
- reasons: 不足理由（簡潔に数点）
- questions: 不足を解消するための具体的な確認質問（最大3つ、簡潔に）

ユーザーの質問:
{query}

既知の追加コンテキスト（あれば）:
{extra_context}

ロール: {role}
""".strip()
)
clarify_chain = clarify_prompt | llm.with_structured_output(ClarifyDecision)

def need_clarification_node(state: State) -> Dict[str, Any]:
    result: ClarifyDecision = clarify_chain.invoke({
        "query": state.query,
        "extra_context": state.extra_context or "(なし)",
        "role": state.current_role or ROLES["1"]["name"]
    })
    return {
        "need_clarification": result.need,
        "clarification_questions": result.questions
    }

# 3) 回答
answer_prompt = ChatPromptTemplate.from_template(
    """
あなたは「{role}」として回答します。

役割の詳細:
{role_details}

ユーザーの質問:
{query}

{image_info}

追加コンテキスト（ユーザーからの追加入力・ヒアリング結果）:
{extra_context}

{feedback_block}

制約:
- 箇条書きや段落を使い、簡潔かつ根拠のある説明を心がける
- 不明点は推測せず、その旨を明示して代替案や次のアクションを提示する
- 画像が提供されている場合は、画像の内容を参考にして回答してください

最終回答を出力してください。
""".strip()
)
answer_chain = answer_prompt | llm | StrOutputParser()

def answering_node(state: State) -> Dict[str, Any]:
    feedback_block = ""
    if state.retry_count > 0 and not state.current_judge and state.judgement_reason:
        feedback_block = f"前回の指摘点（品質改善のため必ず反映）:\n- {state.judgement_reason}\n"

    # 画像情報がある場合は含める
    image_info = ""
    if state.image_description:
        image_info = f"画像の内容:\n{state.image_description}\n"
    else:
        image_info = "(画像は提供されていません)"

    role_details = "\n".join([f"- {v['name']}: {v['details']}" for v in ROLES.values()])
    answer = answer_chain.invoke({
        "role": state.current_role or ROLES["1"]["name"],
        "role_details": role_details,
        "query": state.query,
        "image_info": image_info,
        "extra_context": state.extra_context or "(追加入力なし)",
        "feedback_block": feedback_block
    })
    return {"messages": [answer]}

# 4) 品質チェック
class Judgement(PydBaseModel):
    judge: bool = False
    reason: str = ""

check_prompt = ChatPromptTemplate.from_template(
    """
以下の回答の品質を評価してください。

評価方針:
- 質問に直接的・正確に答えているか
- 誤情報・曖昧な断定がないか
- 構成が明瞭で読みやすいか
- 役割（{role}）として妥当か

出力は JSON:
- judge: 問題なければ true、改善が必要なら false
- reason: 判断理由を簡潔に

ユーザーの質問:
{query}

追加コンテキスト:
{extra_context}

対象の回答:
{answer}
""".strip()
)
check_chain = check_prompt | llm.with_structured_output(Judgement)

def check_node(state: State) -> Dict[str, Any]:
    answer = state.messages[-1] if state.messages else ""
    result: Judgement = check_chain.invoke({
        "query": state.query,
        "answer": answer,
        "role": state.current_role or ROLES["1"]["name"],
        "extra_context": state.extra_context or "(なし)"
    })
    return {"current_judge": result.judge, "judgement_reason": result.reason}

# LangGraph: ここでは関数直列で十分（Web API簡素化）
def run_pipeline(query: str, clarifications: Optional[List[str]] = None, image_base64: Optional[str] = None, images_base64: Optional[List[str]] = None) -> Dict[str, Any]:
    state = State(query=query)

    # 画像がある場合は解析（複数画像優先、下位互換対応）
    images_to_analyze = images_base64 or ([image_base64] if image_base64 else None)

    if images_to_analyze:
        try:
            if len(images_to_analyze) == 1:
                state.image_description = analyze_image(images_to_analyze[0])
            else:
                state.image_description = analyze_multiple_images(images_to_analyze)
        except Exception as e:
            return {
                "need_clarification": False,
                "role": "エラー",
                "answer": f"画像の解析中にエラーが発生しました: {str(e)}",
                "judge": False,
                "reason": "画像解析失敗"
            }

    # ロール選択
    s1 = selection_node(state)
    state.current_role = s1["current_role"]

    # 既に追加入力があればまとめる
    if clarifications:
        state.extra_context = "\n".join(clarifications)

    # 不足判定
    s2 = need_clarification_node(state)
    state.need_clarification = s2["need_clarification"]
    state.clarification_questions = s2["clarification_questions"]

    # もし不足があり、clarifications が未提供ならここで質問を返す
    if state.need_clarification and not clarifications:
        return {
            "need_clarification": True,
            "clarification_questions": state.clarification_questions,
            "role": state.current_role
        }

    # 回答生成
    s3 = answering_node(state)
    state.messages.extend(s3["messages"])

    # 品質チェック
    s4 = check_node(state)
    state.current_judge = s4["current_judge"]
    state.judgement_reason = s4["judgement_reason"]

    # 改善リトライ（簡易：最大1回）
    if not state.current_judge and state.retry_count < 1:
        state.retry_count += 1
        # フィードバックを extra_context に足す
        if state.judgement_reason:
            state.extra_context = (state.extra_context + "\n" if state.extra_context else "") + f"品質指摘: {state.judgement_reason}"
        s3b = answering_node(state)
        state.messages.extend(s3b["messages"])
        s4b = check_node(state)
        state.current_judge = s4b["current_judge"]
        state.judgement_reason = s4b["judgement_reason"]

    return {
        "need_clarification": False,
        "role": state.current_role,
        "answer": state.messages[-1] if state.messages else "",
        "judge": state.current_judge,
        "reason": state.judgement_reason
    }

# ==============================
# API I/O
# ==============================
class AskRequest(BaseModel):
    query: str = Field(..., description="質問文")
    clarifications: Optional[List[str]] = Field(default=None, description="不足質問への回答（1回目は省略）")
    image_base64: Optional[str] = Field(default=None, description="Base64エンコードされた画像データ（単一画像・下位互換用）")
    images_base64: Optional[List[str]] = Field(default=None, description="Base64エンコードされた複数画像データ")

class AskResponse(BaseModel):
    need_clarification: bool
    clarification_questions: Optional[List[str]] = None
    role: Optional[str] = None
    answer: Optional[str] = None
    judge: Optional[bool] = None
    reason: Optional[str] = None

@app.post("/api/ask", response_model=AskResponse)
def ask(req: AskRequest):
    result = run_pipeline(req.query, req.clarifications, req.image_base64, req.images_base64)
    return result

# 画像アップロード用の便利なエンドポイント
@app.post("/api/upload-image")
async def upload_image(file: UploadFile = File(...)):
    """画像ファイルをアップロードしてBase64文字列を返す"""
    try:
        # ファイル形式チェック
        if not file.content_type or not file.content_type.startswith("image/"):
            return {"error": "画像ファイルのみアップロード可能です"}

        # 画像を読み込み、サイズ調整
        image_data = await file.read()
        image = Image.open(io.BytesIO(image_data))

        # 画像サイズを制限（最大1024px）
        max_size = 1024
        if image.width > max_size or image.height > max_size:
            image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

        # JPEGに変換してBase64エンコード
        output = io.BytesIO()
        if image.mode == "RGBA":
            image = image.convert("RGB")
        image.save(output, format="JPEG", quality=85)

        image_base64 = base64.b64encode(output.getvalue()).decode()

        return {
            "image_base64": image_base64,
            "filename": file.filename,
            "size": len(image_base64)
        }

    except Exception as e:
        return {"error": f"画像処理エラー: {str(e)}"}
