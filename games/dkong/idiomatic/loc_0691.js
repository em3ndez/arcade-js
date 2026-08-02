// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0691 — award two table-selected BCD score amounts from the packed digit byte at 0x638c,
 * one per nibble.  ROM 0x0691.
 *
 * Reached from loc_062a's task-entry-10 dispatch on its A==0 arm (`jp z,0x0691`). The routine
 * reads the packed digit byte at 0x638c — two BCD-ish digits, one per nibble — and runs the
 * add-to-score task (addToScoreTask) once per digit:
 *   - low nibble  -> addToScoreTask payload = (byte & 0x0f): indexes the "small" addend (table index
 *     = the digit itself; index 0 adds nothing).
 *   - high nibble -> addToScoreTask payload = (byte >> 4) + 0x0a: the SAME task, but its addend-table
 *     index is offset by ten, so the high digit selects a "large" addend (index 10 + digit;
 *     index 10 adds nothing). This is the rrca-x4 nibble swap in the oracle: rotating the byte
 *     right four places drops its high nibble into the low position, which `and 0x0f` then keeps.
 *
 * loc_0691 is the twin of loc_066a (39 bytes away) with INVERTED register roles — loc_066a keeps
 * the original byte in C and the low nibble in B; loc_0691 keeps the original in B and leaves the
 * low nibble in A. Here the nibbles are score-task payloads rather than tile digits, and the tail
 * `jp 0x051c` means the second add's return belongs to loc_0691's own caller (loc_062a's caller).
 * The oracle's `push bc` at 0x0697 saves the original byte across the first call and `pop bc`
 * restores it for the high-nibble computation; the idiomatic form keeps the byte in a local, so no
 * register need survive the call. (The C the oracle pushes there is the caller's, never set on this
 * path and never read — addToScoreTask's first act is `ld c,a`, overwriting it — so it cannot reach RAM.)
 *
 * Memory-equivalent to the frozen oracle — equivalence-0691.test.js.
 * GATE:     exhaustive over loc_0691's ONE input byte — sweeps all 256 values of 0x638c on a
 *           crafted base (ATTRACT cleared so addToScoreTask's body runs; a mid score under a lower high
 *           score so the adds and a promotion are observable), for both players, proving loc_0691
 *           feeds the correct two payloads for every possible byte. addToScoreTask's own arms are its
 *           gate's job (equivalence-051c). RAM minus the dead STACK_SCRATCH the oracle's push/call
 *           churn writes. Reachability probed; teeth pin the +0x0a offset and the nibble routing.
 * LIVE-OUT: memory-only — the score counter, the high-score counter (when it leads) and the score /
 *           high-score readouts addToScoreTask writes. loc_0691 returns nothing a caller reads: loc_062a
 *           tail-jumps in and the terminal return unwinds to loc_062a's caller, which reloads.
 * NAMES:    0x638c is an UNNAMED shared scratch byte (ram.js names it none) — a packed BCD
 *           digit-pair produced by loc_062a's task-10 divide (quotient in the high nibble), stale
 *           here since the A==0 arm skips that write — so it stays hex + comment. addToScoreTask (ROM
 *           0x051C, the add-to-score task) is direct-called.
 */

import { addToScoreTask } from "./addToScoreTask.js"; // ROM 0x051C — the add-to-score task (payload in the accumulator)

export function loc_0691(m) {
  const { regs, mem } = m;

  // The packed digit byte: low nibble is the small addend's index, high nibble the large one's.
  const packed = mem.read8(0x638c); // unnamed shared task-10 packed-BCD digit-pair scratch

  // First digit: the low nibble is the add-to-score payload directly.
  regs.a = packed & 0x0f;
  addToScoreTask(m);

  // Second digit: the high nibble, its addend-table index offset by ten.
  regs.a = ((packed >> 4) + 0x0a) & 0xff;
  addToScoreTask(m);
}
