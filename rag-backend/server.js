import path from "node:path";
import { fileURLToPath } from "node:url";

import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import OpenAI from "openai";

import {
  buildCitations,
  buildContext,
  buildExtractiveFallback,
  loadCorpus,
  retrieveTopChunks
} from "./lib/retriever.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 8787);
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const MIN_RETRIEVAL_SCORE = Number(process.env.MIN_RETRIEVAL_SCORE || 2.1);
const MIN_QUERY_TOKEN_MATCHES = Number(process.env.MIN_QUERY_TOKEN_MATCHES || 2);
const OUT_OF_SCOPE_ANSWER =
  "I can only answer using information from Samantha's uploaded publication papers. I could not find enough relevant evidence for that question in those papers.";
const CORPUS_PATH = path.resolve(
  __dirname,
  process.env.CORPUS_PATH || "./data/corpus.json"
);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser clients and same-origin requests.
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin not allowed: ${origin}`));
    }
  })
);

let index;
try {
  index = loadCorpus(CORPUS_PATH);
  console.log(
    `Loaded corpus from ${CORPUS_PATH} with ${index.meta.chunk_count} chunks.`
  );
} catch (error) {
  console.error(`Failed to load corpus from ${CORPUS_PATH}`);
  console.error(error);
  process.exit(1);
}

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function looksLikeInsufficientContextAnswer(answer) {
  if (!answer) {
    return false;
  }

  const normalized = answer.toLowerCase();
  const signals = [
    "retrieved context",
    "context does not provide",
    "context is insufficient",
    "insufficient context",
    "therefore, i don't know",
    "therefore i don't know",
    "i do not know"
  ];

  return signals.some((signal) => normalized.includes(signal));
}

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    corpus_chunks: index.meta.chunk_count,
    model: MODEL,
    has_openai_key: Boolean(process.env.OPENAI_API_KEY)
  });
});

app.post("/api/chat", async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  const incomingHistory = Array.isArray(req.body?.history) ? req.body.history : [];

  if (!message) {
    res.status(400).json({ error: "Missing message." });
    return;
  }

  const topChunks = retrieveTopChunks(index, message, 6);
  const citations = buildCitations(topChunks, 4);
  const bestChunk = topChunks[0];
  const isWeakRetrieval =
    !bestChunk ||
    bestChunk.score < MIN_RETRIEVAL_SCORE ||
    bestChunk.queryMatchCount < MIN_QUERY_TOKEN_MATCHES;

  if (isWeakRetrieval) {
    res.json({
      answer: OUT_OF_SCOPE_ANSWER,
      citations: []
    });
    return;
  }

  if (!openai) {
    res.json({
      answer: buildExtractiveFallback(topChunks),
      citations
    });
    return;
  }

  const context = buildContext(topChunks);

  const compactHistory = incomingHistory
    .filter(
      (item) =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string"
    )
    .slice(-8)
    .map((item) => `${item.role.toUpperCase()}: ${item.content}`)
    .join("\n");

  const systemPrompt =
    "You are a research assistant for Samantha Weber's publication website. " +
    "Answer only from the retrieved context. Do not use outside knowledge. " +
    "If the context is insufficient or the question is outside these papers, respond exactly with: " +
    `"${OUT_OF_SCOPE_ANSWER}" ` +
    "Do not mention 'retrieved context' in the final answer. " +
    "Be concise and factual. When relevant, refer to citations as [1], [2], etc.";

  const userPrompt = [
    "Question:",
    message,
    "",
    compactHistory ? "Recent chat history:\n" + compactHistory + "\n" : "",
    "Retrieved context:",
    context,
    "",
    "Provide an answer grounded in the context above."
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const result = await openai.responses.create({
      model: MODEL,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.2
    });

    const rawAnswer = (result.output_text || "").trim();
    const answer = looksLikeInsufficientContextAnswer(rawAnswer)
      ? OUT_OF_SCOPE_ANSWER
      : rawAnswer;

    res.json({
      answer:
        answer ||
        "I could not generate an answer from the retrieved publication context.",
      citations
    });
  } catch (error) {
    console.error("OpenAI request failed:", error);
    res.status(502).json({
      error: "Model request failed.",
      answer: "The chatbot could not reach the language model right now.",
      citations
    });
  }
});

app.listen(PORT, () => {
  console.log(`RAG backend running on http://localhost:${PORT}`);
});
