// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { SELFCHECK_ROUTINE_BASE_ADDR, TAIL_CHECKSUM_GUARD } from "./names.js";
import { renderGaugeAndSetPlayStateForPlayer } from "./renderGaugeAndSetPlayStateForPlayer.js";
/**
 * verifyRoutineChecksumOrDivert — code-region integrity self-check.
 *
 * WHAT IT IS
 *   One of the machine's anti-tamper tripwires. It sums the raw bytes of a fixed stretch of
 *   program code (the routine whose body starts at SELFCHECK_ROUTINE_BASE_ADDR = 0x68ac) into a
 *   16-bit running total, then checks that total against a two-byte reference word baked into the
 *   image. The reference is the value the sum lands on for an untouched image, so any edit to the
 *   summed code shifts the total off the reference and is caught here.
 *
 * ROLE IN THE MACHINE
 *   Part of the anti-tamper lattice that shadows the play machine. Like the ROM's other integrity
 *   probes, it does no useful "game" work when the image is intact — it merely confirms a slice of
 *   code still hashes to its expected word. Its value is entirely in what it does on a mismatch: a
 *   corrupted image is steered away from normal flow. The two mismatch outcomes are deliberately
 *   asymmetric (see below), which is characteristic of this ROM's obfuscated tamper style — a trip
 *   does not always look like an abort.
 *
 * ROM ADDRESS: 0x79e9 (occupies 0x79e9-0x7a0a; the guard word and the text/data that follow at
 *   0x7a0b onward are read as data, not executed here).
 *
 * GROUNDING: [seen].
 *
 * THE SCAN
 *   The summed region has no length field. The scan walks forward from 0x68ac byte by byte and
 *   stops at the first 0xc9 (the `ret` opcode that terminates that routine) — the terminator marks
 *   the end of the region, so the byte count is discovered, not assumed. The 16-bit total is kept
 *   as two 8-bit halves: `low` is the sum modulo 256, and `high` counts how many times the low half
 *   has carried past 255.
 *
 * THE TWO GUARDS (at TAIL_CHECKSUM_GUARD = 0x7a0b and the byte above it, 0x7a0c)
 *   - Low-byte guard (0x7a0b): a hard integrity trap. With the summed code bytes unmodified the low
 *     half always equals this stored byte, so this branch is unreachable in normal operation; a
 *     mismatch means the image is corrupt and the routine aborts outright.
 *   - High-byte guard (0x7a0c): a softer diversion. On a mismatch the routine hands off to
 *     renderGaugeAndSetPlayStateForPlayer (redraw the phase gauge and set the active player's play
 *     sub-state) instead of aborting — the tamper vector points at a real gameplay routine, so the
 *     diversion does not read as a trap.
 *   - Both guards clean: the routine simply falls through.
 *
 * LIVE-OUT: DE = the 16-bit checksum the scan produced (high << 8 | low). It is exposed as the
 *   routine's result to give this otherwise write-free probe a checkable output; nothing downstream
 *   consumes it.
 */

const RET_OPCODE = 0xc9; // the summed routine's terminating `ret`, which marks the end of the scanned region

export function verifyRoutineChecksumOrDivert(m) {
  const { mem8 } = m;

  // The 16-bit accumulator, kept as two independent 8-bit halves: `low` is the running sum modulo
  // 256, `high` counts carries out of the low half. `addr` is the scan pointer, started at the base
  // of the code region to be summed (SELFCHECK_ROUTINE_BASE_ADDR = 0x68ac).
  let low = 0;
  let high = 0;
  let addr = SELFCHECK_ROUTINE_BASE_ADDR;
  // Walk the region forward, byte by byte, until the terminating `ret` (0xc9) marks its end. Each
  // byte is added into the low half; whenever that addition overflows past 255 the overflow is
  // tallied into the high half, so the pair together forms the true 16-bit sum of the region.
  while (mem8[addr] !== RET_OPCODE) {
    const acc = low + mem8[addr];
    low = acc & 0xff;
    if (acc > 0xff) high = (high + 1) & 0xff; // carry out of the low byte into the high half
    addr = u16(addr + 1);
  }

  // Low-byte guard (0x7a0b): the hard integrity trap. For an intact image the low half always
  // matches this stored byte, so this path cannot be taken during normal operation — a mismatch
  // means the summed code has been altered, and the machine aborts rather than continue on a
  // corrupted image.
  if (low !== mem8[TAIL_CHECKSUM_GUARD]) {
    throw new Error("verifyRoutineChecksumOrDivert: checksum low-byte mismatch (integrity trap, unreachable while the summed bytes are intact)");
  }
  // High-byte guard (0x7a0c, the byte just above TAIL_CHECKSUM_GUARD): the soft diversion. On a
  // mismatch, instead of aborting, control is steered into the phase-gauge / play-sub-state path —
  // a legitimate-looking gameplay routine standing in as the tamper vector.
  if (high !== mem8[u16(TAIL_CHECKSUM_GUARD + 1)]) {
    return renderGaugeAndSetPlayStateForPlayer(m); // high-byte mismatch diversion
  }
  // Both guards clean: leave the assembled 16-bit checksum in DE as the routine's live-out.
  return (m.regs.de = (high << 8) | low); // DE live-out: the computed checksum
}
