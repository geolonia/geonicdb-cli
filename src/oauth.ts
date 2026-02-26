export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
}

export async function clientCredentialsGrant(options: {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
}): Promise<OAuthTokenResponse> {
  const url = new URL("/oauth/token", options.baseUrl).toString();
  const credentials = Buffer.from(`${options.clientId}:${options.clientSecret}`).toString("base64");

  const params = new URLSearchParams();
  params.set("grant_type", "client_credentials");
  if (options.scope) {
    params.set("scope", options.scope);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    let message: string;
    try {
      const err = JSON.parse(text) as Record<string, unknown>;
      message = (err.error_description ?? err.error ?? text) as string;
    } catch {
      message = text || `HTTP ${response.status}`;
    }
    throw new Error(`OAuth token request failed: ${message}`);
  }

  return (await response.json()) as OAuthTokenResponse;
}
