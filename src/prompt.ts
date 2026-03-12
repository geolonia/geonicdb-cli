import { createInterface } from "node:readline/promises";

export function isInteractive(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true;
}

export async function promptEmail(): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const email = await rl.question("Email: ");
    return email.trim();
  } finally {
    rl.close();
  }
}

export async function promptPassword(): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdout.write("Password: ");

    if (!stdin.isTTY) {
      let data = "";
      stdin.setEncoding("utf-8");
      stdin.resume();
      const cleanup = () => {
        stdin.removeListener("data", onData);
        stdin.removeListener("end", onEnd);
        stdin.removeListener("error", onError);
        stdin.pause();
      };
      const onData = (chunk: string) => {
        const newline = chunk.indexOf("\n");
        if (newline !== -1) {
          data += chunk.slice(0, newline);
          cleanup();
          stdout.write("\n");
          resolve(data);
        } else {
          data += chunk;
        }
      };
      const onEnd = () => {
        cleanup();
        stdout.write("\n");
        resolve(data);
      };
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      stdin.on("data", onData);
      stdin.on("end", onEnd);
      stdin.on("error", onError);
      return;
    }

    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf-8");

    let password = "";

    const restoreTerminal = () => {
      stdin.removeListener("data", onData);
      stdin.removeListener("error", onError);
      stdin.setRawMode(wasRaw ?? false);
      stdin.pause();
    };

    const onError = (err: Error) => {
      restoreTerminal();
      stdout.write("\n");
      reject(err);
    };

    const onData = (char: string) => {
      const code = char.charCodeAt(0);

      if (char === "\r" || char === "\n") {
        restoreTerminal();
        stdout.write("\n");
        resolve(password);
      } else if (code === 3) {
        restoreTerminal();
        stdout.write("\n");
        reject(new Error("User cancelled"));
      } else if (code === 127 || code === 8) {
        if (password.length > 0) {
          password = password.slice(0, -1);
          stdout.write("\b \b");
        }
      } else if (code >= 32) {
        password += char;
        stdout.write("*");
      }
    };

    stdin.on("data", onData);
    stdin.on("error", onError);
  });
}

export interface TenantChoice {
  tenantId: string;
  role: string;
}

export async function promptTenantSelection(
  tenants: TenantChoice[],
  currentTenantId?: string,
): Promise<string | undefined> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log("\nAvailable tenants:");
    for (let i = 0; i < tenants.length; i++) {
      const t = tenants[i];
      const current = t.tenantId === currentTenantId ? " ← current" : "";
      const marker = t.tenantId === currentTenantId ? "  *" : "   ";
      console.log(`${marker} ${i + 1}) ${t.tenantId} (${t.role})${current}`);
    }
    for (;;) {
      const answer = await rl.question("\nSelect tenant number (Enter to keep current): ");
      const trimmed = answer.trim();
      if (!trimmed) return undefined;
      const index = parseInt(trimmed, 10) - 1;
      if (index >= 0 && index < tenants.length) {
        return tenants[index].tenantId;
      }
      console.log(`Invalid selection. Please enter a number between 1 and ${tenants.length}.`);
    }
  } finally {
    rl.close();
  }
}
