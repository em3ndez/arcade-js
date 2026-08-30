// SPDX-License-Identifier: GPL-3.0-only
/**
 * noopStateHandler — the do-nothing display-list handler: a bare return. [seen]
 *
 * ROM 0x0e53 (a single RET byte).
 *
 * WHAT IT IS
 *   One byte of ROM, RET. It draws nothing, touches no memory, and returns immediately.
 *
 * ROLE IN THE MACHINE
 *   The display-list driver walks a table of handler addresses (the table at ROM 0x06f8) and
 *   runs one per list entry to paint that entry. Some entries are inert — a slot that is
 *   present in the layout but has nothing to draw this pass. The table holds this routine's
 *   address (dw 0x0e53) for those slots, so selecting one is a well-defined "paint nothing":
 *   the driver runs a handler for every slot without a special-case for empty ones.
 *
 * It ends exactly at the 0x0e54 boundary (the next routine begins there); it is a leaf and
 * calls nothing.
 *
 * LIVE-OUT: none — no memory written, no register changed.
 */
export function noopStateHandler(m) {
  // Nothing to paint for this slot: return straight away.
  return;
}
