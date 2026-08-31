// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { classifyAndRouteObjectRecordByRound } from "./classifyAndRouteObjectRecordByRound.js";
/**
 * loc_60f2 — outer-scan epilogue: step to the next actor/record pair and re-enter the scan.
 *
 * ROM 0x60f2-0x60fe. Grounding: [code].
 *
 * WHAT IT IS. The per-iteration loop step of the sprite/collision scan whose head is classifyAndRouteObjectRecordByRound.
 * That scan walks a parallel pair of arrays in lock-step: a stride-0x18 actor RECORD array (the
 * `hl` pointer, into the 0x8a80 actor region) and a stride-4 sprite/actor SLOT list (the `ix`
 * pointer). classifyAndRouteObjectRecordByRound classifies the record at `hl` — an empty lead byte or a non-live kind byte
 * is skipped, a live record is routed by round parity to the collision handler (resolveOddRoundCollisionAndAward) or the
 * proximity gate (gateEvenRoundOverlapAndRouteHit). However each of those bodies finishes, control lands HERE to close
 * out the iteration: advance both pointers by one element, count one record off, and go round
 * again while records remain. It is the scan's shared continuation — the scan bodies jump into it
 * rather than call it, so it is a tail of the loop, not a subroutine of its own.
 *
 * ROLE IN THE MACHINE. Together with classifyAndRouteObjectRecordByRound this forms the classic "for each record" walk the
 * game runs to test every actor slot each frame (proximity/collision between shots and targets).
 * classifyAndRouteObjectRecordByRound is the head that decides what to do with the current record; loc_60f2 is the tail that
 * moves to the next one. Draining the count is how the walk terminates when no live record took a
 * hit branch out of the loop.
 *
 * LIVE-OUT: a boolean forwarded up out of the scan — true = normal completion (the walk finished
 * with no early hit-branch abort), false = a caller-skip deeper in the scan wants the caller's
 * frame unwound. No CPU register is left meaningful to the caller; the pointers and count live
 * only for the duration of the walk.
 */
const ACTOR_STRIDE = 0x04;
const RECORD_STRIDE = 0x18;

export function loc_60f2(m, hl = m.regs.hl, ix = m.regs.ix, count = m.regs.b, iy = m.regs.iy, ireg = m.regs.i) {
  // Count one record off the remaining tally (register B of the scan). The & 0xff reproduces the
  // 8-bit wrap of the Z80 `dec b` at 0x60fb so the exhaustion test below matches the hardware.
  const remaining = (count - 1) & 0xff;
  // Count reached zero: every record in the array has been visited and none took an early hit
  // branch out of the loop. The walk is done — report normal completion so the caller carries on
  // with the rest of its frame (this is the `ret` at 0x60fe).
  if (remaining === 0) return true; // every record scanned, no hit
  // Records remain: step to the next pair and re-enter the scan head (the `jp nz,0x6069` at
  // 0x60fb). The record pointer advances one 0x18-byte actor record (hl += 0x18) and the sprite
  // slot pointer advances one 4-byte slot (ix += 4); u16 keeps each pointer wrapped to 16 bits.
  // IY and the I register ride through untouched, so the scan context they carry — the I-parity
  // that selects which target slot the deeper collision/proximity code looks at — survives
  // unchanged across every iteration. The boolean the re-entered scan eventually returns is
  // passed straight back up.
  return classifyAndRouteObjectRecordByRound(m, u16(hl + RECORD_STRIDE), u16(ix + ACTOR_STRIDE), remaining, iy, ireg);
}
