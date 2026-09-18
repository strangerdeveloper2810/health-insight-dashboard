/**
 * Configuration, read once at boot.
 *
 * The API key lives here and nowhere else. Nothing in this file is prefixed
 * `VITE_`, nothing is bundled for the browser, and the health endpoint reports
 * only whether a key is present — never its value, prefix or length.
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
    // Deliberately not `ANTHROPIC_MODEL`. That name is already taken by
    // several Anthropic developer tools, which export it into the shell — so
    // running this app on a machine set up for something else would silently
    // send requests to a model this app was never tested against. The API key
    // keeps its conventional name because the SDK reads it too.
    //
    // Sonnet rather than Opus by default. The work here — pick a tool, read a
    // snapshot, write three sentences with citation tokens — is not the kind of
    // task that separates the two, and the dashboard is meant to be opened and
    // poked at without a thought for the bill. `claude-haiku-4-5-20251001` is
    // cheaper still; `claude-opus-5` is a one-line change if answer quality
    // ever turns out to be the constraint.
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
 * The subset of config that is safe to send to a browser. Built by listing
 * fields explicitly rather than deleting the key from a copy, so adding a
 * secret to `Config` later cannot leak it by default.
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
