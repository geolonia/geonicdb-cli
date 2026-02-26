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
      const onData = (chunk: string) => {
        const newline = chunk.indexOf("\n");
        if (newline !== -1) {
          data += chunk.slice(0, newline);
          stdin.removeListener("data", onData);
          stdin.pause();
          stdout.write("\n");
          resolve(data);
        } else {
          data += chunk;
        }
      };
      stdin.on("data", onData);
      stdin.on("error", reject);
      return;
    }

    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf-8");

    let password = "";

    const onData = (char: string) => {
      const code = char.charCodeAt(0);

      if (char === "\r" || char === "\n") {
        stdin.removeListener("data", onData);
        stdin.setRawMode(wasRaw ?? false);
        stdin.pause();
        stdout.write("\n");
        resolve(password);
      } else if (code === 3) {
        stdin.removeListener("data", onData);
        stdin.setRawMode(wasRaw ?? false);
        stdin.pause();
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
  });
}
