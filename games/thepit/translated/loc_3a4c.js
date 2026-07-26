// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_3a4c  (ROM 0x3a4c-0x3a6e) — builds two 4-byte destination records at
 * 0x8238 and 0x823c from the two 3-byte source records at 0x810a and 0x811b.
 *
 * Each half copies THREE bytes verbatim (ldir) then appends a FOURTH byte that
 * is the source's 4th byte (source+3, where HL is left pointing after the copy)
 * BIASED by the value at 0x8051: dest[3] = source[3] + (0x8051). The common
 * bias is loaded once into B; the `ld a,b` / `ld b,a` pair carries it across the
 * `ld bc,0x0003` that clobbers B to set up the second ldir counter. Reached by
 * loc_3a13 (its `jp z` and fall-through), so this routine's `ret` returns to
 * loc_3a13's OWN caller.
 *
 *   3a4c  11 38 82     ld   de,0x8238       ; dest record 1
 *   3a4f  21 0a 81     ld   hl,0x810a       ; source record 1
 *   3a52  01 03 00     ld   bc,0x0003
 *   3a55  ed b0        ldir                 ; 0x810a..0x810c -> 0x8238..0x823a
 *   3a57  3a 51 80     ld   a,(0x8051)      ; the shared bias
 *   3a5a  47           ld   b,a             ; B = bias
 *   3a5b  7e           ld   a,(hl)          ; A = source1[3] (HL = 0x810d)
 *   3a5c  80           add  a,b             ; A = source1[3] + bias
 *   3a5d  12           ld   (de),a          ; -> dest1[3] (DE = 0x823b)
 *   3a5e  78           ld   a,b             ; stash bias in A (ld bc below clobbers B)
 *   3a5f  11 3c 82     ld   de,0x823c       ; dest record 2
 *   3a62  21 1b 81     ld   hl,0x811b       ; source record 2
 *   3a65  01 03 00     ld   bc,0x0003
 *   3a68  ed b0        ldir                 ; 0x811b..0x811d -> 0x823c..0x823e
 *   3a6a  47           ld   b,a             ; restore bias into B
 *   3a6b  7e           ld   a,(hl)          ; A = source2[3] (HL = 0x811e)
 *   3a6c  80           add  a,b             ; A = source2[3] + bias
 *   3a6d  12           ld   (de),a          ; -> dest2[3] (DE = 0x823f)
 *   3a6e  c9           ret
 */
export function loc_3a4c(m) {
  const { regs, mem } = m;

  // -- record 1: 0x810a -> 0x8238 (3 bytes) + biased 4th byte -------------------
  regs.de = 0x8238;
  m.step(0x3a4f, 10); // 3a4c  ld de,0x8238

  regs.hl = 0x810a;
  m.step(0x3a52, 10); // 3a4f  ld hl,0x810a

  regs.bc = 0x0003;
  m.step(0x3a55, 10); // 3a52  ld bc,0x0003 -- PC now at the ldir

  m.ldirAt(0x3a55, 0x3a57); // 3a55  ldir -- 3 bytes; leaves HL=0x810d, DE=0x823b, BC=0

  regs.a = mem.read8(0x8051);
  m.step(0x3a5a, 13); // 3a57  ld a,(0x8051) -- the bias

  regs.b = regs.a;
  m.step(0x3a5b, 4); // 3a5a  ld b,a -- B = bias

  regs.a = mem.read8(regs.hl);
  m.step(0x3a5c, 7); // 3a5b  ld a,(hl) -- A = source1[3]

  regs.add(regs.b);
  m.step(0x3a5d, 4); // 3a5c  add a,b -- A = source1[3] + bias

  mem.write8(regs.de, regs.a);
  m.step(0x3a5e, 7); // 3a5d  ld (de),a -- dest1[3]

  regs.a = regs.b;
  m.step(0x3a5f, 4); // 3a5e  ld a,b -- stash bias (ld bc below clobbers B)

  // -- record 2: 0x811b -> 0x823c (3 bytes) + biased 4th byte -------------------
  regs.de = 0x823c;
  m.step(0x3a62, 10); // 3a5f  ld de,0x823c

  regs.hl = 0x811b;
  m.step(0x3a65, 10); // 3a62  ld hl,0x811b

  regs.bc = 0x0003;
  m.step(0x3a68, 10); // 3a65  ld bc,0x0003 -- PC now at the ldir

  m.ldirAt(0x3a68, 0x3a6a); // 3a68  ldir -- 3 bytes; leaves HL=0x811e, DE=0x823f, BC=0

  regs.b = regs.a;
  m.step(0x3a6b, 4); // 3a6a  ld b,a -- restore bias into B

  regs.a = mem.read8(regs.hl);
  m.step(0x3a6c, 7); // 3a6b  ld a,(hl) -- A = source2[3]

  regs.add(regs.b);
  m.step(0x3a6d, 4); // 3a6c  add a,b -- A = source2[3] + bias

  mem.write8(regs.de, regs.a);
  m.step(0x3a6e, 7); // 3a6d  ld (de),a -- dest2[3]

  m.ret(); // 3a6e  ret -- returns to loc_3a13's caller
}
