"use client";

import { useState } from "react";
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

    const res = await fetch(`${API_BASE}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data: AskResponse = await res.json();

    setLoading(false);
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
  }

  async function sendClarifications() {
    setLoading(true);
    const res = await fetch(`${API_BASE}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, clarifications: clarifyAnswers }),
    });
    const data: AskResponse = await res.json();
    setLoading(false);

    setNeedsClarify(false);
    setAnswer(data.answer);
    setJudge(data.judge);
    setReason(data.reason);
    setRole(data.role);
  }

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Ask Then Answer</h1>
        <p className="text-sm text-muted-foreground">
          質問 →（必要なら）確認 → 回答 → 品質チェック のシンプルなデモ
        </p>

        <Card className="p-4 space-y-3">
          <label className="text-sm font-medium">質問</label>
          <Textarea
            placeholder="例）RAGをプロダクション導入する手順を3ステップで教えて。"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-[120px]"
          />
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
      </div>
    </main>
  );
}
