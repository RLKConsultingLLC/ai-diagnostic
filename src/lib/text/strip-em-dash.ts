// =============================================================================
// RLK AI Diagnostic. Em Dash Stripper
// =============================================================================
// Brand voice rule: no em dashes ever appear in any user-visible report
// content. This module is the runtime defense-in-depth: every AI-generated
// string passes through stripEmDash() before display.
//
// The static codebase is also kept em-dash-free (see scripts/check-em-dashes
// for the build-time guard), and every Claude prompt has an anti-em-dash
// directive in the system message. This file is the final stop.
// =============================================================================

// U+2014 EM DASH (the offender)
// U+2013 EN DASH (also banned for the same reasons)
// U+2015 HORIZONTAL BAR (rare but covers any look-alike paste)
// U+2E3A TWO-EM DASH
// U+2E3B THREE-EM DASH
const EM_DASH_RE = /[—–―⸺⸻]/g;

// Surrounding-whitespace handling. We want intelligent replacement that does
// not produce double spaces or orphan punctuation.
//
//  spaced dash (word [dash] word)   becomes  word. word   (sentence break)
//  tight dash  (word[dash]word)     becomes  word, word   (clause break)
//  half-spaced variants             become   word, word
//
// Numeric ranges (e.g. "10-15") are normalized to a plain hyphen so
// numeric content stays readable.

const NUMERIC_RANGE_RE = /(\d)\s*[—–―⸺⸻]\s*(\d)/g;
const SPACED_DASH_RE = /\s+[—–―⸺⸻]\s+/g;
const TIGHT_DASH_RE = /[—–―⸺⸻]/g;

/**
 * Strip em dashes from any string. Applied to all AI-generated text before
 * the user sees it. Safe to call on the empty string, undefined, or null.
 */
export function stripEmDash(input: string | null | undefined): string {
  if (!input) return '';
  return input
    .replace(NUMERIC_RANGE_RE, '$1-$2')   // 10–15 becomes 10-15
    .replace(SPACED_DASH_RE, '. ')         // sentence break becomes a period
    .replace(TIGHT_DASH_RE, ', ');         // tight clause break becomes a comma
}

/**
 * Recursively strip em dashes from any string fields in a value. Use this
 * on AI-generated objects (report sections, research profiles) before they
 * are persisted or rendered. Non-string fields pass through unchanged.
 */
export function stripEmDashDeep<T>(value: T): T {
  if (value == null) return value;
  if (typeof value === 'string') return stripEmDash(value) as unknown as T;
  if (Array.isArray(value)) {
    return value.map((v) => stripEmDashDeep(v)) as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = stripEmDashDeep(v);
    }
    return out as T;
  }
  return value;
}

/**
 * Boolean check: does this string contain an em dash? Used in tests and the
 * build-time guard. Not used at runtime (we strip rather than throw).
 */
export function containsEmDash(input: string | null | undefined): boolean {
  if (!input) return false;
  return EM_DASH_RE.test(input);
}

/**
 * Standard anti-em-dash directive to inject into every Claude system prompt.
 * Keep this in one place so the directive is consistent across all calls.
 */
export const NO_EM_DASH_DIRECTIVE =
  'CRITICAL STYLE RULE: Never use em dashes (—), en dashes (–), or any dash-like punctuation between words or clauses. Use periods, commas, parentheses, or colons instead. For numeric ranges, use a hyphen (e.g. 10-15). This rule has no exceptions. Output that contains an em dash will be rejected.';
