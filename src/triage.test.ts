import assert from "node:assert/strict";
import { test } from "node:test";

const originalApiKey = process.env.TYPESAFE_API_KEY;
process.env.TYPESAFE_API_KEY = "test-key";
const { decideRoute, questions } = await import("./triage.ts");
if (originalApiKey === undefined) delete process.env.TYPESAFE_API_KEY;
else process.env.TYPESAFE_API_KEY = originalApiKey;

type Answers = Parameters<typeof decideRoute>[0];

function makeAnswers(overrides: Partial<Answers> = {}): Answers {
    return {
        department: {
            type: "choice",
            choice: "technical",
            confidence: 0.9,
            probabilities: { billing: 0.05, technical: 0.9, sales: 0.03, other: 0.02 },
        },
        isUrgent: { type: "noul", noul: 0.1 },
        frustration: {
            type: "score",
            score: 0.2,
            confidence: 0.9,
            legend: {
                0: questions.frustration.criteria[0],
                1: questions.frustration.criteria[1],
                2: questions.frustration.criteria[2],
            },
            probabilities: { 0: 0.8, 1: 0.2, 2: 0 },
        },
        ...overrides,
    };
}

test("落ち着いた問い合わせは通常優先度", () => {
    assert.deepEqual(decideRoute(makeAnswers()), { queue: "technical", priority: "normal" });
});

test("その他の部署は人による確認", () => {
    const answers = makeAnswers({
        department: { ...makeAnswers().department, choice: "other" },
    });
    assert.deepEqual(decideRoute(answers), { queue: "manual_review", priority: "needs_review" });
});

test("部署の確信度が低ければ緊急でも人による確認", () => {
    const answers = makeAnswers({
        department: { ...makeAnswers().department, confidence: 0.79 },
        isUrgent: { type: "noul", noul: 0.9 },
    });
    assert.deepEqual(decideRoute(answers), { queue: "manual_review", priority: "needs_review" });
});

test("緊急度が0.8なら高優先度", () => {
    const answers = makeAnswers({
        department: { ...makeAnswers().department, confidence: 0.8 },
        isUrgent: { type: "noul", noul: 0.8 },
    });
    assert.deepEqual(decideRoute(answers), { queue: "technical", priority: "high" });
});

test("不満度が1.5で確信度が0.8なら高優先度", () => {
    const answers = makeAnswers({
        frustration: { ...makeAnswers().frustration, score: 1.5, confidence: 0.8 },
    });
    assert.deepEqual(decideRoute(answers), { queue: "technical", priority: "high" });
});

test("緊急度が0.2なら要確認", () => {
    const answers = makeAnswers({ isUrgent: { type: "noul", noul: 0.2 } });
    assert.deepEqual(decideRoute(answers), { queue: "technical", priority: "needs_review" });
});

test("不満度の確信度が低ければ要確認", () => {
    const answers = makeAnswers({
        frustration: { ...makeAnswers().frustration, score: 2, confidence: 0.79 },
    });
    assert.deepEqual(decideRoute(answers), { queue: "technical", priority: "needs_review" });
});
