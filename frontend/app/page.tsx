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
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imageBase64List, setImageBase64List] = useState<string[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isImageModalOpen, setIsImageModalOpen] = useState<boolean>(false);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);

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
          image_base64: imageBase64List.length > 0 ? imageBase64List[0] : undefined,
          images_base64: imageBase64List.length > 0 ? imageBase64List : undefined
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
          image_base64: imageBase64List.length > 0 ? imageBase64List[0] : undefined,
          images_base64: imageBase64List.length > 0 ? imageBase64List : undefined
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

  // 複数画像ファイル選択時の処理
  async function handleImageSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // ファイルサイズチェック（5MB制限）
    const oversizedFiles = files.filter(file => file.size > 5 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      alert(`以下のファイルは5MB以下にしてください: ${oversizedFiles.map(f => f.name).join(', ')}`);
      return;
    }

    // 最大5ファイルまで
    if (files.length > 5) {
      alert("ファイルは最大5個まで選択できます");
      return;
    }

    setSelectedImages(files);

    // 各ファイルのプレビューとBase64変換を並行処理
    const previews: string[] = [];
    const base64List: string[] = [];

    const processFile = (file: File): Promise<{preview: string, base64: string}> => {
      return new Promise((resolve) => {
        // プレビュー用
        const previewReader = new FileReader();
        previewReader.onload = (e1) => {
          const preview = e1.target?.result as string;

          // Base64用
          const base64Reader = new FileReader();
          base64Reader.onload = (e2) => {
            const result = e2.target?.result as string;
            const base64 = result.split(',')[1];
            resolve({ preview, base64 });
          };
          base64Reader.readAsDataURL(file);
        };
        previewReader.readAsDataURL(file);
      });
    };

    // 全ファイルの処理を待つ
    try {
      const results = await Promise.all(files.map(processFile));
      setImagePreviews(results.map(r => r.preview));
      setImageBase64List(results.map(r => r.base64));
    } catch (error) {
      console.error("ファイル処理エラー:", error);
      alert("ファイルの処理中にエラーが発生しました");
    }
  }

  // 画像をクリア
  function clearImages() {
    setSelectedImages([]);
    setImageBase64List([]);
    setImagePreviews([]);
    setCurrentImageIndex(0);
  }

  // 個別の画像を削除
  function removeImage(index: number) {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImageBase64List(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));

    // 現在表示中の画像を削除した場合、インデックスを調整
    if (index === currentImageIndex && currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
    }
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
                multiple
                onChange={handleImageSelect}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:bg-primary file:text-primary-foreground"
              />
              {selectedImages.length > 0 && (
                <Button onClick={clearImages} className="text-sm px-3 py-1 border border-border bg-background hover:bg-accent">
                  全削除
                </Button>
              )}
            </div>
            {imagePreviews.length > 0 && (
              <div className="mt-2">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={preview}
                        alt={`アップロード画像 ${index + 1}`}
                        className="w-full h-24 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => {
                          setCurrentImageIndex(index);
                          setIsImageModalOpen(true);
                        }}
                      />
                      <button
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                      <div className="absolute bottom-1 left-1 bg-black bg-opacity-70 text-white text-xs px-1 rounded">
                        {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {selectedImages.length}個のファイル • 合計 {(selectedImages.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(2)} MB
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
                clearImages();
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
        {isImageModalOpen && imagePreviews.length > 0 && (
          <div
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
            onClick={() => setIsImageModalOpen(false)}
          >
            <div className="relative max-w-4xl max-h-full">
              <img
                src={imagePreviews[currentImageIndex]}
                alt={`拡大画像 ${currentImageIndex + 1}`}
                className="max-w-full max-h-full object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />

              {/* 複数画像がある場合のナビゲーション */}
              {selectedImages.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : selectedImages.length - 1))}
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 transition-all"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                      <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => setCurrentImageIndex((prev) => (prev < selectedImages.length - 1 ? prev + 1 : 0))}
                    className="absolute right-16 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 transition-all"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                      <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </>
              )}

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
                  {selectedImages[currentImageIndex]?.name} • {((selectedImages[currentImageIndex]?.size || 0) / 1024 / 1024).toFixed(2)} MB
                  {selectedImages.length > 1 && ` • ${currentImageIndex + 1}/${selectedImages.length}`}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
