"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Key } from "lucide-react";
import { Header } from "../components/layout/Header";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { cn } from "../lib/utils";
import {
  API_ENDPOINTS,
  type ApiEndpoint,
  type HttpMethod,
} from "../lib/api-docs/endpoints";

// ============================================================================
// /api-docs (F2) — auto-rendered from `endpoints.ts`. To document a new
// endpoint, edit that file; the page picks up the change with no work here.
// Earlier iterations of this page hard-coded ~800 lines of static markup
// that drifted from the actual API surface; the data-driven version stays
// in lock-step.
// ============================================================================

const METHOD_CLASSES: Record<HttpMethod, string> = {
  GET: "bg-success/10 text-success border-success/30",
  POST: "bg-primary/10 text-primary border-primary/30",
  PUT: "bg-warning/10 text-warning border-warning/30",
  DELETE: "bg-destructive/10 text-destructive border-destructive/30",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={handleCopy}
      aria-label="Copy"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-success" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

function EndpointCard({ endpoint }: { endpoint: ApiEndpoint }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <span
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-1 text-xs font-mono font-semibold",
                METHOD_CLASSES[endpoint.method],
              )}
            >
              {endpoint.method}
            </span>
            <code className="text-sm font-mono break-all">{endpoint.path}</code>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {endpoint.scopes.length === 0 ? (
              <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs">
                public
              </span>
            ) : (
              endpoint.scopes.map((s) => (
                <span
                  key={s}
                  className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium"
                >
                  {s}
                </span>
              ))
            )}
          </div>
        </div>

        <div>
          <p className="font-medium text-sm">{endpoint.summary}</p>
          {endpoint.description && (
            <p className="text-sm text-muted-foreground mt-1">
              {endpoint.description}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Example
            </p>
            <CopyButton text={endpoint.curlExample} />
          </div>
          <pre className="rounded-md border border-border bg-muted/40 p-3 text-xs font-mono overflow-x-auto">
            {endpoint.curlExample}
          </pre>
        </div>

        {endpoint.responseShape && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setExpanded((x) => !x)}
              className="text-xs font-medium text-primary hover:underline"
            >
              {expanded ? "Hide" : "Show"} response shape
            </button>
            {expanded && (
              <pre className="rounded-md border border-border bg-muted/40 p-3 text-xs font-mono overflow-x-auto">
                {endpoint.responseShape}
              </pre>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ApiDocsPage() {
  return (
    <>
      <Header />
      <div className="min-h-screen px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-8">
          <div>
            <h1 className="font-display text-4xl mb-2">API documentation</h1>
            <p className="text-muted-foreground">
              Use these endpoints to integrate Helmwise into your own scripts,
              chartplotter apps, or fleet-management tooling. API access
              requires a Pro subscription.
            </p>
          </div>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-xl mb-1">Authentication</h2>
                  <p className="text-sm text-muted-foreground">
                    Send every authenticated request with{" "}
                    <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                      X-API-Key: hwk_xxxx_...
                    </code>{" "}
                    . Generate a key on the API keys page; the full secret is
                    shown ONCE at creation.
                  </p>
                  <div className="mt-3">
                    <Link href="/account/api-keys">
                      <Button size="sm">Manage API keys</Button>
                    </Link>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-3">
              <h2 className="font-display text-xl">Quick start</h2>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>
                  Upgrade to Pro and create an API key with the scopes you need.
                </li>
                <li>
                  Save the key as an environment variable:{" "}
                  <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                    export HELMWISE_API_KEY=hwk_…
                  </code>
                </li>
                <li>
                  Set the host:{" "}
                  <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                    export HELMWISE_API=https://helmwise.co
                  </code>
                </li>
                <li>Copy any curl example below and run it.</li>
              </ol>
              <p className="text-xs text-muted-foreground pt-2 border-t border-border">
                <strong>Rate limits:</strong> per-key, configurable at key
                creation (default 1,000 requests / day). Hitting the limit
                returns 429 with the key&apos;s daily cap in the error message.
              </p>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h2 className="font-display text-2xl">Endpoints</h2>
            <p className="text-sm text-muted-foreground">
              {API_ENDPOINTS.length} endpoints documented. Need an endpoint that
              isn&apos;t listed? Email{" "}
              <a
                href="mailto:api@helmwise.co"
                className="text-primary hover:underline"
              >
                api@helmwise.co
              </a>
              .
            </p>
            {API_ENDPOINTS.map((ep) => (
              <EndpointCard key={ep.id} endpoint={ep} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
