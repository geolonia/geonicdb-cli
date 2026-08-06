/**
 * Sanitizers for text that came from the server (#179 / #183).
 *
 * Kept out of `output.ts` on purpose: this is a pure string function with no
 * console side-effects, and `output.ts` is mocked wholesale by most command
 * tests. Living there meant every one of those mocks had to re-export it, so a
 * new caller broke unrelated suites. Nothing mocks this module.
 */

/**
 * Strip control characters from server-supplied text.
 *
 * Anything the server puts in a header or a message field lands in the
 * operator's terminal verbatim; a compromised or hostile server could otherwise
 * embed ANSI escape sequences to rewrite the display. Use this on every string
 * that comes from a response and is printed as text rather than as JSON.
 *
 * Tab (0x09) and newline (0x0A) survive — they are ordinary formatting, and
 * removing them ran the words of a multi-line server message together (#183).
 * Carriage return (0x0D) does NOT survive: it rewrites the current terminal
 * line, which is the same display-spoofing primitive ANSI escapes give.
 */
export function sanitizeServerText(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, "");
}
