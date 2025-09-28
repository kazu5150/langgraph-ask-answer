"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type AskResponse = {
  need_clarification: boolean;
  clarification_questions?: string[];
  role?: string;
  answer?: string;
  judge?: boolean;
  reason?: string;
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const [role, setRole] = useState<string | undefined>();
  const [answer, setAnswer] = useState<string | undefined>();
  const [judge, setJudge] = useState<boolean | undefined>();
  const [reason, setReason] = useState<string | undefined>();

  const [needsClarify, setNeedsClarify] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [clarifyAnswers, setClarifyAnswers] = useState<string[]>([]);

  // 画像関連の状態
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imageBase64, setImageBase64] = useState<string>("");
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isImageModalOpen, setIsImageModalOpen] = useState<boolean>(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

  async function firstAsk() {
    setLoading(true);
    setAnswer(undefined);
    setJudge(undefined);
    setReason(undefined);
    setRole(undefined);
    setNeedsClarify(false);
    setQuestions([]);
    setClarifyAnswers([]);

    try {
      const res = await fetch(`${API_BASE}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          image_base64: imageBase64 || undefined
        }),
      });

      if (!res.ok) {
        throw new Error(`API Error: ${res.status} ${res.statusText}`);
      }

      const data: AskResponse = await res.json();

      setRole(data.role);
      if (data.need_clarification) {
        setNeedsClarify(true);
        setQuestions(data.clarification_questions || []);
        setClarifyAnswers((data.clarification_questions || []).map(() => ""));
      } else {
        setAnswer(data.answer);
        setJudge(data.judge);
        setReason(data.reason);
      }
    } catch (error) {
      console.error("API接続エラー:", error);
      setAnswer(`エラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}\n\n設定確認:\nAPI_BASE = ${API_BASE}`);
    } finally {
      setLoading(false);
    }
  }

  async function sendClarifications() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          clarifications: clarifyAnswers,
          image_base64: imageBase64 || undefined
        }),
      });

      if (!res.ok) {
        throw new Error(`API Error: ${res.status} ${res.statusText}`);
      }

      const data: AskResponse = await res.json();

      setNeedsClarify(false);
      setAnswer(data.answer);
      setJudge(data.judge);
      setReason(data.reason);
      setRole(data.role);
    } catch (error) {
      console.error("API接続エラー:", error);
      setAnswer(`エラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}\n\n設定確認:\nAPI_BASE = ${API_BASE}`);
      setNeedsClarify(false);
    } finally {
      setLoading(false);
    }
  }

  // 画像ファイル選択時の処理
  async function handleImageSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // ファイルサイズチェック（5MB制限）
    if (file.size > 5 * 1024 * 1024) {
      alert("ファイルサイズは5MB以下にしてください");
      return;
    }

    setSelectedImage(file);

    // プレビュー表示用
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImagePreview(result);
    };
    reader.readAsDataURL(file);

    // Base64変換（API送信用）
    const base64Reader = new FileReader();
    base64Reader.onload = (e) => {
      const result = e.target?.result as string;
      // "data:image/jpeg;base64," の部分を除去
      const base64 = result.split(',')[1];
      setImageBase64(base64);
    };
    base64Reader.readAsDataURL(file);
  }

  // 画像をクリア
  function clearImage() {
    setSelectedImage(null);
    setImageBase64("");
    setImagePreview("");
  }

  // Escキーでモーダルを閉じる
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isImageModalOpen) {
        setIsImageModalOpen(false);
      }
    }

    if (isImageModalOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isImageModalOpen]);

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Ask Then Answer</h1>
        <p className="text-sm text-muted-foreground">
          質問 →（必要なら）確認 → 回答 → 品質チェック のシンプルなデモ<br />
          🖼️ 画像もアップロードして AI に質問できます！
        </p>

        <Card className="p-4 space-y-3">
          <label className="text-sm font-medium">質問</label>
          <Textarea
            placeholder="例）RAGをプロダクション導入する手順を3ステップで教えて。"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-[120px]"
          />

          {/* 画像アップロード部分 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">画像アップロード（任意）</label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:bg-primary file:text-primary-foreground"
              />
              {selectedImage && (
                <Button onClick={clearImage} className="text-sm px-3 py-1 border border-border bg-background hover:bg-accent">
                  削除
                </Button>
              )}
            </div>
            {imagePreview && (
              <div className="mt-2">
                <img
                  src={imagePreview}
                  alt="アップロード画像"
                  className="max-w-xs max-h-40 object-contain rounded border cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setIsImageModalOpen(true)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedImage?.name} ({((selectedImage?.size || 0) / 1024 / 1024).toFixed(2)} MB)
                  <span className="text-blue-600 ml-2">クリックで拡大</span>
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={firstAsk} disabled={!query || loading}>
              {loading ? "問い合わせ中..." : "送信"}
            </Button>
            <Button
              onClick={() => {
                setQuery("");
                setAnswer(undefined);
                setJudge(undefined);
                setReason(undefined);
                setNeedsClarify(false);
                setQuestions([]);
                setClarifyAnswers([]);
                setRole(undefined);
                clearImage();
              }}
            >
              クリア
            </Button>
          </div>
        </Card>

        {role && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">選択されたロール:</span>
            <Badge> {role} </Badge>
          </div>
        )}

        {needsClarify && (
          <Card className="p-4 space-y-3">
            <h2 className="text-lg font-semibold">追加で教えてください</h2>
            <p className="text-sm text-muted-foreground">
              分かる範囲でOKです。空欄でも送信できます。
            </p>
            <Separator />
            <div className="space-y-3">
              {questions.map((q, i) => (
                <div key={i} className="space-y-1">
                  <label className="text-sm font-medium">
                    Q{i + 1}. {q}
                  </label>
                  <Input
                    value={clarifyAnswers[i] ?? ""}
                    onChange={(e) => {
                      const next = [...clarifyAnswers];
                      next[i] = e.target.value;
                      setClarifyAnswers(next);
                    }}
                    placeholder="あなたの回答"
                  />
                </div>
              ))}
            </div>
            <div className="pt-2">
              <Button onClick={sendClarifications} disabled={loading}>
                {loading ? "送信中..." : "確認して回答を生成"}
              </Button>
            </div>
          </Card>
        )}

        {answer && (
          <Card className="p-4 space-y-3">
            <h2 className="text-lg font-semibold">回答</h2>
            <Separator />
            <div className="prose whitespace-pre-wrap">{answer}</div>
            <Separator />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">品質チェック:</span>
              {judge ? <Badge>OK</Badge> : <Badge variant="destructive">要改善</Badge>}
              {reason && <span className="text-sm text-muted-foreground">（理由: {reason}）</span>}
            </div>
          </Card>
        )}

        {/* 画像拡大表示モーダル */}
        {isImageModalOpen && imagePreview && (
          <div
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
            onClick={() => setIsImageModalOpen(false)}
          >
            <div className="relative max-w-4xl max-h-full">
              <img
                src={imagePreview}
                alt="拡大画像"
                className="max-w-full max-h-full object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={() => setIsImageModalOpen(false)}
                className="absolute top-4 right-4 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 transition-all"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-6 h-6"
                >
                  <path
                    d="M18 6L6 18M6 6L18 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white px-3 py-2 rounded">
                <p className="text-sm">
                  {selectedImage?.name} • {((selectedImage?.size || 0) / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
