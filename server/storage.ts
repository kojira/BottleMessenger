import { Bot, Message, InsertBot, InsertMessage } from "@shared/schema";
import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const BOTS_FILE = path.join(DATA_DIR, "bots.json");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");

export interface IStorage {
  // Bot operations
  getBots(): Promise<Bot[]>;
  getBot(id: number): Promise<Bot | undefined>;
  createBot(bot: InsertBot): Promise<Bot>;
  updateBot(id: number, bot: Partial<Bot>): Promise<Bot>;
  deleteBot(id: number): Promise<void>;

  // Message operations
  getMessages(limit?: number): Promise<Message[]>;
  getMessage(id: number): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessage(id: number, message: Partial<Message>): Promise<Message>;
}

export class JSONStorage implements IStorage {
  private bots: Map<number, Bot>;
  private messages: Map<number, Message>;
  private botId: number;
  private messageId: number;

  constructor() {
    this.bots = new Map();
    this.messages = new Map();
    this.botId = 1;
    this.messageId = 1;
    this.initStorage();
  }

  private async initStorage() {
    try {
      await fs.mkdir(DATA_DIR, { recursive: true });
      
      try {
        const botsData = await fs.readFile(BOTS_FILE, 'utf-8');
        const bots = JSON.parse(botsData) as Bot[];
        bots.forEach(bot => {
          this.bots.set(bot.id, bot);
          this.botId = Math.max(this.botId, bot.id + 1);
        });
      } catch (e) {
        await this.saveBots();
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

  private async saveBots() {
    await fs.writeFile(BOTS_FILE, JSON.stringify(Array.from(this.bots.values()), null, 2));
  }

  private async saveMessages() {
    await fs.writeFile(MESSAGES_FILE, JSON.stringify(Array.from(this.messages.values()), null, 2));
  }

  async getBots(): Promise<Bot[]> {
    return Array.from(this.bots.values());
  }

  async getBot(id: number): Promise<Bot | undefined> {
    return this.bots.get(id);
  }

  async createBot(bot: InsertBot): Promise<Bot> {
    const newBot: Bot = { ...bot, id: this.botId++ };
    this.bots.set(newBot.id, newBot);
    await this.saveBots();
    return newBot;
  }

  async updateBot(id: number, update: Partial<Bot>): Promise<Bot> {
    const bot = this.bots.get(id);
    if (!bot) throw new Error(`Bot ${id} not found`);
    
    const updatedBot = { ...bot, ...update };
    this.bots.set(id, updatedBot);
    await this.saveBots();
    return updatedBot;
  }

  async deleteBot(id: number): Promise<void> {
    this.bots.delete(id);
    await this.saveBots();
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
      createdAt: new Date()
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
