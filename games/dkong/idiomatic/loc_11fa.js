// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_11fa — scatter a 6-byte source record into a fixed IX record + a 4-byte array.  ROM 0x11FA.
 *
 * A straight-line struct initialiser (28 instructions, no branches, no calls). It
 * reads SIX consecutive bytes from a caller-supplied source pointer (HL, a live-in
 * parameter — never set here) and stamps them into two ROM-hardcoded destinations:
 *
 *   - A scattered-field record at IX = 0x66A0. Its +0x00 field is set to the
 *     constant 0x01 (a tag); the six source bytes then land at the fields
 *     +0x03, +0x07, +0x08, +0x05, +0x09, +0x0A — the ROM's exact field order, in
 *     which +0x05 is written AFTER +0x08. All seven target addresses are distinct,
 *     so the scramble is invisible in FINAL memory (order only matters to a write
 *     trace, which this memory-equivalence gate does not check). Reproduced in ROM
 *     order anyway, for faithfulness.
 *   - A 4-byte contiguous array at DE = 0x6A28, holding the FIRST FOUR source bytes
 *     only (bytes 4 and 5 are not mirrored here). This span sits INSIDE the sprite
 *     shadow buffer (SPRITE_BUFFER 0x6900-0x6A7F), so it is likely a sprite record,
 *     but that is not proven and does not drive the name.
 *
 * Two call sites (both board/sprite setup): 0x0FF2 in loc_0fd7 (HL=0x3DF4) and
 * 0x104C in loc_101f (HL=0x3DFA) — stride-6 ROM templates. The MEANING of the
 * record fields is NOT established (the oracle: "nobody has read those bytes";
 * whether +0x01/+0x02/+0x04/+0x06 are padding, written elsewhere, or unused is
 * open), so the routine keeps its neutral loc_ name.
 *
 * Memory-equivalent to the frozen oracle — equivalence-11fa.test.js.
 * GATE:     crafted-entry — 2 real captured attract dispatches (loc_0fd7, HL=0x3DF4)
 *           + crafted entries for the unreached loc_101f source (HL=0x3DFA, whose
 *           byte 4 is non-zero so the +0x09 field is really exercised) and a
 *           six-distinct-byte pattern that pins every scattered field independently.
 *           Teeth: a +0x05/+0x08 field swap and a wrong constant tag, both caught.
 * LIVE-OUT: memory-only. Both callers reload HL and DE immediately after the call
 *           (loc_0fd7 @0x0FF8, loc_101f @0x1052) and never read A/IX/flags, so the
 *           oracle's residual registers are dead ABI; the whole-machine gate backstops
 *           that. The oracle touches the stack only via its final `ret` (a pop, no
 *           write), so pc/SP carry no residue — the harness supplies the matching ret.
 * NAMES:    none from names.js — 0x66A0 (scattered-field record base, IX) and 0x6A28
 *           (4-byte array base, DE) are ROM-hardcoded engine scratch, not named
 *           memory; kept hex. 0x6A28 lies within SPRITE_BUFFER (noted, not asserted).
 */
export function loc_11fa(m) {
  const { regs, mem } = m;

  // Both destinations are ROM-hardcoded (ld ix,0x66a0 / ld de,0x6a28) — never
  // derived from the input.
  const REC = 0x66a0; // IX: scattered-field record
  const ARR = 0x6a28; // DE: 4-byte contiguous array (inside the sprite shadow buffer)

  // HL is the caller's live-in source pointer; read six consecutive bytes.
  const src = regs.hl;
  const b0 = mem.read8((src + 0) & 0xffff);
  const b1 = mem.read8((src + 1) & 0xffff);
  const b2 = mem.read8((src + 2) & 0xffff);
  const b3 = mem.read8((src + 3) & 0xffff);
  const b4 = mem.read8((src + 4) & 0xffff);
  const b5 = mem.read8((src + 5) & 0xffff);

  // Record: a constant tag at +0x00, then the six bytes scattered into the ROM's
  // field order (+0x05 lands after +0x08 — distinct addresses, so final memory is
  // order-independent).
  mem.write8(REC + 0x00, 0x01);
  mem.write8(REC + 0x03, b0);
  mem.write8(REC + 0x07, b1);
  mem.write8(REC + 0x08, b2);
  mem.write8(REC + 0x05, b3);
  mem.write8(REC + 0x09, b4);
  mem.write8(REC + 0x0a, b5);

  // Array: the FIRST FOUR source bytes only (b4/b5 are not mirrored here).
  mem.write8(ARR + 0, b0);
  mem.write8(ARR + 1, b1);
  mem.write8(ARR + 2, b2);
  mem.write8(ARR + 3, b3);
}
