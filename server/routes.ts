import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { messageRelay } from "./bots/message-relay";
import { insertBotSchema, insertMessageSchema } from "@shared/schema";
import { ZodError } from "zod";

export async function registerRoutes(app: Express) {
  const server = createServer(app);

  // Initialize message relay
  await messageRelay.init();

  // Bot management routes
  app.get("/api/bots", async (_req, res) => {
    const bots = await storage.getBots();
    res.json(bots);
  });

  app.post("/api/bots", async (req, res) => {
    try {
      const data = insertBotSchema.parse(req.body);
      const bot = await storage.createBot(data);
      res.status(201).json(bot);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create bot" });
      }
    }
  });

  app.patch("/api/bots/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const bot = await storage.getBot(id);
      if (!bot) {
        return res.status(404).json({ error: "Bot not found" });
      }
      const updatedBot = await storage.updateBot(id, req.body);
      res.json(updatedBot);
    } catch (error) {
      res.status(500).json({ error: "Failed to update bot" });
    }
  });

  app.delete("/api/bots/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteBot(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete bot" });
    }
  });

  // Message routes
  app.get("/api/messages", async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const messages = await storage.getMessages(limit);
    res.json(messages);
  });

  app.post("/api/messages/relay", async (req, res) => {
    try {
      const data = insertMessageSchema.parse(req.body);
      const message = await messageRelay.relayMessage(data);
      res.status(201).json(message);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to relay message" });
      }
    }
  });

  return server;
}
