/**
 * Configuration, read once at boot. The API key lives here and nowhere else —
 * nothing is prefixed `VITE_`, nothing is bundled for the browser, and the
 * health endpoint reports only whether a key is present.
 */

import type { Effort, PublicConfig } from "@health/core";

const EFFORTS: readonly Effort[] = ["low", "medium", "high", "xhigh", "max"];

export interface Config {
  apiKey: string | null;
  model: string;
  effort: Effort;
  maxTokens: number;
  port: number;
  webOrigin: string;
  datasetSeed: number;
  datasetDays: number;
}

const intFromEnv = (name: string, fallback: number): number => {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const effortFromEnv = (): Effort => {
  const raw = process.env.ASSISTANT_EFFORT?.trim() as Effort | undefined;
  // A typo in an env var should not silently degrade answer quality, so an
  // unrecognised value falls back to the default rather than being passed on.
  return raw && EFFORTS.includes(raw) ? raw : "medium";
};

export const loadConfig = (): Config => {
  return {
    apiKey: process.env.ANTHROPIC_API_KEY?.trim() || null,
    // Deliberately not `ANTHROPIC_MODEL`: that name is already exported into
    // the shell by several Anthropic developer tools, so a machine set up for
    // something else would silently send requests to a model this app was
    // never tested against. The API key keeps its conventional name because
    // the SDK reads it too. Sonnet by default; `claude-opus-5` is a one-line
    // change if answer quality ever turns out to be the constraint.
    model: process.env.ASSISTANT_MODEL?.trim() || "claude-sonnet-5",
    effort: effortFromEnv(),
    // Generous, because adaptive thinking draws from the same budget as the
    // answer and a truncated reply mid-citation is worse than a slower one.
    maxTokens: intFromEnv("ASSISTANT_MAX_TOKENS", 8192),
    port: intFromEnv("PORT", 8787),
    webOrigin: process.env.WEB_ORIGIN?.trim() || "http://localhost:5173",
    datasetSeed: intFromEnv("DATASET_SEED", 20260918),
    datasetDays: intFromEnv("DATASET_DAYS", 90),
  };
};

/**
 * The subset of config that is safe to send to a browser — built by listing
 * fields rather than deleting the key from a copy, so adding a secret to
 * `Config` later cannot leak it by default.
 */
export const publicConfig = (config: Config): PublicConfig => {
  return {
    model: config.model,
    effort: config.effort,
    datasetSeed: config.datasetSeed,
    datasetDays: config.datasetDays,
    /** False puts the assistant into a clearly-labelled demo mode. */
    assistantConfigured: config.apiKey !== null,
  };
};
