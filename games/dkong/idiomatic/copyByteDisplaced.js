// SPDX-License-Identifier: GPL-3.0-only
/**
 * copyByteDisplaced — copy one byte from an indexed cell to a displaced cell.  ROM 0x3064.
 *
 * A generic addressing primitive, five instructions:
 *
 *   3064  09   add hl,bc     ; source  = HL + BC
 *   3065  7e   ld  a,(hl)    ; read the byte at the source
 *   3066  19   add hl,de     ; dest    = source + DE
 *   3067  77   ld  (hl),a    ; write it to the destination
 *   3068  c9   ret
 *
 * Three live-in registers: a base pointer HL, a source index BC, and a signed
 * displacement DE. It reads the byte at HL+BC and stores an identical copy at
 * HL+BC+DE — the destination is the source plus DE. Both adds are 16-bit and WRAP.
 * It writes memory and reads nothing but its three registers; it calls nothing.
 *
 * Its sole caller is sub_304a (ROM 0x304A, still the frozen oracle — not yet
 * decompiled), which invokes it twice per pass to slide two tilemap cells one row
 * up in video RAM: HL = 0x7600 then 0x75C0, BC = the effect index at 0x638E, and
 * DE = 0xFFE0 (= −0x20 = one 32-column tilemap row), so dest = source − one row.
 * Every real dispatch lands wholly inside video RAM (0x75Ax–0x76xx). The routine
 * itself is row-agnostic, though — DE is any displacement — so it is named for the
 * addressing mechanism it performs, not for that caller-specific screen effect.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3064.test.js.
 * GATE:     crafted-entry — real dispatch states captured by running the sole
 *           caller sub_304a (translated) on a realistic booted machine (a loc_0fd7
 *           attract snapshot, effect index 0x638E seeded across values), which
 *           reproduces the exact (HL,BC,DE,SP,video-RAM) the routine meets in play;
 *           plus crafted edge arms (forward/large DE, HL+BC and dest 16-bit wraps,
 *           DE=0 self-copy, a work-RAM target). NOT reached in plain attract (0×) —
 *           it runs only inside the game-state cascade that drives sub_304a. Not
 *           exhaustive: the input is 16-bit HL×BC×DE × memory contents. Teeth: a
 *           displacement-dropping twin, forced non-vacuous with sentinel bytes.
 * LIVE-OUT: memory-only — the single byte written at HL+BC+DE. The oracle also
 *           leaves HL = HL+BC+DE, A = the copied byte, and F (carry from add hl,de),
 *           but all three are DEAD: the sole caller sub_304a overwrites HL (`ld hl,…`)
 *           and A before reading either and never branches on F. BC and DE are
 *           read-only (the routine never writes them — which is why sub_304a can
 *           reuse them across its second call); they pass through unchanged on both
 *           sides, so they need no restatement here.
 * NAMES:    none — HL/BC/DE and the target bytes are all caller-supplied; the routine
 *           references no fixed game RAM address (0x638E belongs to sub_304a).
 */
export function copyByteDisplaced(m) {
  const { regs, mem } = m;

  // source = base + index (16-bit wrap); dest = source + displacement (16-bit wrap).
  const src = (regs.hl + regs.bc) & 0xffff; // add hl,bc
  const dst = (src + regs.de) & 0xffff; // add hl,de
  mem.write8(dst, mem.read8(src)); // ld a,(hl) then ld (hl),a — copy the byte across

  // No register write-back: HL/A/F are dead at the only call site, so the idiomatic
  // routine returns memory-only. (See LIVE-OUT above; the oracle's residual register
  // churn is dead ABI the memory-equivalence gate confirms it need not reproduce.)
}
