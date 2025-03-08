import { Settings, Message, InsertSettings, InsertMessage } from "@shared/schema";
import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");

export interface IStorage {
  // Settings operations
  getSettings(): Promise<Settings | null>;
  updateSettings(settings: InsertSettings): Promise<Settings>;

  // Message operations
  getMessages(limit?: number): Promise<Message[]>;
  getMessage(id: number): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessage(id: number, message: Partial<Message>): Promise<Message>;
}

export class JSONStorage implements IStorage {
  private settings: Settings | null;
  private messages: Map<number, Message>;
  private messageId: number;

  constructor() {
    this.settings = null;
    this.messages = new Map();
    this.messageId = 1;
    this.initStorage();
  }

  private async initStorage() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });

      try {
        const settingsData = await fs.readFile(SETTINGS_FILE, 'utf-8');
        this.settings = JSON.parse(settingsData) as Settings;
      } catch (e) {
        await this.saveSettings();
      }

      try {
        const messagesData = await fs.readFile(MESSAGES_FILE, 'utf-8');
        const messages = JSON.parse(messagesData) as Message[];
        messages.forEach(msg => {
          this.messages.set(msg.id, msg);
          this.messageId = Math.max(this.messageId, msg.id + 1);
        });
      } catch (e) {
        await this.saveMessages();
      }
    } catch (e) {
      console.error("Failed to initialize storage:", e);
      throw e;
    }
  }

  private async saveSettings() {
    if (this.settings) {
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(this.settings, null, 2));
    }
  }

  private async saveMessages() {
    await fs.writeFile(MESSAGES_FILE, JSON.stringify(Array.from(this.messages.values()), null, 2));
  }

  async getSettings(): Promise<Settings | null> {
    return this.settings;
  }

  async updateSettings(settings: InsertSettings): Promise<Settings> {
    // Always ensure enabled is a string
    const enabled = settings.enabled ?? 'true';
    this.settings = { 
      id: 1, 
      ...settings,
      enabled 
    };
    await this.saveSettings();
    return this.settings;
  }

  async getMessages(limit = 100): Promise<Message[]> {
    return Array.from(this.messages.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async getMessage(id: number): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const newMessage: Message = {
      ...message,
      id: this.messageId++,
      createdAt: new Date(),
      targetId: message.targetId ?? null,
      error: message.error ?? null
    };
    this.messages.set(newMessage.id, newMessage);
    await this.saveMessages();
    return newMessage;
  }

  async updateMessage(id: number, update: Partial<Message>): Promise<Message> {
    const message = this.messages.get(id);
    if (!message) throw new Error(`Message ${id} not found`);

    const updatedMessage = { ...message, ...update };
    this.messages.set(id, updatedMessage);
    await this.saveMessages();
    return updatedMessage;
  }
}

export const storage = new JSONStorage();