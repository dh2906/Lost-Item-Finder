import type { Express } from "express";
import { createServer, type Server } from "http";
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
  const matches = Array.isArray(parsed)
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
      if (input.prompt?.trim()) {
        queryParts.push(input.prompt.trim());
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
            reasoning: result.reasoning,
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
            reasoning: `벡터 유사도 ${(Math.max(0, Math.min(1, result.score)) * 100).toFixed(1)}% 기준으로 추린 후보입니다.`,
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
