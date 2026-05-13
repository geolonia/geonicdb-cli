import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";

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

export async function promptPassword(label = "Password"): Promise<string> {
  const stdin = process.stdin;
  const stdout = process.stdout;

  stdout.write(`${label}: `);

  if (!stdin.isTTY) {
    return new Promise((resolve, reject) => {
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
    });
  }

  // Use readline with muted output to avoid conflicts with emitKeypressEvents
  // that prior createInterface calls install on stdin.
  const muted = new Writable({
    write(_chunk: Buffer, _encoding: string, callback: () => void) {
      callback();
    },
  });

  const rl = createInterface({
    input: stdin,
    output: muted,
    terminal: true,
    historySize: 0,
  });

  let maskedLen = 0;
  const onKeypress = () => {
    const nextLen = [...rl.line].length;
    if (nextLen > maskedLen) {
      stdout.write("*".repeat(nextLen - maskedLen));
    } else if (nextLen < maskedLen) {
      stdout.write("\b \b".repeat(maskedLen - nextLen));
    }
    maskedLen = nextLen;
  };
  stdin.on("keypress", onKeypress);

  try {
    const answer = await rl.question("");
    stdout.write("\n");
    return answer;
  } finally {
    stdin.removeListener("keypress", onKeypress);
    rl.close();
  }
}

