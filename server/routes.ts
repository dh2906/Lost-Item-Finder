import type { Express } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const qwen = process.env.QWEN_API_KEY
  ? new OpenAI({
      apiKey: process.env.QWEN_API_KEY,
      baseURL:
        process.env.QWEN_BASE_URL ??
        "https://coding-intl.dashscope.aliyuncs.com/v1",
    })
  : null;

const GPT_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL ?? "gpt-4o-mini";
const QWEN_VISION_MODEL = process.env.QWEN_VISION_MODEL ?? "qwen3.5-plus";
const OPENAI_EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
const VECTOR_CANDIDATE_COUNT = Number(process.env.VECTOR_CANDIDATE_COUNT ?? 20);
const FINAL_RESULT_COUNT = Number(process.env.FINAL_RESULT_COUNT ?? 12);

function getQwenClient(): OpenAI {
  if (!qwen) {
    throw new Error("QWEN_API_KEY is not configured");
  }

  return qwen;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  return "Internal server error";
}

function validateSearchPrompt(prompt: string): string | null {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (normalized.length < 2) {
    return "검색어가 너무 짧아요. 물건 특징을 조금 더 입력해 주세요.";
  }

  const meaningfulChars = normalized.match(/[가-힣A-Za-z0-9]/g)?.length ?? 0;
  if (meaningfulChars < 2) {
    return "의미 있는 검색어를 입력해 주세요.";
  }

  const jamoCount = normalized.match(/[ㄱ-ㅎㅏ-ㅣ]/g)?.length ?? 0;
  const alnumKoreanCount = normalized.match(/[가-힣A-Za-z0-9]/g)?.length ?? 0;
  const totalSignal = jamoCount + alnumKoreanCount;
  const jamoRatio = totalSignal > 0 ? jamoCount / totalSignal : 0;

  if (jamoCount >= 3 || jamoRatio > 0.25) {
    return "자음/모음만 섞인 입력이 많아요. 물건 특징을 자연어로 입력해 주세요.";
  }

  const isEnglishOnly = /^[A-Za-z\s]+$/.test(normalized);
  if (isEnglishOnly) {
    const tokens = normalized.toLowerCase().split(/\s+/).filter(Boolean);

    const suspiciousTokenCount = tokens.filter((token) => {
      if (token.length < 6) {
        return false;
      }

      const vowelCount = token.match(/[aeiou]/g)?.length ?? 0;
      const vowelRatio = vowelCount / token.length;
      const uniqueRatio = new Set(token).size / token.length;

      return vowelRatio < 0.22 || uniqueRatio < 0.3;
    }).length;

    if (
      (tokens.length === 1 && tokens[0].length >= 7 && suspiciousTokenCount >= 1) ||
      suspiciousTokenCount >= 2
    ) {
      return "영문 난타처럼 보여요. 물건 특징을 문장으로 입력해 주세요. (예: black leather wallet with silver clip)";
    }
  }

  return null;
}

function buildItemSearchText(item: {
  title?: string | null;
  description?: string | null;
  itemCategory?: string | null;
  color?: string | null;
  size?: string | null;
  tags?: string[] | null;
  location?: string | null;
}): string {
  const sections = [
    item.title ? `제목: ${item.title}` : null,
    item.itemCategory ? `카테고리: ${item.itemCategory}` : null,
    item.color ? `색상: ${item.color}` : null,
    item.size ? `크기: ${item.size}` : null,
    item.description ? `설명: ${item.description}` : null,
    item.location ? `위치: ${item.location}` : null,
    item.tags?.length ? `태그: ${item.tags.join(", ")}` : null,
  ].filter((value): value is string => Boolean(value));

  return sections.join("\n");
}

function normalizeKoreanText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^가-힣a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractQueryKeywords(queryText: string): string[] {
  const tokens = normalizeKoreanText(queryText)
    .split(" ")
    .filter((token) => token.length >= 2)
    .filter((token) => !/^\d+$/.test(token));

  return Array.from(new Set(tokens)).slice(0, 20);
}

function getItemEvidenceText(item: {
  title?: string | null;
  description?: string | null;
  itemCategory?: string | null;
  color?: string | null;
  size?: string | null;
  tags?: string[] | null;
  location?: string | null;
}): string {
  return [
    item.title,
    item.description,
    item.itemCategory,
    item.color,
    item.size,
    item.location,
    item.tags?.join(" "),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

function buildReasoningFromEvidence(params: {
  queryText: string;
  item: {
    title?: string | null;
    itemCategory?: string | null;
    color?: string | null;
    size?: string | null;
    tags?: string[] | null;
    description?: string | null;
  };
  matchScore: number;
  llmReasoning?: string;
}): string {
  const { queryText, item, matchScore, llmReasoning } = params;

  const keywords = extractQueryKeywords(queryText);
  const evidenceText = normalizeKoreanText(getItemEvidenceText(item));
  const matchedKeywords = keywords.filter((keyword) => evidenceText.includes(keyword)).slice(0, 4);

  const detailClauses: string[] = [];
  if (item.itemCategory) {
    detailClauses.push(`카테고리는 '${item.itemCategory}'로 분류돼 있고`);
  }
  if (item.color) {
    detailClauses.push(`색상은 '${item.color}' 계열로 보이며`);
  }
  if (item.size) {
    detailClauses.push(`크기 정보는 '${item.size}'에 가깝습니다`);
  }
  if (item.tags?.length) {
    detailClauses.push(`태그에는 ${item.tags.slice(0, 3).join(", ")} 같은 특징이 포함돼 있어요`);
  }

  const evidenceSummary =
    matchedKeywords.length > 0
      ? `입력하신 표현 중 ${matchedKeywords.join(", ")} 키워드가 후보 정보와 직접 겹칩니다.`
      : detailClauses.length > 0
        ? `${detailClauses.slice(0, 2).join(", ")}.`
        : "후보 설명과의 의미 유사도를 기준으로 우선 노출되었습니다.";

  const scorePercent = (Math.max(0, Math.min(1, matchScore)) * 100).toFixed(1);
  const normalizedScore = Math.max(0, Math.min(1, matchScore));

  const scoreSummary =
    normalizedScore >= 0.75
      ? `최종 매칭 점수가 약 ${scorePercent}%로 높아, 실제 동일 물건일 가능성이 큽니다.`
      : normalizedScore >= 0.45
        ? `최종 매칭 점수는 약 ${scorePercent}%로 중간 수준입니다. 일부 특징은 맞지만 추가 확인이 필요합니다.`
        : normalizedScore >= 0.25
          ? `최종 매칭 점수는 약 ${scorePercent}%로 낮은 편이라 참고용 후보로 보는 것이 좋습니다.`
          : `최종 매칭 점수는 약 ${scorePercent}%로 매우 낮아, 관련성이 약한 후보일 수 있습니다.`;
  const normalizedLlmReasoning = llmReasoning?.trim();

  if (normalizedLlmReasoning) {
    return `${normalizedLlmReasoning} ${evidenceSummary} ${scoreSummary}`;
  }

  return `${evidenceSummary} ${scoreSummary}`;
}

async function createEmbedding(text: string): Promise<number[]> {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    throw new Error("임베딩할 검색 텍스트가 없습니다");
  }

  const response = await openai.embeddings.create({
    model: OPENAI_EMBEDDING_MODEL,
    input: normalized,
  });

  const embedding = response.data[0]?.embedding;
  if (!embedding) {
    throw new Error("임베딩 생성에 실패했습니다");
  }

  return embedding;
}

async function createImageSearchText(imageUrl: string): Promise<string> {
  const response = await getQwenClient().chat.completions.create({
    model: QWEN_VISION_MODEL,
    messages: [
      {
        role: "system",
        content:
          "너는 분실물 검색용 이미지 요약 도우미다. 제공된 이미지를 보고 검색에 도움이 되는 한국어 JSON 객체만 반환해라. 형식은 {\"itemCategory\":\"...\",\"color\":\"...\",\"size\":\"...\",\"tags\":[\"...\"],\"description\":\"...\"} 이다.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "이 이미지를 분실물 검색용 텍스트로 요약해줘. 반드시 한국어 JSON만 반환해줘.",
          },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("이미지 검색 텍스트 생성에 실패했습니다");
  }

  const parsed = JSON.parse(content);
  return buildItemSearchText({
    itemCategory: parsed.itemCategory,
    color: parsed.color,
    size: parsed.size,
    description: parsed.description,
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
  });
}

async function ensureItemEmbedding(item: {
  id: number;
  title?: string | null;
  description?: string | null;
  itemCategory?: string | null;
  color?: string | null;
  size?: string | null;
  tags?: string[] | null;
  location?: string | null;
}): Promise<void> {
  const content = buildItemSearchText(item);
  const embedding = await createEmbedding(content);
  await storage.upsertItemEmbedding(item.id, content, embedding);
}

async function backfillFoundItemEmbeddings(): Promise<void> {
  const missingItems = await storage.getFoundItemsWithoutEmbeddings();

  for (const item of missingItems) {
    await ensureItemEmbedding(item);
  }
}

type VectorCandidate = Awaited<ReturnType<typeof storage.searchFoundItemsByEmbedding>>[number];

async function rerankCandidates(params: {
  prompt?: string;
  imageUrl?: string;
  queryText: string;
  candidates: VectorCandidate[];
}): Promise<Array<{ itemId: number; score: number; reasoning: string }>> {
  const { prompt, imageUrl, queryText, candidates } = params;
  const aiClient = imageUrl ? getQwenClient() : openai;
  const model = imageUrl ? QWEN_VISION_MODEL : GPT_TEXT_MODEL;

  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text: [
        "다음은 벡터 검색으로 먼저 추린 습득물 후보 목록이다.",
        "사용자 분실물 정보와 각 후보를 비교해서 실제로 같은 물건일 가능성을 다시 평가해라.",
        "반드시 JSON 객체만 반환하고 형식은 {\"matches\": [{\"itemId\": 1, \"score\": 0.91, \"reasoning\": \"한국어 설명\"}]} 이어야 한다.",
        "score는 0부터 1 사이 숫자여야 하고, reasoning은 자연스러운 한국어 한두 문장이어야 한다.",
        `사용자 검색 텍스트:\n${queryText}`,
        prompt ? `사용자 원문 설명:\n${prompt}` : null,
        `후보 목록:\n${JSON.stringify(
          candidates.map((candidate) => ({
            itemId: candidate.item.id,
            vectorScore: Number(candidate.score.toFixed(4)),
            title: candidate.item.title,
            description: candidate.item.description,
            itemCategory: candidate.item.itemCategory,
            color: candidate.item.color,
            size: candidate.item.size,
            tags: candidate.item.tags,
            location: candidate.item.location,
          })),
        )}`,
      ]
        .filter((value): value is string => Boolean(value))
        .join("\n\n"),
    },
  ];

  if (imageUrl) {
    userContent.push({ type: "image_url", image_url: { url: imageUrl } });
  }

  const response = await aiClient.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "너는 분실물-습득물 매칭 재랭킹 도우미다. 벡터 검색 후보 중에서 실제로 일치할 가능성이 높은 항목만 골라 다시 점수화해라. 반드시 JSON 객체만 반환하고, reasoning은 모두 한국어로 작성해라.",
      },
      {
        role: "user",
        content: userContent,
      },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error("재랭킹 응답을 받지 못했습니다");
  }

  const parsed = JSON.parse(content);
  const matches: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.matches)
      ? parsed.matches
      : [];

  return matches
    .map((match: unknown) => {
      const result = z
        .object({
          itemId: z.number(),
          score: z.number(),
          reasoning: z.string(),
        })
        .safeParse(match);

      return result.success ? result.data : null;
    })
    .filter((match): match is { itemId: number; score: number; reasoning: string } => Boolean(match));
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // --- Auth API ---
  app.post(api.auth.register.path, async (req, res) => {
    try {
      const input = api.auth.register.input.parse(req.body);
      
      const existingUser = await storage.getUserByUsername(input.username);
      if (existingUser) {
        return res.status(400).json({ message: "이미 존재하는 아이디입니다" });
      }
      
      const user = await storage.createUser(input);
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "로그인 처리 중 오류가 발생했습니다" });
        }
        const { password: _, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (err) {
      console.error("Register error:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: err instanceof Error ? err.message : "Internal server error" });
    }
  });

  app.post(api.auth.login.path, (req, res, next) => {
    passport.authenticate("local", (err: Error | null, user: Express.User | false, info: { message: string } | undefined) => {
      if (err) {
        return res.status(500).json({ message: "Internal server error" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "로그인에 실패했습니다" });
      }
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "로그인 처리 중 오류가 발생했습니다" });
        }
        const { password: _, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "로그아웃 중 오류가 발생했습니다" });
      }
      res.json({ message: "로그아웃 되었습니다" });
    });
  });

  app.get(api.auth.me.path, (req, res) => {
    if (!req.user) {
      return res.json(null);
    }
    const { password: _, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });

  // --- Items API ---
  app.get(api.items.list.path, async (req, res) => {
    try {
      const type = req.query.type as "lost" | "found" | undefined;
      const search = req.query.search as string | undefined;
      const itemsList = await storage.getItems(type, search);
      res.json(itemsList);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.items.get.path, async (req, res) => {
    try {
      const item = await storage.getItem(Number(req.params.id));
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }
      res.json(item);
    } catch (err) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.items.create.path, async (req, res) => {
    try {
      const input = api.items.create.input.parse(req.body);
      const item = await storage.createItem(input);

      if (item.reportType === "found") {
        try {
          await ensureItemEmbedding(item);
        } catch (embeddingError) {
          console.error("Failed to store item embedding:", embeddingError);
        }
      }

      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // --- AI API ---
  app.post(api.ai.analyzeImage.path, async (req, res) => {
    try {
      const input = api.ai.analyzeImage.input.parse(req.body);
      
      const response = await getQwenClient().chat.completions.create({
        model: QWEN_VISION_MODEL,
        messages: [
          {
            role: "system",
            content: "너는 분실물 보관 시스템에서 습득물을 분류하는 AI 도우미다. 제공된 이미지를 분석해서 다음 메타데이터를 한국어로 추출해라: itemCategory(예: 지갑, 휴대폰, 열쇠), color, size(예: 소형, 중형, 대형), tags(설명형 키워드 배열), description(짧고 명확한 설명). 반드시 JSON 객체만 반환하고, 값은 모두 자연스러운 한국어로 작성해라."
          },
          {
            role: "user",
            content: [
              { type: "text", text: "이 이미지를 분석하고 메타데이터를 JSON 형식으로 한국어로 반환해줘." },
              { type: "image_url", image_url: { url: input.imageUrl } }
            ]
          }
        ],
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("Failed to get response from AI");
      }

      const result = JSON.parse(content);
      res.json({
        itemCategory: result.itemCategory || "알 수 없음",
        color: result.color || "알 수 없음",
        size: result.size || "알 수 없음",
        tags: Array.isArray(result.tags) ? result.tags : [],
        description: result.description || "설명이 없습니다"
      });

    } catch (err) {
      console.error(err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: getErrorMessage(err) });
    }
  });

  app.post(api.ai.searchSimilar.path, async (req, res) => {
    try {
      const input = api.ai.searchSimilar.input.parse(req.body);
      
      if (!input.prompt && !input.imageUrl) {
        return res.status(400).json({ message: "Either prompt or imageUrl must be provided" });
      }

      await backfillFoundItemEmbeddings();

      const queryParts: string[] = [];
      const trimmedPrompt = input.prompt?.trim();
      if (trimmedPrompt) {
        const promptValidationError = validateSearchPrompt(trimmedPrompt);
        if (promptValidationError && !input.imageUrl) {
          return res.status(400).json({ message: promptValidationError, field: "prompt" });
        }

        if (!promptValidationError) {
          queryParts.push(trimmedPrompt);
        }
      }

      if (input.imageUrl) {
        const imageSearchText = await createImageSearchText(input.imageUrl);
        if (imageSearchText) {
          queryParts.push(imageSearchText);
        }
      }

      const queryText = queryParts.join("\n\n").trim();
      const queryEmbedding = await createEmbedding(queryText);
      const vectorMatches = await storage.searchFoundItemsByEmbedding(queryEmbedding, VECTOR_CANDIDATE_COUNT);

      const filteredVectorMatches = vectorMatches.filter((result) => result.score > 0.15);
      if (filteredVectorMatches.length === 0) {
        return res.json([]);
      }

      const rerankedMatches = await rerankCandidates({
        prompt: input.prompt,
        imageUrl: input.imageUrl,
        queryText,
        candidates: filteredVectorMatches,
      });

      const vectorMatchById = new Map(
        filteredVectorMatches.map((candidate) => [candidate.item.id, candidate]),
      );

      const searchResults = rerankedMatches
        .map((result) => {
          const vectorMatch = vectorMatchById.get(result.itemId);
          if (!vectorMatch) {
            return null;
          }

          const llmScore = Math.max(0, Math.min(1, result.score));
          const blendedScore = Number(((vectorMatch.score * 0.35) + (llmScore * 0.65)).toFixed(4));

          return {
            item: vectorMatch.item,
            score: blendedScore,
            reasoning: buildReasoningFromEvidence({
              queryText,
              item: vectorMatch.item,
              matchScore: blendedScore,
              llmReasoning: result.reasoning,
            }),
          };
        })
        .filter((result): result is { item: VectorCandidate["item"]; score: number; reasoning: string } => Boolean(result))
        .sort((a, b) => b.score - a.score)
        .slice(0, FINAL_RESULT_COUNT);

      if (searchResults.length === 0) {
        const fallbackResults = filteredVectorMatches
          .slice(0, FINAL_RESULT_COUNT)
          .map((result) => ({
            item: result.item,
            score: Math.max(0, Math.min(1, result.score)),
            reasoning: buildReasoningFromEvidence({
              queryText,
              item: result.item,
              matchScore: result.score,
            }),
          }));

        return res.json(fallbackResults);
      }

      res.json(searchResults);

    } catch (err) {
      console.error(err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: getErrorMessage(err) });
    }
  });

  return httpServer;
}
