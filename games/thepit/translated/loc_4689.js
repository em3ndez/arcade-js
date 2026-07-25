// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4689  (ROM 0x4689-0x46A1) — conditional BCD score-add: when the state byte
 * (0x8001)-1 is < 2 (i.e. 0x8001 is 1 or 2) it adds BC (packed BCD) into the
 * 2-byte BCD counter at 0x8031 (low) / 0x8034 (high) with DAA carry propagation,
 * then TAIL-JUMPS to loc_46af; otherwise it returns immediately (score untouched)
 * via the bare `ret` at 0x4672.
 *
 *   4689  3a 01 80     ld   a,(0x8001)
 *   468c  3d           dec  a
 *   468d  fe 02        cp   0x02
 *   468f  30 e1        jr   nc,0x4672     ; -> bare ret at loc_4672: return to caller
 *   4691  3a 31 80     ld   a,(0x8031)
 *   4694  81           add  a,c
 *   4695  27           daa
 *   4696  32 31 80     ld   (0x8031),a
 *   4699  3a 34 80     ld   a,(0x8034)
 *   469c  88           adc  a,b
 *   469d  27           daa
 *   469e  32 34 80     ld   (0x8034),a
 *   46a1  18 0c        jr   0x46af        ; TAIL into loc_46af
 *
 * Two exits, both transfers of control: `jr nc,0x4672` lands on a single `ret`
 * (loc_4672) so it is a conditional return to loc_4689's OWN caller; the closing
 * `jr 0x46af` is an unconditional tail-jump, so loc_46af's eventual `ret` returns
 * to whoever called loc_4689.
 */
export function loc_4689(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8001);
  m.step(0x468c, 13); // 4689  ld a,(0x8001)

  regs.a = regs.dec8(regs.a);
  m.step(0x468d, 4); // 468c  dec a

  regs.cp(0x02);
  m.step(0x468f, 7); // 468d  cp 0x02

  // 468f  jr nc,0x4672 -- carry clear ((0x8001)-1 >= 2) jumps to the bare ret at
  // 0x4672 and returns to loc_4689's caller with the score left untouched.
  if (regs.fNC) {
    m.step(0x4672, 12); // jr nc taken -> lands on ret at 0x4672
    m.ret(); //          4672  ret (10 T) -- return to caller
    return;
  }
  m.step(0x4691, 7); // jr nc NOT taken -> fall through to the score add

  regs.a = mem.read8(0x8031);
  m.step(0x4694, 13); // 4691  ld a,(0x8031)

  regs.add(regs.c);
  m.step(0x4695, 4); // 4694  add a,c

  regs.daa();
  m.step(0x4696, 4); // 4695  daa

  mem.write8(0x8031, regs.a);
  m.step(0x4699, 13); // 4696  ld (0x8031),a

  regs.a = mem.read8(0x8034);
  m.step(0x469c, 13); // 4699  ld a,(0x8034)

  regs.adc(regs.b);
  m.step(0x469d, 4); // 469c  adc a,b

  regs.daa();
  m.step(0x469e, 4); // 469d  daa

  mem.write8(0x8034, regs.a);
  m.step(0x46a1, 13); // 469e  ld (0x8034),a

  m.step(0x46af, 12); // 46a1  jr 0x46af -- TAIL into loc_46af
  return m.call(0x46af);
}
