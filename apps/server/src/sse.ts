import type { Context } from "hono";
import { streamSSE } from "hono/streaming";

const HEARTBEAT_MS = 15000;

export interface SseFrame {
  event?: string;
  data: unknown;
}

// Opens an SSE response and drives it from `subscribe`, which registers a push
// callback and returns an unsubscribe function. Sends a heartbeat comment on an
// interval to keep proxies from closing an idle connection.
export function openSse(c: Context, subscribe: (push: (frame: SseFrame) => void) => () => void) {
  return streamSSE(c, async (stream) => {
    let closed = false;
    stream.onAbort(() => {
      closed = true;
    });

    const push = (frame: SseFrame) => {
      if (closed) return;
      void stream.writeSSE({ event: frame.event, data: JSON.stringify(frame.data) });
    };

    const unsubscribe = subscribe(push);

    try {
      while (!closed) {
        await stream.sleep(HEARTBEAT_MS);
        if (closed) break;
        await stream.writeSSE({ event: "heartbeat", data: "" });
      }
    } finally {
      unsubscribe();
    }
  });
}
