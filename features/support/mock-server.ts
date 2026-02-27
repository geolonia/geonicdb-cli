import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";

export interface RecordedRequest {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

type RouteHandler = (
  req: IncomingMessage,
  body: string,
) => { status: number; headers?: Record<string, string>; body?: unknown };

interface Route {
  method: string;
  path: string;
  handler: RouteHandler;
}

export class MockServer {
  private server: Server | null = null;
  private routes: Route[] = [];
  private _requests: RecordedRequest[] = [];
  private _port = 0;

  get port(): number {
    return this._port;
  }

  get baseUrl(): string {
    return `http://127.0.0.1:${this._port}`;
  }

  get requests(): RecordedRequest[] {
    return this._requests;
  }

  addRoute(
    method: string,
    path: string,
    handler: RouteHandler,
  ): void {
    this.routes.push({ method: method.toUpperCase(), path, handler });
  }

  clearRoutes(): void {
    this.routes = [];
    this._requests = [];
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => this.handleRequest(req, res));
      this.server.listen(0, "127.0.0.1", () => {
        const addr = this.server!.address();
        if (typeof addr === "object" && addr !== null) {
          this._port = addr.port;
        }
        resolve();
      });
      this.server.on("error", reject);
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      this._requests.push({
        method: req.method ?? "GET",
        url: req.url ?? "/",
        headers: req.headers as Record<string, string | string[] | undefined>,
        body,
      });

      const route = this.routes.find(
        (r) => r.method === req.method && this.matchPath(r.path, req.url ?? "/"),
      );

      if (!route) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "NotFound", description: `No mock route for ${req.method} ${req.url}` }));
        return;
      }

      const result = route.handler(req, body);
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...result.headers,
      };
      res.writeHead(result.status, headers);
      if (result.body !== undefined) {
        res.end(JSON.stringify(result.body));
      } else {
        res.end();
      }
    });
  }

  private matchPath(routePath: string, requestUrl: string): boolean {
    const url = requestUrl.split("?")[0];
    return url === routePath;
  }
}

export const mockServer = new MockServer();
