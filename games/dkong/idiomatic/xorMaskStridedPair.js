// SPDX-License-Identifier: GPL-3.0-only
/**
 * xorMaskStridedPair — XOR the 8-bit mask C into two bytes at HL, stride DE.  ROM 0x3096.
 *
 * A tiny read-modify-write primitive that toggles bits in a PAIR of bytes:
 * `mem[HL] ^= C; mem[HL + DE] ^= C`. Each byte is read, the mask C is XOR-ed into
 * it, and the result written back. The count is fixed at two (`ld b,2` / `djnz`),
 * so this is the two-element XOR sibling of addStrided (0x003d), which does the
 * same strided read-modify-write walk with `add` and a caller-chosen count.
 *
 * THREE LIVE-INS, all caller-supplied: HL (the first byte), C (the XOR mask), and
 * DE (the stride between the two bytes). DE is never set here — its value (0x0004
 * in practice) survives as a side effect of loc_0038's `ld de,0x0004` up the one
 * call chain: sub_306f does `rst 0x38` before both `call 0x3096` sites, and nothing
 * between them writes DE. The `xor (hl)` is a genuine read-modify-write — it toggles
 * the EXISTING byte's bits, so it is NOT a plain store of C.
 *
 * Sole caller: sub_306f, twice (HL = 0x6909 then 0x691d, C = 0x81, DE = 4 — toggling
 * bit 7 and bit 0 of two stride-4 fields inside the 0x6908 sprite-object block).
 * A leaf: it calls nothing.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3096.test.js.
 * GATE:     crafted-entry — attract never dispatches 0x3096 (it is unwired, reached
 *           only via sub_306f, whose body fires 1-in-8 and sits in the untranslated
 *           1977 subtree; measured 0 dispatches over 2000 attract frames). Validated
 *           on crafted entries built from REAL captured RAM snapshots (hooked at the
 *           sibling 0x003d during board setup, so the 0x6908 sprite block is live)
 *           with the three live-ins poked to the sole caller's values (HL=0x6909 /
 *           0x691d, C=0x81, DE=4) plus edges: XOR-identity C=0, toggle-all C=0xff,
 *           stride 1, and larger strides in other work-RAM regions. Teeth: a
 *           wrong-stride twin AND a store-instead-of-XOR twin (proving the RMW is
 *           load-bearing).
 * LIVE-OUT: memory-only — the two toggled bytes. The sole caller (sub_306f) overwrites
 *           HL with an `ld hl,…` immediately after each of the two calls, overwrites A
 *           with a later `call 0x0057`, and reads neither B (the oracle leaves it 0) nor
 *           any flag before overwriting it — so A, B, HL and the final `add hl,de`
 *           carry are all dead. This routine therefore leaves the register file alone;
 *           the harness supplies the `ret` to line pc/SP up with the oracle.
 * NAMES:    none — HL/C/DE and the two target bytes are caller-supplied; the routine
 *           references no fixed game RAM address.
 */
export function xorMaskStridedPair(m) {
  const { regs, mem } = m;

  const mask = regs.c; // C — the XOR mask, reloaded each pass in the ROM, never modified
  const stride = regs.de; // DE — bytes between the two targets (0x0004 in practice)

  let ptr = regs.hl;
  for (let i = 0; i < 2; i++) {
    // `ld a,c / xor (hl) / ld (hl),a` — RMW toggle of the existing byte, not a store.
    mem.write8(ptr, mem.read8(ptr) ^ mask);
    ptr = (ptr + stride) & 0xffff; // add hl,de — 16-bit wrap
  }
}
