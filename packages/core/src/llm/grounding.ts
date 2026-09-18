/**
 * The grounding contract: the model cites values as reference tokens
 * (`{{restingHeartRate.avg7d}}`) rather than writing them, and the renderer
 * substitutes from the same reference index the charts read. The failure mode
 * left is a token that does not resolve; those are counted, rendered as a
 * visible marker rather than dropped, and reported on the message.
 */

import { formatEvidenceValue } from "../utils/refs";
import type { RefIndex } from "../utils/refs";
import type { EvidenceRef } from "../models/types";

/**
 * A citation token. The id class must include hyphens — goal ids are
 * `goal-rhr`, `goal-steps` and friends, so `{{goal.goal-rhr.current}}` is a
 * real citation. Without the hyphen the token goes unmatched, which fails
 * twice: the raw `{{...}}` reaches the reader, and it is never counted as
 * unknown, so the grounding check passes a figure it never looked at.
 *
 * Built fresh on each call rather than shared: a module-level `/g` regex
 * carries `lastIndex` between uses, and a stray state leak here would silently
 * skip citations — the one bug this module exists to prevent.
 */
const refTokenPattern = (): RegExp => {
  return /\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g;
};

export type GroundedSegment =
  | { kind: "text"; text: string }
  | { kind: "ref"; ref: EvidenceRef }
  | { kind: "unknown"; token: string };

export interface GroundingReport {
  /** Every ref id the response cited, in order, de-duplicated. */
  cited: string[];
  /** Cited ids that resolved against the index. */
  resolved: string[];
  /** Cited ids that do not exist in the index. */
  unknown: string[];
  /** True when every citation resolved. */
  grounded: boolean;
}

/**
 * Split a response into renderable segments, resolving each token against the
 * index — the same one pass, so what is validated is exactly what is displayed.
 */
export const segmentGrounded = (text: string, index: RefIndex): GroundedSegment[] => {
  const segments: GroundedSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(refTokenPattern())) {
    const start = match.index;
    if (start > cursor) {
      segments.push({ kind: "text", text: text.slice(cursor, start) });
    }

    const ref = index.refs.get(match[1]);
    segments.push(ref ? { kind: "ref", ref } : { kind: "unknown", token: match[1] });
    cursor = start + match[0].length;
  }

  if (cursor < text.length) {
    segments.push({ kind: "text", text: text.slice(cursor) });
  }

  return segments;
};

const escapeRegExp = (literal: string): string => {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * Remove a unit the model wrote after a citation, because the citation already
 * prints one ("61 bpm bpm"). Asking it not to in the prompt holds most of the
 * time; removing the duplicate here holds always.
 *
 * Must run on the raw markdown, before parsing: emphasis sits between the token
 * and the unit in the commonest phrasing — `**{{restingHeartRate.avg7d}}** bpm`
 * — so a pass over parsed children would never see the two together.
 *
 * The match is unit-aware and anchored to the citation it follows, so a unit
 * belonging to a different number survives ("{{a.x}} bpm and {{b.y}} ms"), as
 * does a word that merely starts with the unit ("{{w.avg7d}} grams").
 */
export const dropRepeatedUnits = (text: string, index: RefIndex): string => {
  let out = "";
  let cursor = 0;

  for (const match of text.matchAll(refTokenPattern())) {
    const tokenEnd = match.index + match[0].length;
    out += text.slice(cursor, tokenEnd);
    cursor = tokenEnd;

    const ref = index.refs.get(match[1]);
    // Duration and clock refs render without a unit ("7h 30m", "23:15"), so
    // there is nothing a following word could be duplicating.
    if (!ref?.unit || ref.format === "duration" || ref.format === "clock") continue;

    // Emphasis may sit between the token and the unit. `%` renders attached
    // ("61%"); every other unit follows a space.
    const rest = text.slice(tokenEnd);
    const pattern = new RegExp(`^([*_]*) *${escapeRegExp(ref.unit)}(?![A-Za-z0-9_])`);
    const found = rest.match(pattern);
    if (!found) continue;

    const emphasis = found[1] ?? "";
    out += emphasis;
    // Keep the closing marker of a fully bolded unit, or removing "bpm" from
    // "**{{x}}**bpm**" would leave a stray "****" in the prose.
    let consumed = found[0].length;
    if (emphasis && rest.startsWith(emphasis, consumed)) consumed += emphasis.length;
    cursor = tokenEnd + consumed;
  }

  return out + text.slice(cursor);
};

/** Post-hoc check run on the assembled response before it is stored. */
export const validateCitations = (text: string, index: RefIndex): GroundingReport => {
  const cited: string[] = [];
  const unknown: string[] = [];

  for (const match of text.matchAll(refTokenPattern())) {
    const id = match[1];
    if (cited.includes(id)) continue;
    cited.push(id);
    if (!index.refs.has(id)) unknown.push(id);
  }

  const resolved = cited.filter((id) => !unknown.includes(id));
  return { cited, resolved, unknown, grounded: unknown.length === 0 };
};

/**
 * Flatten a response to plain text with values substituted — logs and
 * copy-to-clipboard. The UI renders `segmentGrounded` so citations stay
 * interactive.
 */
export const renderGrounded = (text: string, index: RefIndex): string => {
  return segmentGrounded(dropRepeatedUnits(text, index), index)
    .map((segment) => {
      if (segment.kind === "text") return segment.text;
      if (segment.kind === "ref") return formatEvidenceValue(segment.ref);
      return `[unverified: ${segment.token}]`;
    })
    .join("");
};

/** Strip tokens entirely — for previews, titles and anywhere space is tight. */
export const stripRefTokens = (text: string): string => {
  return text.replace(refTokenPattern(), "").replace(/\s{2,}/g, " ").trim();
};
