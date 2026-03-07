import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import OpenAI from "openai";
import { cosineSimilarity } from "./utils/math";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

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
      
      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          {
            role: "system",
            content: "You are an AI assistant helping to categorize found items for a lost and found system. Analyze the provided image and extract the following metadata: itemCategory (e.g., wallet, phone, keys), color, size (e.g., small, medium, large), tags (array of descriptive keywords), and a short, clear description of the item."
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this image and return the metadata in JSON format." },
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
        itemCategory: result.itemCategory || "Unknown",
        color: result.color || "Unknown",
        size: result.size || "Unknown",
        tags: Array.isArray(result.tags) ? result.tags : [],
        description: result.description || "No description available"
      });

    } catch (err) {
      console.error(err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post(api.ai.searchSimilar.path, async (req, res) => {
    try {
      const input = api.ai.searchSimilar.input.parse(req.body);
      
      if (!input.prompt && !input.imageUrl) {
        return res.status(400).json({ message: "Either prompt or imageUrl must be provided" });
      }

      // 1. Get all 'found' items
      const foundItems = await storage.getItems("found");
      
      if (foundItems.length === 0) {
        return res.json([]); // No items to compare against
      }

      // 2. Ask AI to evaluate similarity and provide reasoning
      const systemPrompt = `You are a lost and found matcher. You need to compare a lost item inquiry against a list of found items and score how likely they are to be the same item (0 to 1). Provide a score and a short reasoning for each item. Format as JSON array: [{"itemId": 1, "score": 0.85, "reasoning": "Colors and brand match exactly"}]`;
      
      const userContent: any[] = [
        { 
          type: "text", 
          text: `Compare the lost item against these found items:\n${JSON.stringify(foundItems.map(i => ({
            id: i.id, title: i.title, description: i.description, color: i.color, tags: i.tags
          })))}\n\nLost item details:` 
        }
      ];

      if (input.prompt) {
        userContent.push({ type: "text", text: input.prompt });
      }
      
      if (input.imageUrl) {
        userContent.push({ type: "image_url", image_url: { url: input.imageUrl } });
      }

      const response = await openai.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ],
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("Failed to get response from AI");
      }

      // Handle both formats: array directly or object containing array
      const parsedContent = JSON.parse(content);
      const results = Array.isArray(parsedContent) ? parsedContent : (parsedContent.matches || parsedContent.results || []);

      // 3. Map results back to items and sort by score
      const searchResults = results
        .map((r: any) => {
          const item = foundItems.find(i => i.id === r.itemId);
          return item ? { item, score: r.score, reasoning: r.reasoning } : null;
        })
        .filter((r: any) => r !== null && r.score > 0.2) // Filter out very low matches
        .sort((a: any, b: any) => b.score - a.score);

      res.json(searchResults);

    } catch (err) {
      console.error(err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return httpServer;
}
