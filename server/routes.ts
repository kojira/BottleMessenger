import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { messageRelay } from "./bots/message-relay";
import { settingsSchema, insertMessageSchema } from "@shared/schema";
import { ZodError } from "zod";
import { getPublicKey as nostrGetPublicKey } from "nostr-tools";

export async function registerRoutes(app: Express) {
  const server = createServer(app);

  // Initialize message relay
  await messageRelay.init();

  // Settings routes
  app.get("/api/settings", async (_req, res) => {
    const settings = await storage.getSettings();
    res.json(settings);
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const data = settingsSchema.parse(req.body);
      const settings = await storage.updateSettings(data);
      res.json(settings);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update settings" });
      }
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

  // Test DM endpoint
  app.post("/api/test/dm", async (req, res) => {
    try {
      const { platform, content } = req.body;

      if (!platform || !content) {
        return res.status(400).json({ error: "Platform and content are required" });
      }

      if (platform === "bluesky") {
        const settings = await storage.getSettings();
        if (!settings?.blueskyHandle) {
          return res.status(400).json({ error: "Bluesky handle not configured" });
        }
        await messageRelay.relayMessage({
          sourcePlatform: "test",
          sourceId: "test",
          sourceUser: settings.blueskyHandle,
          targetPlatform: "bluesky",
          content,
          status: "pending"
        });
      } else if (platform === "nostr") {
        const settings = await storage.getSettings();
        if (!settings?.nostrPrivateKey) {
          return res.status(400).json({ error: "Nostr private key not configured" });
        }

        // Convert private key to public key using nostr-tools
        const publicKey = nostrGetPublicKey(settings.nostrPrivateKey);
        console.log('Generated Nostr public key:', publicKey);

        await messageRelay.relayMessage({
          sourcePlatform: "test",
          sourceId: "test",
          sourceUser: publicKey,
          targetPlatform: "nostr",
          content,
          status: "pending"
        });
      } else {
        return res.status(400).json({ error: "Invalid platform" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Test DM error:', error);
      res.status(500).json({ error: "Failed to send test DM" });
    }
  });

  return server;
}