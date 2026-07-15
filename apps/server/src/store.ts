import type { Activity, ChatMessage, Conversation, ConversationStatus, SessionMode } from "@upwork-chatbot/shared";
import { Redis } from "ioredis";

export interface SessionState {
  mode: SessionMode;
  recommendActivity?: Activity;
  consecutiveFallbacks: number;
  // How many times we've re-asked for an order number without getting one — drives an
  // escalating re-prompt (offer a live agent) instead of repeating the same line.
  orderPromptRetries?: number;
  // How many customer messages we've acknowledged while simulating a live agent (no real
  // human has taken over yet) — used to vary the holding message instead of repeating it.
  liveAgentPings?: number;
}

export interface ConversationMeta {
  status: ConversationStatus;
  needsHuman: boolean;
  createdAt: number;
  updatedAt: number;
  preview: string;
  session: SessionState;
}

export interface ConversationStore {
  appendMessage(id: string, message: ChatMessage): Promise<void>;
  getMessages(id: string): Promise<ChatMessage[]>;
  loadSession(id: string): Promise<SessionState>;
  saveSession(id: string, session: SessionState): Promise<void>;
  setMeta(id: string, patch: Partial<Omit<ConversationMeta, "session">>): Promise<void>;
  getMeta(id: string): Promise<ConversationMeta>;
  getConversation(id: string): Promise<Conversation>;
  listConversations(): Promise<Conversation[]>;
}

const DEFAULT_SESSION: SessionState = { mode: "main", consecutiveFallbacks: 0 };

function defaultMeta(now: number): ConversationMeta {
  return {
    status: "bot",
    needsHuman: false,
    createdAt: now,
    updatedAt: now,
    preview: "",
    session: { ...DEFAULT_SESSION },
  };
}

function previewFrom(content: string): string {
  return content.length > 80 ? `${content.slice(0, 80)}…` : content;
}

function toConversation(id: string, meta: ConversationMeta, messageCount: number): Conversation {
  return {
    id,
    status: meta.status,
    needsHuman: meta.needsHuman,
    updatedAt: meta.updatedAt,
    preview: meta.preview,
    messageCount,
  };
}

function sortConversations(list: Conversation[]): Conversation[] {
  return [...list].sort((a, b) => {
    if (a.needsHuman !== b.needsHuman) return a.needsHuman ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

class MemoryStore implements ConversationStore {
  private messages = new Map<string, ChatMessage[]>();
  private metas = new Map<string, ConversationMeta>();

  private getOrCreateMeta(id: string): ConversationMeta {
    let meta = this.metas.get(id);
    if (!meta) {
      meta = defaultMeta(Date.now());
      this.metas.set(id, meta);
    }
    return meta;
  }

  async appendMessage(id: string, message: ChatMessage): Promise<void> {
    const list = this.messages.get(id) ?? [];
    list.push(message);
    this.messages.set(id, list);
    const meta = this.getOrCreateMeta(id);
    meta.updatedAt = message.createdAt ?? Date.now();
    meta.preview = previewFrom(message.content);
  }

  async getMessages(id: string): Promise<ChatMessage[]> {
    return this.messages.get(id) ?? [];
  }

  async loadSession(id: string): Promise<SessionState> {
    return { ...this.getOrCreateMeta(id).session };
  }

  async saveSession(id: string, session: SessionState): Promise<void> {
    this.getOrCreateMeta(id).session = { ...session };
  }

  async setMeta(id: string, patch: Partial<Omit<ConversationMeta, "session">>): Promise<void> {
    const meta = this.getOrCreateMeta(id);
    Object.assign(meta, patch);
  }

  async getMeta(id: string): Promise<ConversationMeta> {
    return { ...this.getOrCreateMeta(id) };
  }

  async getConversation(id: string): Promise<Conversation> {
    return toConversation(id, this.getOrCreateMeta(id), this.messages.get(id)?.length ?? 0);
  }

  async listConversations(): Promise<Conversation[]> {
    const list = [...this.metas.entries()].map(([id, meta]) =>
      toConversation(id, meta, this.messages.get(id)?.length ?? 0)
    );
    return sortConversations(list);
  }
}

class RedisStore implements ConversationStore {
  constructor(private readonly redis: Redis) {}

  private metaKey(id: string): string {
    return `conv:${id}:meta`;
  }

  private messagesKey(id: string): string {
    return `conv:${id}:messages`;
  }

  async appendMessage(id: string, message: ChatMessage): Promise<void> {
    await this.redis.rpush(this.messagesKey(id), JSON.stringify(message));
    const now = message.createdAt ?? Date.now();
    await this.ensureMeta(id, now);
    await this.redis.hset(this.metaKey(id), { updatedAt: now, preview: previewFrom(message.content) });
    await this.redis.zadd("conversations:index", now, id);
  }

  async getMessages(id: string): Promise<ChatMessage[]> {
    const raw = await this.redis.lrange(this.messagesKey(id), 0, -1);
    return raw.map((r) => JSON.parse(r) as ChatMessage);
  }

  private async ensureMeta(id: string, now: number): Promise<void> {
    const exists = await this.redis.exists(this.metaKey(id));
    if (!exists) {
      const meta = defaultMeta(now);
      await this.redis.hset(this.metaKey(id), {
        status: meta.status,
        needsHuman: "0",
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        preview: meta.preview,
        session: JSON.stringify(meta.session),
      });
    }
  }

  async loadSession(id: string): Promise<SessionState> {
    const raw = await this.redis.hget(this.metaKey(id), "session");
    if (!raw) return { ...DEFAULT_SESSION };
    return JSON.parse(raw) as SessionState;
  }

  async saveSession(id: string, session: SessionState): Promise<void> {
    await this.ensureMeta(id, Date.now());
    await this.redis.hset(this.metaKey(id), "session", JSON.stringify(session));
  }

  async setMeta(id: string, patch: Partial<Omit<ConversationMeta, "session">>): Promise<void> {
    await this.ensureMeta(id, Date.now());
    const fields: Record<string, string | number> = {};
    if (patch.status !== undefined) fields.status = patch.status;
    if (patch.needsHuman !== undefined) fields.needsHuman = patch.needsHuman ? "1" : "0";
    if (patch.createdAt !== undefined) fields.createdAt = patch.createdAt;
    if (patch.updatedAt !== undefined) fields.updatedAt = patch.updatedAt;
    if (patch.preview !== undefined) fields.preview = patch.preview;
    if (Object.keys(fields).length > 0) await this.redis.hset(this.metaKey(id), fields);
    if (patch.updatedAt !== undefined) await this.redis.zadd("conversations:index", patch.updatedAt, id);
  }

  async getMeta(id: string): Promise<ConversationMeta> {
    await this.ensureMeta(id, Date.now());
    const raw = await this.redis.hgetall(this.metaKey(id));
    return {
      status: (raw.status as ConversationStatus) ?? "bot",
      needsHuman: raw.needsHuman === "1",
      createdAt: Number(raw.createdAt) || Date.now(),
      updatedAt: Number(raw.updatedAt) || Date.now(),
      preview: raw.preview ?? "",
      session: raw.session ? (JSON.parse(raw.session) as SessionState) : { ...DEFAULT_SESSION },
    };
  }

  async getConversation(id: string): Promise<Conversation> {
    const [meta, count] = await Promise.all([this.getMeta(id), this.redis.llen(this.messagesKey(id))]);
    return toConversation(id, meta, count);
  }

  async listConversations(): Promise<Conversation[]> {
    const ids = await this.redis.zrevrange("conversations:index", 0, -1);
    const list: Conversation[] = [];
    for (const id of ids) {
      const [meta, count] = await Promise.all([
        this.redis.hgetall(this.metaKey(id)),
        this.redis.llen(this.messagesKey(id)),
      ]);
      if (!meta.updatedAt) continue;
      list.push({
        id,
        status: (meta.status as ConversationStatus) ?? "bot",
        needsHuman: meta.needsHuman === "1",
        updatedAt: Number(meta.updatedAt),
        preview: meta.preview ?? "",
        messageCount: count,
      });
    }
    return sortConversations(list);
  }
}

let store: ConversationStore | undefined;

export function getStore(): ConversationStore {
  if (store) return store;
  const url = process.env.REDIS_URL;
  if (url) {
    store = new RedisStore(new Redis(url));
  } else {
    store = new MemoryStore();
  }
  return store;
}
