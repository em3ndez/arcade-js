// SPDX-License-Identifier: GPL-3.0-only
import { binToPackedBcd } from "./binToPackedBcd.js";
import { drawStackedBcdDigits } from "./drawStackedBcdDigits.js";
import { queueSoundCommand13 } from "./queueSoundCommand13.js";
import {
  MAINLOOP_SUBSTATE_SELECTOR,
  SUBSTATE_FIELD1_COUNTER,
  SUBSTATE_FIELD2_VALUE,
  SUBSTATE_FIELD3_VALUE,
  SUBSTATE_FIELD1_VRAM,
  SUBSTATE_FIELD2_VRAM,
  SUBSTATE_FIELD3_VRAM,
  SUBSTATE_FIELD3_HUNDREDS_VRAM,
} from "./names.js";
/**
 * adjustCounterAndPaintBcdHudFields — walk a small counter to a new value, then repaint a
 * three-field two-digit-BCD HUD readout, advance the play loop's own state machine, and sound a cue.
 *
 * WHAT IT IS
 *   The worker behind the play loop's HUD-repaint sub-state. The ordinary play frame is itself a
 *   six-way state machine held in MAINLOOP_SUBSTATE_SELECTOR (0x8f5c); its states 2->3->4->5 form a
 *   one-way script that choreographs the bonus/round transition. This routine is the body called by
 *   that script's state 3 (the HUD-digit repaint). It is handed a counter, a signed adjustment, and a
 *   direction, and it does both the counting AND the painting of all three on-screen digit fields in
 *   one pass — the three stacked tallies the transition shows (e.g. the "BONUS POINT" / MEAT / WOLF
 *   points lines).
 *
 * ROLE IN THE MACHINE
 *   Every field it paints is a two-digit decimal number drawn straight into the tile map. It first
 *   settles a running counter (field 1's source), then walks the three fields, and finishes by
 *   stepping the sub-state selector one place forward — the tick that marches the transition script
 *   from state 3 to state 4 — and queueing the transition sound cue. Its counting, painting, and the
 *   selector bump are the whole of one scripted transition step.
 *
 * ROM ADDRESS: 0x10c2.
 * GROUNDING: [seen].
 *
 * HOW A NUMBER REACHES THE SCREEN
 *   The hardware has no binary-to-decimal instruction, so a value that must be SHOWN is carried as
 *   packed BCD — two decimal digits, one per nibble (tens high, units low) — and the character ROM
 *   lays the digit glyphs 0..9 at tile codes 0x00..0x09, so a nibble is already its own tile code.
 *   A plain binary count is turned into that packed form by binToPackedBcd; the packed byte is then
 *   split and stamped into a vertical two-cell tile pair by drawStackedBcdDigits (tens at the cursor,
 *   units one row up the screen).
 *
 * FIELD BY FIELD
 *   Field 1: the settled counter, doubled, drawn at SUBSTATE_FIELD1_VRAM (0x85d0).
 *   Field 2: SUBSTATE_FIELD2_VALUE (0x8f5e) — drawn as-is when it is already a single decimal digit,
 *            else re-encoded to packed BCD — at SUBSTATE_FIELD2_VRAM (0x8652).
 *   Field 3: only when SUBSTATE_FIELD3_VALUE (0x8f60) is nonzero — that source is folded into the
 *            field-1 counter, doubled, drawn at SUBSTATE_FIELD3_VRAM (0x85d2), and its hundreds digit
 *            is mirrored to SUBSTATE_FIELD3_HUNDREDS_VRAM (0x85f2) when it carries into the hundreds.
 *
 * LIVE-OUT: on return the Z80 registers carry HL = the address of the sub-state selector
 * (MAINLOOP_SUBSTATE_SELECTOR, 0x8f5c), left by the closing selector bump (the sound-cue append does
 * not disturb HL); and A = the sound ring's advanced write cursor, which the closing cue leaves and
 * which flows out unchanged as this routine's own result. A caller that consumes those registers
 * reads both of them here.
 */
const SINGLE_DIGIT = 0x0a; // field-2 values 0..9 are one decimal digit already (a bare nibble) — no BCD re-encode needed

export function adjustCounterAndPaintBcdHudFields(m, counter = m.regs.b, adjust = m.regs.a, dirUp = m.regs.fC) {
  const { mem8 } = m;

  // Settle the counter to its new value. The counter and the signed adjustment step in lockstep,
  // one unit per pass, until the adjustment wraps to zero (a post-tested loop, so an adjustment of 0
  // on entry means a full turn of 256 passes). The entry carry chooses the direction: carry set ->
  // count up, carry clear -> count down. The counter therefore ends offset from its entry value by
  // however far the adjustment had to travel to reach zero.
  if (dirUp) {
    do { counter = (counter + 1) & 0xff; adjust = (adjust + 1) & 0xff; } while (adjust !== 0);
  } else {
    do { counter = (counter - 1) & 0xff; adjust = (adjust - 1) & 0xff; } while (adjust !== 0);
  }

  // Field 1. Commit the settled counter to its work-RAM cell SUBSTATE_FIELD1_COUNTER (0x8f62), then
  // paint TWICE its value: double it (mod 256), turn that binary count into packed BCD, and stamp the
  // two digits at SUBSTATE_FIELD1_VRAM (0x85d0). The doubling is what makes the on-screen field read
  // as twice the stored counter.
  mem8[SUBSTATE_FIELD1_COUNTER] = counter;
  drawStackedBcdDigits(m, SUBSTATE_FIELD1_VRAM, binToPackedBcd(m, (counter << 1) & 0xff).a);

  // Field 2. Its source SUBSTATE_FIELD2_VALUE (0x8f5e) is a small count. A value already within one
  // decimal digit (0..9) is a valid packed-BCD byte on its own and is drawn as-is; ten or more must
  // be spread across the two nibbles, so it is re-encoded to packed BCD first. Either way the result
  // is stamped at SUBSTATE_FIELD2_VRAM (0x8652).
  const value2 = mem8[SUBSTATE_FIELD2_VALUE];
  const field2 = value2 < SINGLE_DIGIT ? value2 : binToPackedBcd(m, value2).a;
  drawStackedBcdDigits(m, SUBSTATE_FIELD2_VRAM, field2);

  // Field 3. This field is optional — it appears only when its source SUBSTATE_FIELD3_VALUE (0x8f60)
  // is nonzero, so a zero source leaves the third slot untouched.
  const value3 = mem8[SUBSTATE_FIELD3_VALUE];
  if (value3 !== 0) {
    // Fold the field-3 source into the field-1 counter cell (0x8f62): the third value accumulates
    // into the same running total field 1 tracks.
    mem8[SUBSTATE_FIELD1_COUNTER] = mem8[SUBSTATE_FIELD1_COUNTER] + value3; // fold into the counter
    // Draw TWICE the field-3 source: double it (mod 256) and encode to packed BCD, which also yields
    // a separate hundreds tally for values that overflow two digits.
    const { a: field3, hundreds } = binToPackedBcd(m, (value3 << 1) & 0xff);
    // Show a hundreds digit only when the doubled value actually carried into the hundreds; then mirror
    // that digit out to its own tile cell SUBSTATE_FIELD3_HUNDREDS_VRAM (0x85f2).
    if (hundreds !== 0) mem8[SUBSTATE_FIELD3_HUNDREDS_VRAM] = hundreds;
    // Stamp the two low digits of field 3 at SUBSTATE_FIELD3_VRAM (0x85d2).
    drawStackedBcdDigits(m, SUBSTATE_FIELD3_VRAM, field3);
  }

  // Step the play-loop sub-state selector (0x8f5c) forward one place. This is the tick that advances
  // the scripted transition to its next state, so this HUD repaint runs once and then hands off.
  mem8[MAINLOOP_SUBSTATE_SELECTOR] = mem8[MAINLOOP_SUBSTATE_SELECTOR] + 1; // advance the sub-state
  // Finish by queueing the bonus-stage / substate-transition sound cue (command 0x13). Its result —
  // the sound ring's advanced write cursor — becomes this routine's own result (A live-out), while
  // HL is left holding the selector address (HL live-out); a caller reads both registers from here.
  return [(m.regs.hl = MAINLOOP_SUBSTATE_SELECTOR), queueSoundCommand13(m)];
}
