import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { messageRelay } from "./bots/message-relay";
import { settingsSchema, insertMessageSchema, insertBotResponseSchema } from "@shared/schema"; // Added import
import { ZodError } from "zod";
import { getPublicKey as nostrGetPublicKey } from "nostr-tools";
import { AtpAgent } from '@atproto/api';

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

  // Check Bluesky notifications manually
  app.post("/api/bluesky/check-notifications", async (_req, res) => {
    try {
      if (!messageRelay.blueskyBot) {
        return res.status(400).json({ error: "Bluesky bot not configured" });
      }

      await messageRelay.blueskyBot.checkNotifications();
      res.json({ success: true });
    } catch (error) {
      console.error('Error checking Bluesky notifications:', error);
      res.status(500).json({ error: "Failed to check notifications" });
    }
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

      const settings = await storage.getSettings();
      if (!settings) {
        return res.status(400).json({ error: "Bot settings not configured" });
      }

      if (platform === "bluesky") {
        if (!settings.blueskyHandle || !settings.blueskyPassword) {
          return res.status(400).json({ error: "Bluesky handle and password are required" });
        }

        // Blueskyボットを初期化して送信者のDIDを取得
        const agent = new AtpAgent({ service: 'https://bsky.social' });
        await agent.login({
          identifier: settings.blueskyHandle,
          password: settings.blueskyPassword
        });

        const profile = await agent.getProfile({ actor: settings.blueskyHandle });
        const senderDid = profile.data.did;

        await messageRelay.relayMessage({
          sourcePlatform: "test",
          sourceId: "test",
          sourceUser: senderDid,  // DIDを使用
          targetPlatform: "bluesky",
          content,
          status: "pending"
        });
      } else if (platform === "nostr") {
        if (!settings.nostrPrivateKey) {
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

  // 全体の統計情報を取得するエンドポイントを追加
  app.get("/api/stats/global", async (_req, res) => {
    try {
      const stats = await storage.getGlobalStats();
      res.json(stats);
    } catch (error) {
      console.error('Error getting global stats:', error);
      res.status(500).json({ error: "Failed to get global stats" });
    }
  });


  // ボット応答メッセージのルートを追加
  app.get("/api/responses", async (_req, res) => {
    try {
      const responses = await storage.getBotResponses();
      res.json(responses);
    } catch (error) {
      console.error('Error getting bot responses:', error);
      res.status(500).json({ error: "Failed to get bot responses" });
    }
  });

  app.post("/api/responses", async (req, res) => {
    try {
      const data = insertBotResponseSchema.parse(req.body);
      const response = await storage.createBotResponse(data);
      res.status(201).json(response);
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create bot response" });
      }
    }
  });

  app.delete("/api/responses/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid ID" });
      }
      await storage.deleteBotResponse(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete bot response" });
    }
  });

  // データのエクスポート
  app.get("/api/data/export", async (_req, res) => {
    try {
      console.log('Starting data export request...');
      const data = await storage.exportData();
      console.log('Export completed', {
        dataKeys: Object.keys(data),
        hasData: Object.values(data).some(arr => arr?.length > 0),
        dataSize: JSON.stringify(data).length,
        sample: JSON.stringify(data).substring(0, 100) + '...'
      });
      res.json(data);
    } catch (error) {
      console.error('Error exporting data:', error);
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  // データのインポート
  app.post("/api/data/import", async (req, res) => {
    try {
      await storage.importData(req.body);
      res.json({ success: true });
    } catch (error) {
      console.error('Error importing data:', error);
      res.status(500).json({ error: "Failed to import data" });
    }
  });

  return server;
}