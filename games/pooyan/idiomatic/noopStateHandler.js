// SPDX-License-Identifier: GPL-3.0-only
/**
 * noopStateHandler — phantom no-op: a bare return with no memory effect. LIVE-OUT: none.
 */
export function noopStateHandler(m) {
  return;
}
