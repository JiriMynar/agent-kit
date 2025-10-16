import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { WORKFLOW_ID } from "@/lib/config";

interface CreateSessionRequestBody {
  workflow?: { id?: string | null } | null;
  scope?: { user_id?: string | null } | null;
  workflowId?: string | null;
  chatkit_configuration?: {
    file_upload?: {
      enabled?: boolean;
    };
  };
}

const DEFAULT_CHATKIT_BASE = "https://api.openai.com";
const SESSION_COOKIE_NAME = "chatkit_session_id";
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function POST(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return methodNotAllowedResponse();
  }
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: "Missing OPENAI_API_KEY environment variable" },
        { status: 500 }
      );
    }

    const parsedBody = await safeParseJson<CreateSessionRequestBody>(request);

    const cookieStore = cookies();
    const existingUserId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    const userId = existingUserId ?? (
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2)
    );

    if (!existingUserId) {
      cookieStore.set(SESSION_COOKIE_NAME, userId, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: SESSION_COOKIE_MAX_AGE,
        path: "/",
        secure: process.env.NODE_ENV === "production",
      });
    }
    const resolvedWorkflowId =
      parsedBody?.workflow?.id ?? parsedBody?.workflowId ?? WORKFLOW_ID;

    if (process.env.NODE_ENV !== "production") {
      console.info("[create-session] handling request", {
        resolvedWorkflowId,
        body: JSON.stringify(parsedBody),
      });
    }

    if (!resolvedWorkflowId) {
      return NextResponse.json({ error: "Missing workflow id" }, { status: 400 });
    }

    const apiBase = process.env.CHATKIT_API_BASE ?? DEFAULT_CHATKIT_BASE;
    const url = `${apiBase}/v1/chatkit/sessions`;
    const upstreamResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
        "OpenAI-Beta": "chatkit_beta=v1",
      },
      body: JSON.stringify({
        workflow: { id: resolvedWorkflowId },
        user: userId,
        chatkit_configuration: {
          file_upload: {
            enabled:
              parsedBody?.chatkit_configuration?.file_upload?.enabled ?? false,
          },
        },
      }),
    });

    if (process.env.NODE_ENV !== "production") {
      console.info("[create-session] upstream response", {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
      });
    }

    const upstreamJson = (await upstreamResponse.json().catch(() => ({}))) as
      | Record<string, unknown>
      | undefined;

    if (!upstreamResponse.ok) {
      const upstreamError = extractUpstreamError(upstreamJson);
      console.error("OpenAI ChatKit session creation failed", {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        body: upstreamJson,
      });
      return NextResponse.json(
        {
          error:
            upstreamError ??
            `Failed to create session: ${upstreamResponse.statusText}`,
          details: upstreamJson,
        },
        { status: upstreamResponse.status }
      );
    }

    const clientSecret = upstreamJson?.client_secret ?? null;
    const expiresAfter = upstreamJson?.expires_after ?? null;
    const responsePayload = {
      client_secret: clientSecret,
      expires_after: expiresAfter,
    };

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("Create session error", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}

export async function GET(): Promise<Response> {
  return methodNotAllowedResponse();
}

function methodNotAllowedResponse(): Response {
  return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
}

async function safeParseJson<T>(req: Request): Promise<T | null> {
  try {
    const text = await req.text();
    if (!text) {
      return null;
    }
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function extractUpstreamError(
  payload: Record<string, unknown> | undefined
): string | null {
  if (!payload) {
    return null;
  }

  const error = payload.error;
  if (typeof error === "string") {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  const details = payload.details;
  if (typeof details === "string") {
    return details;
  }

  if (details && typeof details === "object" && "error" in details) {
    const nestedError = (details as { error?: unknown }).error;
    if (typeof nestedError === "string") {
      return nestedError;
    }
    if (
      nestedError &&
      typeof nestedError === "object" &&
      "message" in nestedError &&
      typeof (nestedError as { message?: unknown }).message === "string"
    ) {
      return (nestedError as { message: string }).message;
    }
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }
  return null;
}
