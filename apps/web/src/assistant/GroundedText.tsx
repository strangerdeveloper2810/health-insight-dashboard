/**
 * Rendering an answer that cites its sources: each `{{restingHeartRate.avg7d}}`
 * token is replaced with the value behind it, from the same index the server
 * validated against. A token that does not resolve is marked, not dropped.
 *
 * The tokens sit inside text nodes `react-markdown` has already parsed, so the
 * pass walks the rendered tree and rewrites string children — which covers a
 * citation inside **bold** or a list item without a parser plugin.
 */

import { Children, cloneElement, isValidElement } from "react";
import type { ReactNode } from "react";
import Markdown from "react-markdown";
import { dropRepeatedUnits, formatEvidenceValue, segmentGrounded } from "@health/core";
import type { RefIndex } from "@health/core";

const CitationChip = ({ text, label }: { text: string; label: string }) => {
  return (
    <span
      title={label}
      className="mx-0.5 inline-flex items-baseline gap-1 rounded-[6px] bg-brand-soft px-1.5 py-px align-baseline text-[0.92em] font-medium text-brand"
    >
      {text}
    </span>
  );
};

const UnresolvedToken = ({ token }: { token: string }) => {
  return (
    <span
      title={`The assistant referred to "${token}", which is not a value in your data. Treat this claim with caution.`}
      className="mx-0.5 inline-flex items-baseline gap-1 rounded-md border border-dashed border-alert/50 bg-alert-soft px-1.5 py-px align-baseline text-[0.92em] font-medium text-alert"
    >
      <span aria-hidden>?</span>
      <span className="sr-only">Unverified value:</span>
      {token}
    </span>
  );
};

/** Replace every reference token in one run of plain text. */
const Grounded = ({ text, index }: { text: string; index: RefIndex }) => {
  const segments = segmentGrounded(text, index);

  return (
    <>
      {segments.map((segment, position) => {
        if (segment.kind === "text") return <span key={position}>{segment.text}</span>;
        if (segment.kind === "ref") {
          return (
            <CitationChip
              key={position}
              text={formatEvidenceValue(segment.ref)}
              label={segment.ref.label}
            />
          );
        }
        return <UnresolvedToken key={position} token={segment.token} />;
      })}
    </>
  );
};

/**
 * Walk a parsed markdown subtree, grounding every string it contains. Recursing
 * rather than overriding a component per inline tag means a citation inside a
 * bold phrase or a nested list works without enumerating the vocabulary.
 */
const groundChildren = (children: ReactNode, index: RefIndex): ReactNode => {
  return Children.map(children, (child, position) => {
    if (typeof child === "string") {
      return <Grounded key={position} text={child} index={index} />;
    }
    if (isValidElement(child)) {
      const props = child.props as { children?: ReactNode };
      if (props.children === undefined) return child;
      return cloneElement(child, {
        key: position,
        children: groundChildren(props.children, index),
      } as Record<string, unknown>);
    }
    return child;
  });
};

export const MarkdownAnswer = ({ text, index }: { text: string; index: RefIndex | null }) => {
  if (!index) {
    // No index means the dashboard has not loaded, so nothing can be resolved;
    // the answer is shown as prose rather than as a wall of unmarked tokens.
    return (
      <div className="prose-answer">
        <Markdown>{text}</Markdown>
      </div>
    );
  }

  // Only block-level containers that hold prose need overriding; the walk
  // takes care of everything nested inside them.
  const ground = (children: ReactNode) => groundChildren(children, index);

  return (
    <div className="prose-answer">
      <Markdown
        components={{
          p: ({ children }) => <p>{ground(children)}</p>,
          li: ({ children }) => <li>{ground(children)}</li>,
          h3: ({ children }) => <h3>{ground(children)}</h3>,
          h4: ({ children }) => <h4>{ground(children)}</h4>,
          strong: ({ children }) => <strong>{ground(children)}</strong>,
          em: ({ children }) => <em>{ground(children)}</em>,
        }}
      >
        {/* Before parsing, not after: the model's own unit often sits outside
            the emphasis wrapping the token, so by render time the two are no
            longer adjacent. */}
        {dropRepeatedUnits(text, index)}
      </Markdown>
    </div>
  );
};

export { CitationChip, UnresolvedToken };
