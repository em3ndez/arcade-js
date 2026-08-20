// SPDX-License-Identifier: GPL-3.0-only

// loc_3473  (ROM 0x3473-0x34af) -- interior-entry mirror of loc_343e's 0x3473 block (jp'd into
// by loc_34f2). Re-emits the exact ROM span 0x3473-0x34af: gate on 0x8f63, bump the animation
// phase (0x8d43, capped at 0x07), re-arm the row via rst 0x20 (0x3418 table) writing the 0x86e3
// sprite band, then falls through into the shared movement tail loc_34b0. The frozen layer
// duplicates shared interior code across entry points (like loc_5733 mirrors loc_572b).
export function loc_3473(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8f63);                       m.step(0x3476, 13);
  regs.and(regs.a);                                 m.step(0x3477, 4);
  if (regs.fZ) {
    m.step(0x347f, 10);                             // jp z,0x347f (internal)
  } else {
    m.step(0x347a, 10);
    mem.write8((regs.ix + 0x01) & 0xffff, 0x01);    m.step(0x347e, 19);
    return m.ret(10);                               // ret
  }

  // loc_347f
  mem.write8((regs.ix + 0x01) & 0xffff, 0x00);      m.step(0x3483, 19);
  regs.hl = 0x8d43;                                 m.step(0x3486, 10);
  regs.a = mem.read8(regs.hl);                      m.step(0x3487, 7);
  regs.cp(0x07);                                    m.step(0x3489, 7);
  if (regs.fNC) { m.step(0x34b0, 12); return m.call(0x34b0); } // jr nc,0x34b0 (TAIL)
  m.step(0x348b, 7);
  regs.cp(0x0a);                                    m.step(0x348d, 7);
  if (regs.fNC) {
    m.step(0x3490, 12);                             // jr nc,0x3490 (internal)
  } else {
    m.step(0x348f, 7);
    regs.incMem8(mem, regs.hl);                     m.step(0x3490, 11); // inc (hl)
  }
  regs.a = mem.read8(regs.hl);                      m.step(0x3491, 7);
  regs.hl = 0x3418;                                 m.step(0x3494, 10);
  m.push16(0x3495); m.step(0x0020, 11); m.call(0x0020); // rst 0x20 -- A = table[0x3418+A]
  mem.write8(0x8d4b, regs.a);                       m.step(0x3498, 13);
  regs.hl = 0x86e3;                                 m.step(0x349b, 10);
  regs.de = 0x0040;                                 m.step(0x349e, 10);
  mem.write8(regs.hl, 0xd8);                        m.step(0x34a0, 10);
  regs.hl = (regs.hl + 1) & 0xffff;                 m.step(0x34a1, 6);
  mem.write8(regs.hl, 0xd9);                        m.step(0x34a3, 10);
  regs.e = 0x1f;                                    m.step(0x34a5, 7);
  regs.addHl(regs.de);                              m.step(0x34a6, 11);
  mem.write8(regs.hl, 0xda);                        m.step(0x34a8, 10);
  regs.hl = (regs.hl + 1) & 0xffff;                 m.step(0x34a9, 6);
  mem.write8(regs.hl, 0xdb);                        m.step(0x34ab, 10);
  regs.a = 0x01;                                    m.step(0x34ad, 7);
  mem.write8(0x8f63, regs.a);                       m.step(0x34b0, 13); // ld (0x8f63),a -> falls into loc_34b0
  return m.call(0x34b0);                            // fall-through (TAIL, no push16)
}
