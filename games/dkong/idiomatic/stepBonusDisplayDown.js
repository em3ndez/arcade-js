// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepBonusDisplayDown — decrement the packed two-digit BCD bonus readout BONUS_DISPLAY by one, latch a
 * "reached zero" marker when it rolls from 01 to 00, store it back, and render it.  ROM 0x06A8.
 *
 * The after-subtract arm of task-entry 10's field render (entry_062a). The counter it steps
 * is BONUS_DISPLAY (0x638C), the on-screen bonus readout. The incoming value is that cell's
 * current byte, holding two decimal digits one per nibble, which the caller has already
 * established is non-zero. This routine takes it one step down: subtract one, decimal-adjust
 * back into valid packed BCD (00 wraps to 99), store the new value into BONUS_DISPLAY, and hand
 * it to the shared field renderer.
 *
 * ★ THE PACKED-BCD LAYOUT IS NOW OBSERVED — caveat discharged. Pass 12 could only call the
 * one-decimal-digit-per-nibble reading CODE-DERIVED (from the `daa` this routine runs and the
 * nibble split its render tail does). Pass 13 measured it on the real dkong ROM under MAME 0.288
 * (scratchpad/pass13-grounding.md §3a): over 99,367 comparable frames spanning BONUS 0..80,
 * BONUS_DISPLAY == BCD(BONUS) against the separately-[seen] BINARY counter BONUS (0x62B1) with ZERO
 * mismatches, the low nibble never exceeded 9, and this routine's own BORROW is directly visible in
 * the natural transition log — 0x50 -> 0x49 and 0x40 -> 0x39 while the quantity drops by exactly 1,
 * a raw byte falling by 7 for a decrement of one, which is the `daa` below doing its work.
 * HONEST FLOOR: that confirms the encoding over the whole REACHABLE range, not over all 256 byte
 * values. A nibble of 0xA-0xF is UNREACHABLE rather than merely unobserved, because the ROM clamps
 * BONUS_START to 80 so the display can never exceed 0x80 on any reachable path — an argument from
 * the clamp, not an observation of every input. The exhaustive 256-value gate below is what pins
 * this routine's behaviour on the unreachable values.
 *
 * When the value has just reached zero (it held 01), a one-byte marker is latched into
 * BONUS_DISPLAY_ZEROED (0x63B8) before the adjust — the caller reads that latch to tell the
 * readout has bottomed out. Pass 13 grounded that latch live as well: it was set exactly once at
 * ROM 0x06AF, on the frame the display stepped 0x01 -> 0x00, and a controlled A/B on its only
 * reader showed the re-seed body running 5/5 with the latch clear and 0/2 with it set.
 *
 * The decrement and the decimal-adjust are kept as the machine's own subtract/adjust because
 * the adjust reads the half-carry, subtract-mode, and carry flags the subtract leaves — this
 * is the after-subtract decimal adjust, whose correctness is pinned against MAME. Only a plain
 * memory write sits between them, which leaves those flags intact, so the adjust sees exactly
 * the subtract's result.
 *
 * NAME (promoted from loc_06a8, DK understanding pass 13 — independent proposer ≠ confirmer,
 * confidence HIGH). Corroboration from OUTSIDE this routine:
 *   - Both cells it writes are named and rated in ram.js: BONUS_DISPLAY (0x638C, [seen]) — "the
 *     number the player watches count down" — and BONUS_DISPLAY_ZEROED (0x63B8, [seen], POKED) —
 *     "latch recording that the bonus readout has bottomed out". A raw-ROM operand scan finds
 *     0x63B8 referenced exactly twice in the image: written at ROM 0x06AC (here) and read at
 *     ROM 0x0635, in the caller — so the latch's one reader is outside this routine.
 *   - The caller's structure gives the routine its role: loc_062a reads BONUS_DISPLAY and jumps
 *     here only on the NON-ZERO arm, taking the zero arm to the latch check and re-seed instead.
 *     This is unambiguously the "there is bonus left, take one notch off it" arm.
 *   - One BCD notch = 100 points, corroborated arithmetically rather than assumed: loc_062a seeds
 *     the display as (BONUS_START/10) << 4, ram.js gives BONUS_START = 50 at level 1, and
 *     mechanisms.md §6 gives level 1 = 5000 on screen — 50/10 = 5 -> 0x50 -> "5000", so one
 *     decrement of the packed byte is one hundred points.
 * WHAT THE NAME DOES NOT CLAIM: not that this routine awards or deducts score — it steps the
 * DISPLAY byte only; the quantity BONUS (0x62B1) is stepped elsewhere, by the timed decrementer on
 * boards 2/3/4 and by the barrel-release routine on 25m. And it does not claim the display and the
 * quantity are the same cell: they are two cells kept in lockstep, which is exactly what the pass-13
 * pairing above measured.
 *
 * Memory-equivalent to the frozen oracle — equivalence-06a8.test.js.
 * GATE:     exhaustive — the whole memory effect is a pure function of the incoming counter
 *           byte (this routine and its render tail read no work RAM), so sweeping all 256
 *           values on a real captured base is a proof over both the zero-latch arm and the
 *           ordinary-decrement arm. Backed by real captured 0x06A8 dispatches. Whole-RAM diff
 *           (nothing in the chain writes the stack — the oracle's tail is a jump and the only
 *           return merely pops, so there is no dissolved push to exclude). Teeth: a dropped
 *           decimal adjust, a dropped zero latch, and an always-latch twin.
 * LIVE-OUT: memory-only — BONUS_DISPLAY, BONUS_DISPLAY_ZEROED, and the render tail's field
 *           cells / background-music command. The adjusted value also stays in a
 *           register, which the render tail consumes as its input, but no caller reads a
 *           register back after this returns, so the residual registers/flags are dead.
 * NAMES:    BONUS_DISPLAY (0x638C) — the on-screen bonus readout this routine steps and
 *           stores — and BONUS_DISPLAY_ZEROED (0x63B8) — the latch recording that the readout
 *           has bottomed out — both from ram.js.
 *           renderBonusDisplay (ROM 0x066A) is direct-called; it reads its digit byte from the register.
 */

import { BONUS_DISPLAY, BONUS_DISPLAY_ZEROED } from "./ram.js";
import { renderBonusDisplay } from "./renderBonusDisplay.js"; // ROM 0x066A — packed-BCD field renderer (the tail join)

export function stepBonusDisplayDown(m) {
  const { regs, mem } = m;

  // Step the packed BCD counter down by one; this leaves the flags the adjust below reads.
  regs.sub(0x01);

  // Just rolled to zero (the readout held 01): latch the "reached zero" marker.
  if (regs.a === 0) {
    mem.write8(BONUS_DISPLAY_ZEROED, 0x01);
  }

  // Decimal-adjust the decrement back into valid packed BCD (00 wraps to 99).
  regs.daa();

  // Store the new readout value, then render it — the tail reads the digit from the register.
  mem.write8(BONUS_DISPLAY, regs.a);
  renderBonusDisplay(m);
}
