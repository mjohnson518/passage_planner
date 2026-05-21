/**
 * Ambient type declarations to patch upstream packages that ship broken
 * or incomplete type definitions for our toolchain.
 *
 * This file is a script (no top-level import/export) so the `declare module`
 * blocks are treated as global module augmentations rather than scoped to a
 * module of their own. To use an import inside an augmentation, do it inside
 * the `declare module` block.
 *
 * @sentry/nextjs@10 splits its surface across ./client, ./server, and
 * ./edge submodules. `import * as Sentry from "@sentry/nextjs"` does not
 * pull `captureException`, `captureMessage`, `init`, `replayIntegration`,
 * or `captureRequestError` into the namespace type even though they exist
 * at runtime via @sentry/core re-exports.
 *
 * html2canvas ships its types as `typings: dist/types/index.d.ts` but
 * moduleResolution=bundler does not always resolve that legacy field; we
 * declare a minimal surface here for the one call site that uses it.
 *
 * `any` is intentional throughout — these are loose pass-throughs to
 * runtime SDKs whose published types we cannot constrain further.
 */

declare module "@sentry/nextjs" {
  export function init(options: Record<string, any>): unknown;
  export function captureException(error: unknown, hint?: any): string;
  export function captureMessage(message: string, hint?: any): string;
  export function replayIntegration(options?: Record<string, any>): unknown;
  export function browserTracingIntegration(
    options?: Record<string, any>,
  ): unknown;
  export function captureRequestError(
    error: unknown,
    request: any,
    errorContext: any,
  ): Promise<void>;
  export function withScope(callback: (scope: any) => void): void;
}

declare module "html2canvas" {
  const html2canvas: (
    element: HTMLElement,
    options?: Record<string, any>,
  ) => Promise<HTMLCanvasElement>;
  export default html2canvas;
}
