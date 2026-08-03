// SPDX-License-Identifier: GPL-3.0-only
/**
 * addStrided — add the 8-bit constant C to each of B bytes at HL, stride DE.  ROM 0x003d.
 *
 * A foundational memory primitive: it read-modify-writes B bytes starting at HL,
 * stepping the pointer by DE (the stride) between bytes, adding C into each —
 * `for k in 0..B-1: (HL + k*DE) += C` — with the add taken 8-bit so it WRAPS.
 * C is a signed byte here: the dominant caller passes C = 0xFC (−4), so that use
 * DECREMENTS each field by 4. The classic job is nudging a run of stride-4 sprite
 * fields (an X or Y column of the 0x6900 sprite buffer) by a delta during board and
 * cutscene setup.
 *
 * ONE ROUTINE, TWO WAYS IN, both funnelling through this body:
 *   - `rst 0x38` → loc_0038, which fixes DE = 4 and B = 0x0A then falls through here
 *     (the only arm attract exercises — B=0x0A, C=0xFC, DE=4, HL=0x690b, ~12×).
 *   - direct `call 0x003d` with the caller's own DE/B/C (e.g. loc_1880 B=2 C=0x28;
 *     loc_0d5f B=0x10 then 0xF8).
 * DE and C are read-only (never written), so every caller that set them up before
 * the call still has them after. A PURE LEAF otherwise: it calls nothing.
 *
 * `djnz` decrements B THEN tests, so this is a do-while (B is never checked for
 * zero up front): the body always runs at least once, and B = 0 on entry runs the
 * full 256 passes. No caller passes 0; the loop below mirrors that semantics anyway.
 *
 * Memory-equivalent to the frozen oracle — equivalence-003d.test.js.
 * GATE:     crafted-entry — real captured rst-0x38 dispatches (B=0x0A, C=0xFC,
 *           DE=4 during board setup) + crafted entries for the direct-call arms
 *           (other B/C/DE, the B=0 256-pass edge, 8-bit and 16-bit HL wrap). Not
 *           exhaustive: the input is memory contents × B × C × DE. Teeth: a
 *           wrong-stride twin. Reached from 30+ sites; attract hits only the rst arm.
 * LIVE-OUT: memory (the B bytes, each += C with 8-bit wrap) + regs A/B/HL — A = the
 *           last byte written = (C + last byte read) & 0xFF; B = 0; HL advanced by
 *           B*DE (16-bit wrap). A/B/HL are dead at every site that CONTINUES after
 *           the call (each overwrites them before reading), but ~10 sites tail-return
 *           into callers not exhaustively traced, so they are kept faithful to the
 *           oracle. FLAGS are dropped as dead: the per-byte add carries are each
 *           overwritten by the next `add hl,de`, and the final add-hl flags are
 *           consumed by no caller (for every strided fill the carry-out is 0 and no
 *           branch follows the return).
 * NAMES:    none — HL/DE/B/C and the target bytes are all caller-supplied; the
 *           routine references no fixed game RAM address.
 */
export function addStrided(m) {
  const { regs, mem } = m;

  const addend = regs.c; // C — the value added into each byte (signed: 0xFC = −4)
  const stride = regs.de; // DE — bytes between successive targets
  // do-while: `djnz` decrements then tests, so B == 0 means 256 passes, not zero.
  const count = regs.b === 0 ? 256 : regs.b;

  let ptr = regs.hl;
  let a = 0;
  for (let i = 0; i < count; i++) {
    a = (addend + mem.read8(ptr)) & 0xff; // ld a,c / add a,(hl) — 8-bit, wraps
    mem.write8(ptr, a); // ld (hl),a
    ptr = (ptr + stride) & 0xffff; // add hl,de
  }

  // Live-out register state, matching the oracle: A is the final byte written, B
  // has counted down to 0, HL is advanced past the last target.
  regs.a = a;
  regs.hl = ptr;
  regs.b = 0;
}
