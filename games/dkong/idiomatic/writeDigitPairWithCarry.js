// SPDX-License-Identifier: GPL-3.0-only
/**
 * writeDigitPairWithCarry — stamp two digit tiles side by side, carrying a value
 * of 10 into a fixed tens cell.  ROM 0x07ad.
 *
 * A tiny tilemap digit writer. It receives a target cell in HL and two digit
 * values in DE (E = the ones/left value, D = the right value) and stamps them two
 * tilemap columns apart — columns are 2 bytes apart in this VRAM layout, so the
 * second tile lands at HL+2, not HL+1:
 *
 *   - E is written straight into the cell at HL.
 *   - D is written into the cell at HL+2, EXCEPT when D is exactly 10: a single
 *     tile can't show "10", so it is split — a ones digit 0 (D-10) goes at HL+2 and
 *     a tens digit 1 goes into the fixed carry cell 0x758E. (Tile code == digit
 *     value here: tile 0 is "0", tile 1 is "1".) For any other D the carry cell is
 *     left untouched.
 *
 * In the game this draws the DIP coins-per-credit readout: the caller loads DE from
 * DIP_COINS_FOR_1P/2P (0x6022/0x6023) and HL = 0x756C, so E = 1P-coins at 0x756C and
 * D = 2P-coins at 0x756E, with a 2P count of 10 rendered as "10" across 0x758E/0x756E.
 *
 * The tail is the load-bearing quirk: it does NOT preserve DE/HL, it OVERWRITES them
 * with DE = 0x0201, HL = 0x768C — the arguments for the SECOND pass. handler_0779
 * `call`s this routine at 0x07AA and then FALLS THROUGH into the same bytes, so the
 * routine runs twice with no loop counter; the second run reads exactly the DE/HL
 * this tail leaves behind (draws "1" at 0x768C and "2" at 0x768E — D=2, no carry).
 * That is why DE and HL are LIVE-OUT: the fall-through consumes them. A PURE LEAF
 * otherwise — it calls nothing (the oracle's terminal `ret` is dropped; the JS call
 * stack replaces it).
 *
 * Memory-equivalent to the frozen oracle — equivalence-07ad.test.js.
 * GATE:     crafted-entry; REACHED in boot/attract (handler_0779 dispatches it twice
 *           by frame 300 — the coins pass HL=0x756C and the "1 2" pass HL=0x768C).
 *           Attract only ever feeds D=2, so the D==10 tens-carry arm and the digit
 *           breadth are pinned by crafted entries (D swept incl. 10, E swept) with
 *           the target VRAM band sentinel-painted identically on both sides. Teeth =
 *           a wrong-column-stride twin (real captures) and a carry-dropping twin
 *           (crafted D==10).
 * LIVE-OUT: memory (the two digit cells at HL/HL+2, plus 0x758E on the D==10 arm)
 *           + regs DE and HL — deliberately reloaded to 0x0201 / 0x768C as the
 *           fall-through second pass's inputs. A and FLAGS are dead: the fall-through
 *           reloads A (`ld a,d`) and recomputes flags (`sub 0x0a`) before reading
 *           either, and handler_0779's own return consumes neither.
 * NAMES:    none imported — HL and DE are caller-supplied registers, not RAM names;
 *           0x758E is kept hex (the fixed VRAM tens-carry tile cell, not in names.js).
 *           DIP_COINS_FOR_1P/2P (0x6022/0x6023) are named in prose only, as the
 *           caller's source of DE — this routine never touches them directly.
 */
export function writeDigitPairWithCarry(m) {
  const { regs, mem } = m;

  // Ones/left digit at HL; the paired digit two columns along at HL+2.
  mem.write8(regs.hl, regs.e);
  const secondCell = (regs.hl + 2) & 0xffff;
  mem.write8(secondCell, regs.d);

  // A value of exactly 10 can't be one tile: split it into ones 0 (D-10) here and
  // a tens 1 in the fixed carry cell. Any other D leaves the carry cell alone.
  if (regs.d === 0x0a) {
    mem.write8(secondCell, 0x00); // ones digit  (D - 10 == 0)
    mem.write8(0x758e, 0x01); // tens digit  (0 + 1)
  }

  // Hand the SECOND pass its arguments (the fall-through re-enters these bytes and
  // reads them). Not preservation — a deliberate register hand-off.
  regs.de = 0x0201;
  regs.hl = 0x768c;
}
