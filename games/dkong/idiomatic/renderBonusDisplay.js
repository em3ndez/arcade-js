// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderBonusDisplay — render a packed two-digit BCD byte into its on-screen field, suppressing a
 * leading zero.  ROM 0x066A.
 *
 * The incoming byte holds two BCD digits, one per nibble: the low nibble is the units
 * digit, the high nibble the tens digit. The routine turns the two digits into their tiles
 * and hands them to the shared stamp tail (stampTwoDigitField), which places the tens tile
 * in the high field cell and the units tile in the low field cell one column earlier.
 *
 *   - Tens digit NON-ZERO: stamp both digit tiles as-is (tens into the high cell, units
 *     into the low cell).
 *   - Tens digit ZERO: suppress the leading digit. The high cell gets a blank tile (0x10)
 *     instead of a "0", and the units digit is shifted into the 0x70-based tile row
 *     (0x70 + units) before being stamped. This arm additionally latches the background
 *     music command (SND_BGM = 3) and paints a fixed 0x70 tile into two more field cells
 *     (0x7486, 0x74A6) — the extra furniture that goes with a suppressed leading digit.
 *
 * A JOIN reached by fallthrough and by a jump from the task that builds the two-digit
 * board readout; the digit byte arrives in a register from that caller. On the fallthrough
 * path that caller is stepBonusDisplayDown, which has just stored the same byte into BONUS_DISPLAY
 * (0x638C) — so this is the routine that puts the on-screen bonus readout on screen.
 *
 * ★ THE PACKED-BCD NIBBLE LAYOUT IS NOW OBSERVED — caveat discharged. Pass 12 could only call the
 * one-BCD-digit-per-nibble reading of the incoming byte CODE-DERIVED (from the nibble split below).
 * Pass 13 measured it on the real dkong ROM under MAME 0.288 (scratchpad/pass13-grounding.md §3a)
 * by pairing BONUS_DISPLAY against the separately-[seen] BINARY counter BONUS (0x62B1) frame by
 * frame: over 99,367 comparable frames spanning BONUS 0..80, BONUS_DISPLAY == BCD(BONUS) with ZERO
 * mismatches, the low nibble never exceeded 9, and the BCD BORROW is directly visible in the
 * natural transition log (0x50 -> 0x49 and 0x40 -> 0x39 while the quantity drops by exactly 1 — a
 * raw byte falling by 7 for a decrement of one, which a binary counter cannot do). HONEST FLOOR:
 * that confirms the encoding over the whole REACHABLE range, not over all 256 byte values. A nibble
 * of 0xA-0xF is UNREACHABLE rather than merely unobserved, because the ROM clamps BONUS_START to 80
 * so the display can never exceed 0x80 on any reachable path — an argument from the clamp, not an
 * observation of every input. The exhaustive 256-value gate below is what pins this routine's
 * behaviour on the unreachable values.
 *
 * NAME (promoted from loc_066a, DK understanding pass 13 — independent proposer ≠ confirmer,
 * confidence HIGH). Corroboration from OUTSIDE this routine:
 *   - BONUS_DISPLAY (0x638C, [seen]) says in its own registry entry that it is "rendered by
 *     loc_066a", and mechanisms.md §6 says the same — two documents naming this address as the
 *     bonus readout's renderer.
 *   - The still-frozen caller pins the input: loc_062a reaches this address on exactly two paths
 *     and BOTH load A from BONUS_DISPLAY first (the re-seed fall-through at ROM 0x0667, and
 *     stepBonusDisplayDown's tail jump at ROM 0x06B5, which has just stored the byte). A raw-ROM
 *     operand scan finds no third entry, so the byte rendered here is ALWAYS BONUS_DISPLAY.
 *   - A genuinely independent subsystem corroborates the leading-zero arm: this routine writes
 *     SND_BGM = 3 on, and only on, the arm where the high (thousands) digit is zero, and
 *     audio/README.md — produced by the audio-hardware work — lists tune 0x03 as `out_of_time`,
 *     "bonus timer's high digit hits 0". That row is tagged INFERRED there, so it is corroboration,
 *     not proof.
 *   - Its shared stamp tail stampTwoDigitField (ROM 0x0689) is already English-named.
 * WHAT THE NAME DOES NOT CLAIM: not that this routine changes the bonus — it only SHOWS it, and
 * writes no work RAM at all beyond the SND_BGM latch (the decrement is stepBonusDisplayDown's); and
 * not a pixel-verified screen position for the field — pass 13 ran with -video none and makes no
 * pixel claim, so "on-screen field" rests on the video-RAM addresses and the caller chain.
 *
 * Memory-equivalent to the frozen oracle — equivalence-066a.test.js.
 * GATE:     exhaustive — the memory effect is a pure function of the incoming digit byte
 *           (the routine reads no work RAM), so sweeping all 256 byte values on a real
 *           captured base is a proof covering BOTH arms; attract only reaches the tens-nonzero
 *           arm, so the sweep is what covers the leading-zero-suppress arm. Backed by real
 *           captured 0x066A dispatches. Whole-RAM diff (neither side writes the stack — the
 *           oracle's tail only pops, so there is no dissolved push to exclude). Teeth: a
 *           dropped SND_BGM latch, a swapped digit pair, and a wrong units-tile offset.
 * LIVE-OUT: memory-only — SND_BGM plus the field's video cells. The digit byte arrives in a
 *           register (a still-translated caller marshals it — an oracle boundary), and no
 *           caller reads a register back, so the residual registers/flags are dead.
 * NAMES:    SND_BGM (0x6089) from ram.js; BONUS_DISPLAY (0x638C) is named in ram.js and is
 *           the cell the incoming digit byte comes from, but this routine never touches it
 *           (the byte arrives in a register), so nothing is imported for it. The field cells
 *           0x7486/0x74A6 (and the tail's 0x74E6/0x74C6) are video RAM, which ram.js does not
 *           name, so they stay hex.
 */

import { SND_BGM } from "./ram.js";
import { stampTwoDigitField } from "./stampTwoDigitField.js"; // ROM 0x0689 — the shared two-cell stamp tail

export function renderBonusDisplay(m) {
  const { regs, mem } = m;

  // Split the incoming packed byte into its two BCD digits.
  const digitByte = regs.a;
  const unitsDigit = digitByte & 0x0f;
  const tensDigit = (digitByte >> 4) & 0x0f;

  if (tensDigit !== 0) {
    // Leading digit present — stamp both digit tiles unchanged.
    regs.a = tensDigit;
    regs.b = unitsDigit;
    stampTwoDigitField(m);
    return;
  }

  // Leading digit is zero — suppress it. Latch the background-music command and paint the
  // two fixed field tiles, then stamp a blank high tile with the units digit shifted into
  // the 0x70 tile row.
  mem.write8(SND_BGM, 0x03);
  mem.write8(0x7486, 0x70); // video RAM — field cell, fixed 0x70 tile
  mem.write8(0x74a6, 0x70); // video RAM — field cell, fixed 0x70 tile

  regs.a = 0x10;                 // blank tile for the suppressed leading digit
  regs.b = 0x70 + unitsDigit;    // units digit shifted into the 0x70 tile row
  stampTwoDigitField(m);
}
