/**
 * The grounding contract.
 *
 * The assistant is not asked to "avoid making up numbers" — it is given no
 * way to write one. Instead of typing a value, it emits a reference token:
 *
 *     "Your resting heart rate averages {{restingHeartRate.avg7d}}."
 *
 * The renderer replaces every token with the value held in the reference
 * index. A number the user sees on screen was therefore read out of the same
 * store the charts read from; there is no code path by which the model can
 * print a figure of its own invention, whether from confusion or from a bad
 * sampling step.
 *
 * The failure mode this leaves is a reference to something that does not
 * exist. That is checked after every response: unknown tokens are counted,
 * rendered as a visible marker rather than silently dropped, and reported on
 * the message so the UI can be honest that part of the answer is unverified.
 */

import { formatEvidenceValue } from "../refs";
import type { RefIndex } from "../refs";
import type { EvidenceRef } from "../types";

/**
 * `{{some.ref.id}}` — the only legal way for the model to state a number.
 *
 * Built fresh on each call rather than shared: a module-level `/g` regex
 * carries `lastIndex` between uses, and a stray state leak here would silently
 * skip citations — the one bug this module exists to prevent.
 */
const refTokenPattern = (): RegExp => {
  return /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g;
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
 * index. This is what the React layer maps over — there is no second parsing
 * path, so what is validated is exactly what is displayed.
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
 * prints one.
 *
 * A citation renders as value *and* unit — "61 bpm" — so the number is never
 * ambiguous standing on its own, and a token used with no unit in the prose
 * still reads correctly. A model that writes the unit as well produces "61 bpm
 * bpm". Asking it not to in the prompt is a rule that holds most of the time;
 * removing the duplicate here holds always, and leaves the sentence correct
 * whether or not the model complied.
 *
 * This has to run on the raw markdown, before parsing, for two reasons.
 * Emphasis markers sit between the token and the unit in the commonest phrasing
 * of all — `**{{restingHeartRate.avg7d}}** bpm` — so the two are in different
 * markdown nodes by the time anything is rendered, and a pass over parsed
 * children would never see them together. Running first also means the UI, the
 * clipboard text and the preview all inherit the same correction, instead of
 * each having to remember it.
 *
 * The match is unit-aware and anchored to the citation it follows, so a unit
 * belonging to a *different* number survives ("{{a.x}} bpm and {{b.y}} ms" loses
 * nothing), as does a word that merely starts with the unit ("{{w.avg7d}} grams"
 * keeps its "grams" — only the bare unit is a duplicate).
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
 * Flatten a response to plain text with values substituted. Used for logs and
 * for the copy-to-clipboard action; the UI renders `segmentGrounded` instead
 * so that citations stay interactive.
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
