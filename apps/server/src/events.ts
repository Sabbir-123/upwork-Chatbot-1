import { EventEmitter } from "node:events";
import type { ChatMessage, SessionMode } from "@upwork-chatbot/shared";
import { Redis } from "ioredis";

export type Audience = "agent" | "both";

export interface ConvEvent {
  convId: string;
  message: ChatMessage;
  audience: Audience;
  mode?: SessionMode;
}

export type EventHandler = (event: ConvEvent) => void;
export type ConversationChangeHandler = (convId: string) => void;

export interface EventBus {
  publish(convId: string, message: ChatMessage, audience: Audience, mode?: SessionMode): Promise<void>;
  // Signal that a conversation's metadata (status / needsHuman / preview) changed
  // without necessarily sending a message, so inbox subscribers refresh their view.
  // Every publish() also fires this so a new message bumps the inbox too.
  publishConversationChange(convId: string): Promise<void>;
  subscribe(convId: string, handler: EventHandler): () => void;
  subscribeConversationChanges(handler: ConversationChangeHandler): () => void;
}

const CHANGE_EVENT = "conv-changed";

function channelFor(convId: string): string {
  return `events:conv:${convId}`;
}

function changeChannelFor(convId: string): string {
  return `events:changed:${convId}`;
}

class MemoryEventBus implements EventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(0);
  }

  async publish(convId: string, message: ChatMessage, audience: Audience, mode?: SessionMode): Promise<void> {
    const event: ConvEvent = { convId, message, audience, mode };
    this.emitter.emit(channelFor(convId), event);
    this.emitter.emit(CHANGE_EVENT, convId);
  }

  async publishConversationChange(convId: string): Promise<void> {
    this.emitter.emit(CHANGE_EVENT, convId);
  }

  subscribe(convId: string, handler: EventHandler): () => void {
    this.emitter.on(channelFor(convId), handler);
    return () => this.emitter.off(channelFor(convId), handler);
  }

  subscribeConversationChanges(handler: ConversationChangeHandler): () => void {
    this.emitter.on(CHANGE_EVENT, handler);
    return () => this.emitter.off(CHANGE_EVENT, handler);
  }
}

class RedisEventBus implements EventBus {
  private publisher: Redis;
  private subscriber: Redis;
  private convHandlers = new Map<string, Set<EventHandler>>();
  private changeHandlers = new Set<ConversationChangeHandler>();

  constructor(url: string) {
    this.publisher = new Redis(url);
    this.subscriber = new Redis(url);
    this.subscriber.psubscribe("events:conv:*", "events:changed:*");
    this.subscriber.on("pmessage", (_pattern, channel, raw) => {
      if (channel.startsWith("events:changed:")) {
        const convId = channel.slice("events:changed:".length);
        for (const handler of this.changeHandlers) handler(convId);
        return;
      }
      const convId = channel.slice("events:conv:".length);
      const event = JSON.parse(raw) as ConvEvent;
      for (const handler of this.convHandlers.get(convId) ?? []) handler(event);
      for (const handler of this.changeHandlers) handler(convId);
    });
  }

  async publish(convId: string, message: ChatMessage, audience: Audience, mode?: SessionMode): Promise<void> {
    const event: ConvEvent = { convId, message, audience, mode };
    await this.publisher.publish(channelFor(convId), JSON.stringify(event));
  }

  async publishConversationChange(convId: string): Promise<void> {
    await this.publisher.publish(changeChannelFor(convId), "1");
  }

  subscribe(convId: string, handler: EventHandler): () => void {
    let set = this.convHandlers.get(convId);
    if (!set) {
      set = new Set();
      this.convHandlers.set(convId, set);
    }
    set.add(handler);
    return () => set.delete(handler);
  }

  subscribeConversationChanges(handler: ConversationChangeHandler): () => void {
    this.changeHandlers.add(handler);
    return () => this.changeHandlers.delete(handler);
  }
}

let bus: EventBus | undefined;

export function getEventBus(): EventBus {
  if (bus) return bus;
  const url = process.env.REDIS_URL;
  bus = url ? new RedisEventBus(url) : new MemoryEventBus();
  return bus;
}
