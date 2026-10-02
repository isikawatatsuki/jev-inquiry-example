import { choice, noul, score, TypeSafeClient } from "@typesafe-ai/sdk";

export const client = new TypeSafeClient({
    baseURL: "https://api.typesafe.ai",
    logLevel: "off",
    retry: { maxRetries: 0},
});

export const questions = {
    department: choice("この問い合わせを最初に担当する部署はどこですか？", {
        billing: "請求、二重請求、支払い、返金の問題",
        technical: "ログイン、エラー、不具合、外部サービスとの連携の問題",
        sales: "購入前の料金プラン、機能、導入についての相談",
        other: "どの部署にも当てはまらない、または判断に必要な情報がない",
    }),
    isUrgent: noul("この問い合わせには、急いで対応してほしいという明治的な要求や期限がありますか？"),
    frustration: score("問い合わせを書いた顧客はどの程度の不満を表していますか？", [
        "不満を表さず、落ち着いて質問や事実を述べている",
        "不満や困惑を表しているが、丁寧に対応を求めいている",
        "強い怒りや避難を表している、または不満を理由に解約すると述べている",
    ]),
}

export async function evaluateTicket(ticket: string) {
    return client.systemOne({ model: "jev-latest", state: { ticket }, questions });
}

type Answers = Awaited<ReturnType<typeof evaluateTicket>>["answers"];

export function decideRoute(answers: Answers) {
    const { department, isUrgent, frustration } = answers;
    // confidenceが低いかotherの場合は人の確認に回す
    if (department.choice === "other" || department.confidence < 0.8) {
        return { queue: "manual_review", priority: "needs_review" } as const;
    }

    if (isUrgent.noul >= 0.8 || (frustration.confidence >= 0.8 && frustration.score >= 1.5)) {
        return { queue: department.choice, priority: "high" } as const;
    }

    if (isUrgent.noul >= 0.2 || frustration.confidence < 0.8) {
        return { queue: department.choice, priority: "needs_review" } as const;
    }

    return { queue: department.choice, priority: "normal" } as const;
}
