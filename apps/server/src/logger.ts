type LogData = Record<string, unknown>;

function timestamp(): string {
  return new Date().toISOString().slice(11, 23);
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    const truncated = value.length > 80 ? `${value.slice(0, 77)}...` : value;
    return JSON.stringify(truncated);
  }
  return String(value);
}

function format(sessionId: string, event: string, data?: LogData): string {
  const parts = [`${timestamp()}`, event.padEnd(24), `sid=${sessionId.slice(0, 8)}`];
  if (data) {
    for (const [key, value] of Object.entries(data)) {
      parts.push(`${key}=${formatValue(value)}`);
    }
  }
  return parts.join("  ");
}

export function log(sessionId: string, event: string, data?: LogData): void {
  console.log(format(sessionId, event, data));
}

export function logError(sessionId: string, event: string, err: unknown, data?: LogData): void {
  console.error(format(sessionId, event, data), err);
}
