# Ask Then Answer

インテリジェントな質問応答システム - LangGraph と FastAPI + Next.js で構築された、ロールベースの対話型AI

## 概要

Ask Then Answerは、質問の内容に応じて適切な専門ロールを自動選択し、必要に応じて追加質問を行って高品質な回答を提供するシステムです。

### 主な機能

- **自動ロール選択**: 質問内容に基づいて最適な専門家ロールを選択
- **動的な情報収集**: 不足情報を検出し、追加質問で詳細を確認
- **品質保証**: 回答の品質を自動チェックし、必要に応じて改善
- **リアルタイムUI**: Next.jsベースの直感的なWebインターフェース

### 利用可能なロール

1. **一般知識エキスパート** - 幅広い分野の一般的な質問に対応
2. **生成AI製品エキスパート** - AI技術や関連製品の専門的な質問に対応
3. **カウンセラー** - 個人的な悩みや心理的な問題にサポートを提供

## 技術スタック

### バックエンド
- **FastAPI** - 高性能なPython Webフレームワーク
- **LangChain** - LLMアプリケーション開発フレームワーク
- **LangGraph** - 複雑なワークフローの管理
- **OpenAI GPT-4** - 言語モデル

### フロントエンド
- **Next.js 14** - React フレームワーク
- **TypeScript** - 型安全性の確保
- **Tailwind CSS** - スタイリング
- **shadcn/ui** - UIコンポーネント

## セットアップ

### 前提条件

- Python 3.9+
- Node.js 18+
- OpenAI API キー

### インストール

1. **リポジトリのクローン**
```bash
git clone <repository-url>
cd NextApp
```

2. **バックエンドのセットアップ**
```bash
cd backend
pip install -r requirements.txt
```

3. **環境変数の設定**
```bash
# backend/.env
OPENAI_API_KEY=your_openai_api_key_here
```

4. **フロントエンドのセットアップ**
```bash
cd frontend
npm install
```

5. **フロントエンド環境変数の設定**
```bash
# frontend/.env.local
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

## 実行方法

### 開発環境

1. **バックエンドサーバーの起動**
```bash
cd backend
uvicorn main:app --reload --port 8000
```

2. **フロントエンドサーバーの起動**
```bash
cd frontend
npm run dev
```

アプリケーションは http://localhost:3000 でアクセス可能です。

### プロダクション環境

1. **バックエンド**
```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

2. **フロントエンド**
```bash
cd frontend
npm run build
npm start
```

## API仕様

### POST /api/ask

質問を送信し、回答を取得します。

**リクエストボディ:**
```json
{
  "query": "質問文",
  "clarifications": ["追加情報1", "追加情報2"] // オプション
}
```

**レスポンス:**
```json
{
  "need_clarification": false,
  "role": "選択されたロール",
  "answer": "回答内容",
  "judge": true,
  "reason": "品質判定理由"
}
```

## 使用例

1. **基本的な質問**
   - 「Pythonでファイルを読み込む方法を教えて」
   - システムが「一般知識エキスパート」を選択し、直接回答

2. **専門的な質問**
   - 「RAGをプロダクションに導入する手順を教えて」
   - システムが「生成AI製品エキスパート」を選択
   - 必要に応じて追加質問（予算、規模、技術スタックなど）

3. **相談系の質問**
   - 「仕事でのストレスに対処する方法は？」
   - システムが「カウンセラー」を選択し、共感的な回答を提供

## プロジェクト構造

```
NextApp/
├── backend/
│   ├── main.py          # FastAPI アプリケーション
│   ├── requirements.txt # Python 依存関係
│   └── .env            # 環境変数
├── frontend/
│   ├── app/
│   │   └── page.tsx    # メインページ
│   ├── components/
│   │   └── ui/         # UIコンポーネント
│   ├── package.json    # Node.js 依存関係
│   └── .env.local     # フロントエンド環境変数
└── README.md
```

## 開発者向け情報

### バックエンドアーキテクチャ

システムは以下のステップで動作します：

1. **ロール選択** - 質問内容を分析し最適なロールを選択
2. **情報不足判定** - 回答に必要な情報が足りているかチェック
3. **追加質問** - 必要に応じてユーザーに詳細を確認
4. **回答生成** - 選択されたロールで回答を作成
5. **品質チェック** - 回答の品質を評価し、必要に応じて改善

### カスタマイズ

新しいロールの追加や既存ロールの変更は `main.py` の `ROLES` 辞書を編集することで可能です。

### デバッグ

バックエンドのAPIドキュメントは http://localhost:8000/docs で確認できます。

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 貢献

プルリクエストやイシューの報告を歓迎します。開発に参加する際は、コーディングスタイルガイドラインに従ってください。