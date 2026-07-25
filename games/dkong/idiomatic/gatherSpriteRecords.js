// SPDX-License-Identifier: GPL-3.0-only
/**
 * gatherSpriteRecords — build a run of hardware sprite records by gathering four
 * permuted fields out of each object record.  ROM 0x11d3.
 *
 * For each of B object records — the first based at IX, the next DE bytes on, and so
 * on — this reads four fixed source offsets and stores them into four CONSECUTIVE
 * destination bytes at HL, i.e. it lays down one 4-byte hardware sprite record per
 * object. The source offsets are +3, +7, +8, +5, IN THAT ORDER: a PERMUTING GATHER,
 * not a block copy (+5 is read AFTER +7/+8, and +4/+6 are never read). Read against
 * the sprite record's byte layout — +0 X, +1 code, +2 attr, +3 Y (see
 * MARIO_SPRITE_RECORD) — the gather fills X ← obj+3, code ← obj+7, attr ← obj+8,
 * Y ← obj+5.
 *
 * Everything is caller-supplied; nothing is initialised here: B = record count,
 * HL = destination, IX = source base, DE = the per-record source stride. All five
 * call sites (loc_101f, loc_1087, loc_1131, sub_1186, sub_11a6 — the board-setup
 * family) point HL inside SPRITE_BUFFER (0x6900–0x6A7F) — 0x6950/0x6958/0x6980/
 * 0x69B8/0x6A18 — and IX at an object-record array with stride 0x10 or 0x20. That all
 * five destinations land in the sprite buffer is the evidence for the name; what the
 * four gathered fields individually mean is described but not independently proven.
 *
 * The destination advances with `inc l` (8-bit), NOT `inc hl`: H is never touched, so
 * L wraps within its page (masked to 8 bits below). B == 0 would gather 256 records;
 * no call site does, but the do-while mirrors that anyway.
 *
 * Memory-equivalent to the frozen oracle — equivalence-11d3.test.js.
 * GATE:     crafted-entry — real captured dispatches (25m attract board build:
 *           B=2, DE=0x10, HL=0x6A18) + crafted entries for the arms attract never
 *           reaches: the other counts/strides (B=6/0x0A, DE=0x20), arbitrary source
 *           content, and the L-wrap and B==0 (256-pass) edges. Not exhaustive — the
 *           input is memory contents × B × DE × HL. Teeth: a NON-permuting twin
 *           (+3,+4,+5,+6). Reached from 5 board-setup sites; attract hits one.
 * LIVE-OUT: memory (the 4·B gathered bytes) + registers A/B/HL/IX. Every one of the
 *           five call sites overwrites HL or `ret`s without reading A/B/HL/IX/DE or
 *           any flag, so all are DEAD there; A/B/HL/IX are reproduced faithfully anyway
 *           — they are cheap plain arithmetic (no flag modelling) and three sites
 *           tail-return into callers not exhaustively traced, so keeping them is a free
 *           safety margin (matching addStrided) and gives the gate more teeth. DE is
 *           read-only. FLAGS dropped as dead: the final `add ix,de` carry the oracle
 *           tracks does propagate up through the rets, but it is overwritten (at a later
 *           `add a,c`) before any reader consumes it.
 * NAMES:    none imported — HL/IX/DE/B are all caller-supplied, so the routine
 *           references no fixed RAM address. The IX field offsets +3/+7/+8/+5 stay hex
 *           (object-record slots; the field semantics are not established). Its
 *           destinations fall in SPRITE_BUFFER (0x6900–0x6A7F), the evidence for the name.
 */
export function gatherSpriteRecords(m) {
  const { regs, mem } = m;

  const stride = regs.de; // DE — bytes between successive object records (read-only)
  // do-while: `djnz` decrements B then tests, so B == 0 means 256 records, not zero.
  const count = regs.b === 0 ? 256 : regs.b;

  const hi = regs.h << 8; // H is fixed for the whole routine; only L moves
  let l = regs.l; // destination low byte, advanced by `inc l` (wraps in-page)
  let ix = regs.ix; // source base, advanced by DE each record
  let a = 0; // tracks A = the last byte written

  for (let i = 0; i < count; i++) {
    // Permuting gather: +3, +7, +8, +5 IN THIS ORDER into four consecutive dest bytes.
    for (const disp of [0x03, 0x07, 0x08, 0x05]) {
      a = mem.read8((ix + disp) & 0xffff); // ld a,(ix+disp)
      mem.write8(hi | l, a); // ld (hl),a
      l = (l + 1) & 0xff; // inc l — 8-bit, wraps within the page
    }
    ix = (ix + stride) & 0xffff; // add ix,de
  }

  // Live-out registers, faithful to the oracle (dead at every traced call site):
  // A = the last byte written (the final record's obj+5), B counted down to 0, HL
  // advanced by 4·count within its page, IX advanced by count·DE.
  regs.a = a;
  regs.l = l; // H untouched, so regs.hl reflects the advanced pointer
  regs.ix = ix;
  regs.b = 0;
}
