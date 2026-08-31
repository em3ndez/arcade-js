// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { binToPackedBcd } from "./binToPackedBcd.js";
import { drawStackedBcdDigits } from "./drawStackedBcdDigits.js";
import { INTRO_PHASE_INDEX, HIT_TALLY, HUD_INTRO_DIGITS_BASE } from "./names.js";
/**
 * advanceIntroPhaseAndDrawHitTally — level-intro phase 2.
 *
 * WHAT IT IS
 *   One of the seven per-frame handlers that make up the level-intro (round-start) screen. The
 *   intro runs as a small state machine: the byte INTRO_PHASE_INDEX (work RAM 0x8f51) selects
 *   which phase handler runs this frame, and each handler does its one job and then steps that
 *   selector so the next phase takes over on a following frame. This is phase 2, and it fires as
 *   a one-shot: it paints the intro's target-hit readout and immediately advances the machine.
 *
 * ITS ROLE IN THE MACHINE
 *   When the round has just been cleared, the intro screen shows how many targets the player hit
 *   during the finished stage. That running count lives in HIT_TALLY (work RAM 0x8f52), bumped
 *   once per collision while the stage was in play. This phase renders it onto the intro HUD as a
 *   two-digit decimal field at HUD_INTRO_DIGITS_BASE (video-RAM tile cell 0x8634), and renders the
 *   same count DOUBLED as a second two-digit field a short distance higher up the screen. A later
 *   phase (level-intro phase 4) reuses this very HUD cell for the scaled target-group count, so the
 *   number shown here is transient — it is the "hits" line of the round-start summary.
 *
 * ROM
 *   0x6f42-0x6f5d.
 *
 * GROUNDING
 *   [seen].
 *
 * LIVE-OUT
 *   Memory only: the advanced INTRO_PHASE_INDEX byte, plus the four painted digit tiles in video
 *   RAM (two per field). The digit-drawing helper leaves values in HL/E/BC on the way out, but this
 *   phase is a terminal handler — nothing downstream reads those back.
 */

// One tilemap row is 0x20 tile cells; addresses run downward as you climb the screen, so stepping
// by -0x20 moves the write cursor one row UP the display.
const ROW_STRIDE_UP = -0x20;

/**
 * Double a packed-BCD byte, keeping the low two decimal digits (an add-then-daa in decimal).
 *
 * A packed-BCD byte carries one decimal digit per nibble (tens in the high nibble, units in the
 * low). This unpacks it to a plain 0-99 value, doubles it, discards any hundreds carry (mod 100),
 * and re-packs — mirroring how the hardware forms this second field: add the value to itself in
 * binary, then decimal-adjust the result back into two valid BCD digits.
 */
function doubleBcd(packed) {
  const value = (packed >> 4) * 10 + (packed & 0x0f);
  const doubled = (value * 2) % 100;
  return (Math.floor(doubled / 10) << 4) | (doubled % 10);
}

export function advanceIntroPhaseAndDrawHitTally(m) {
  const { mem8 } = m;

  // Step the intro-phase selector (0x8f51) so this one-shot hands the intro screen to the next
  // phase handler on a subsequent frame — this phase does its drawing exactly once.
  mem8[INTRO_PHASE_INDEX] = mem8[INTRO_PHASE_INDEX] + 1;
  // Read the round's running target-hit count from HIT_TALLY (0x8f52), a plain binary total bumped
  // once per collision during the stage.
  const tally = mem8[HIT_TALLY];
  // Convert the binary count to packed BCD (its low two decimal digits) so it can be drawn digit
  // by digit. A zero tally is short-circuited to a packed 0 and skips the conversion entirely —
  // the count-up converter would otherwise treat a zero counter as a full 256-pass wrap.
  const packed = tally === 0 ? 0 : binToPackedBcd(m, tally).a;

  // Paint the tally as a two-digit field at the intro HUD base (video-RAM cell 0x8634): tens digit
  // at the base cell, units digit one row up. `first.next` is that units cell (base - 0x20).
  const first = drawStackedBcdDigits(m, HUD_INTRO_DIGITS_BASE, packed);
  // The second field sits two more rows up the screen from the units cell of the first field.
  const dst2 = u16(first.next + 2 * ROW_STRIDE_UP);
  // Paint the tally DOUBLED as a second two-digit field there, so the intro shows both the raw hit
  // count and its double stacked above one another.
  drawStackedBcdDigits(m, dst2, doubleBcd(packed));
}
