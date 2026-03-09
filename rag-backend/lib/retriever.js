import fs from "node:fs";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "has",
  "have",
  "in",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "was",
  "were",
  "with"
]);

const TOKEN_PATTERN = /[a-zA-Z0-9]{2,}/g;

function tokenize(text) {
  if (!text) {
    return [];
  }

  const lowered = text.toLowerCase();
  const matches = lowered.match(TOKEN_PATTERN) || [];
  return matches.filter((token) => !STOP_WORDS.has(token));
}

function buildFrequencyMap(tokens) {
  const map = new Map();
  for (const token of tokens) {
    map.set(token, (map.get(token) || 0) + 1);
  }
  return map;
}

export function loadCorpus(corpusPath) {
  const raw = JSON.parse(fs.readFileSync(corpusPath, "utf8"));
  const sourceChunks = Array.isArray(raw.chunks) ? raw.chunks : [];

  const chunks = sourceChunks
    .filter((chunk) => typeof chunk.text === "string" && chunk.text.trim().length > 0)
    .map((chunk, index) => {
      const tokens = tokenize(chunk.text);
      const tf = buildFrequencyMap(tokens);
      const titleTokens = tokenize(chunk.title || "");
      const titleTokenSet = new Set(titleTokens);

      return {
        id: chunk.id || `chunk-${index + 1}`,
        file_name: chunk.file_name || "unknown.pdf",
        title: chunk.title || "Untitled",
        page: Number.isInteger(chunk.page) ? chunk.page : null,
        text: chunk.text,
        tokens,
        tf,
        titleTokenSet,
        length: tokens.length || 1
      };
    });

  const docCount = chunks.length;
  const avgDocLength =
    docCount > 0
      ? chunks.reduce((sum, chunk) => sum + chunk.length, 0) / docCount
      : 1;

  const docFreq = new Map();
  for (const chunk of chunks) {
    const unique = new Set(chunk.tokens);
    unique.forEach((token) => {
      docFreq.set(token, (docFreq.get(token) || 0) + 1);
    });
  }

  const idf = new Map();
  docFreq.forEach((freq, token) => {
    // BM25 IDF (smoothed).
    const value = Math.log(1 + (docCount - freq + 0.5) / (freq + 0.5));
    idf.set(token, value);
  });

  return {
    meta: {
      generated_at: raw.generated_at || null,
      chunk_count: chunks.length,
      source_dir: raw.source_dir || null
    },
    chunks,
    idf,
    avgDocLength
  };
}

export function retrieveTopChunks(index, query, topK = 6) {
  const queryTokens = tokenize(query);
  const queryTokenSet = new Set(queryTokens);
  if (queryTokens.length === 0 || index.chunks.length === 0) {
    return [];
  }

  const k1 = 1.5;
  const b = 0.75;

  const scored = index.chunks.map((chunk) => {
    let score = 0;
    let queryMatchCount = 0;

    for (const token of queryTokens) {
      const tf = chunk.tf.get(token) || 0;
      if (tf === 0) {
        continue;
      }
      queryMatchCount += 1;

      const idf = index.idf.get(token) || 0;
      const denom = tf + k1 * (1 - b + b * (chunk.length / index.avgDocLength));
      score += idf * ((tf * (k1 + 1)) / denom);
    }

    let titleBoost = 0;
    queryTokenSet.forEach((token) => {
      if (chunk.titleTokenSet.has(token)) {
        titleBoost += 1;
      }
    });
    score += titleBoost * 1.35;

    return {
      ...chunk,
      score,
      queryMatchCount
    };
  });

  return scored
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export function buildContext(chunks, maxCharacters = 8500) {
  const sections = [];
  let currentLength = 0;

  for (const chunk of chunks) {
    const pageLabel = Number.isInteger(chunk.page) ? `p.${chunk.page}` : "p.n/a";
    const header = `[${chunk.title} | ${chunk.file_name} | ${pageLabel}]\n`;
    const body = `${chunk.text.trim()}\n`;
    const block = `${header}${body}\n`;

    if (currentLength + block.length > maxCharacters) {
      break;
    }

    sections.push(block);
    currentLength += block.length;
  }

  return sections.join("\n");
}

export function buildCitations(chunks, maxCitations = 4) {
  const unique = [];
  const seen = new Set();

  for (const chunk of chunks) {
    const key = `${chunk.file_name}:${chunk.page || "na"}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push({
      file_name: chunk.file_name,
      title: chunk.title,
      page: Number.isInteger(chunk.page) ? chunk.page : null,
      snippet: chunk.text.slice(0, 240).trim()
    });

    if (unique.length >= maxCitations) {
      break;
    }
  }

  return unique;
}

export function buildExtractiveFallback(chunks) {
  if (!chunks.length) {
    return "I could not find relevant passages in the publication corpus.";
  }

  const lines = chunks.slice(0, 3).map((chunk, index) => {
    const shortText = chunk.text.slice(0, 260).replace(/\s+/g, " ").trim();
    return `${index + 1}. ${shortText}`;
  });

  return `I found relevant passages in your publications:\n\n${lines.join("\n\n")}`;
}
