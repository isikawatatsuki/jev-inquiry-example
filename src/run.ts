import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { evaluateTicket, decideRoute } from "./triage.ts";

const queueLabels = {
    billing: "請求・返金",
    technical: "技術サポート",
    sales: "営業",
    other: "その他",
    manual_review: "人による確認",
};

const priorityLabels = {
    high: "高",
    normal: "通常",
    needs_review: "要確認",
};

function formatResult(response: Awaited<ReturnType<typeof evaluateTicket>>) {
    const route = decideRoute(response.answers);
    return {
        担当: queueLabels[route.queue],
        優先度: priorityLabels[route.priority],
        部署判定の確信度: response.answers.department.confidence,
        緊急度: response.answers.isUrgent.noul,
        不満度: response.answers.frustration.score,
        不満度判定の確信度: response.answers.frustration.confidence,
    };
}

async function runInteractive() {
    const prompt = createInterface({ input: stdin, output: stdout });
    const controller = new AbortController();
    prompt.once("close", () => controller.abort());
    let ticket: string;
    try {
        ticket = (await prompt.question("Q>お問い合わせはなんでしょうか\nA> ", {
            signal: controller.signal,
        })).trim();
    } catch {
        console.error("入力を中断しました");
        process.exitCode = 1;
        return;
    } finally {
        prompt.close();
    }
    if (!ticket) {
        console.error("問い合わせ内容を入力してください");
        process.exitCode = 1;
        return;
    }

    console.log("\n結果");
    try {
        const response = await evaluateTicket(ticket);
        console.log(JSON.stringify({
            問い合わせ: ticket,
            ...formatResult(response),
        }, null, 2));
    } catch {
        console.log(JSON.stringify({
            問い合わせ: ticket,
            エラー: "問い合わせを評価できませんでした。未分類として確認してください",
            担当: queueLabels.manual_review,
            優先度: priorityLabels.needs_review,
        }, null, 2));
        process.exitCode = 1;
    }
}

try {
    await runInteractive();
} catch (error) {
    console.error("問い合わせを評価できませんでした。未分類として確認してください");
    process.exitCode = 1;
}
