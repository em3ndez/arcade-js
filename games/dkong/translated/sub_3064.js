// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_3064  (ROM 0x3064–0x3068) — 5 bytes, 5 instructions.
 *
 *   3064  09           add  hl,bc
 *   3065  7e           ld   a,(hl)
 *   3066  19           add  hl,de
 *   3067  77           ld   (hl),a
 *   3068  c9           ret
 *
 * Copies one byte from (HL+BC) to (HL+BC+DE). Three live-ins: HL, BC, DE.
 * Both `add hl,rr` write H/N/C (regs.addHl); the final carry escapes to the
 * caller. Not yet wired into the live dispatcher.
 */
export function sub_3064(m) {
  const { regs, mem } = m;

  regs.addHl(regs.bc);
  m.step(0x3065, 11); // add hl,bc
  regs.a = mem.read8(regs.hl);
  m.step(0x3066, 7); // ld a,(hl)
  regs.addHl(regs.de);
  m.step(0x3067, 11); // add hl,de
  mem.write8(regs.hl, regs.a);
  m.step(0x3068, 7); // ld (hl),a

  m.ret(); // 3068
}
