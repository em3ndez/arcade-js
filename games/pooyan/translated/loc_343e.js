// SPDX-License-Identifier: GPL-3.0-only

// loc_343e  (ROM 0x343e-0x34af) -- object X-movement handler (m.call target from loc_4221).
// Advances (ix+0x05) by the per-frame delta (ix+0x09), carries into the tile column (ix+0x06),
// and when the masked column reaches the limit at 0x8d4b either starts the turn animation
// (jp loc_381e), re-arms the row via rst 0x20 (0x3418 table) writing the 0x86e3 sprite band,
// or falls through into the shared movement tail loc_34b0. Interior 0x3473-0x34af is mirrored
// by loc_3473 (a second entry point into the same ROM span).
export function loc_343e(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x05) & 0xffff);   m.step(0x3441, 19);
  regs.add(mem.read8((regs.ix + 0x09) & 0xffff));  m.step(0x3444, 19);
  if (regs.fNC) {
    m.step(0x3449, 12);                            // jr nc,0x3449
  } else {
    m.step(0x3446, 7);
    regs.incMem8(mem, (regs.ix + 0x06) & 0xffff);  m.step(0x3449, 23); // inc (ix+0x06)
  }
  mem.write8((regs.ix + 0x05) & 0xffff, regs.a);   m.step(0x344c, 19);
  regs.b = regs.a;                                 m.step(0x344d, 4);
  regs.a = mem.read8(0x8d4b);                      m.step(0x3450, 13);
  regs.c = regs.a;                                 m.step(0x3451, 4);
  regs.a = mem.read8((regs.ix + 0x06) & 0xffff);   m.step(0x3454, 19);
  regs.and(0x1f);                                  m.step(0x3456, 7);
  regs.cp(regs.c);                                 m.step(0x3457, 4);
  if (regs.fC) { return m.ret(11); }               // ret c
  m.step(0x3458, 5);

  if (regs.fZ) {
    m.step(0x3464, 12);                            // jr z,0x3464
    regs.and(regs.a);                              m.step(0x3465, 4);
    if (regs.fZ) { m.step(0x34b0, 10); return m.call(0x34b0); } // jp z,0x34b0 (TAIL)
    m.step(0x3468, 10);
    regs.a = mem.read8(0x880a);                    m.step(0x346b, 13);
    regs.cp(0x04);                                 m.step(0x346d, 7);
    if (regs.fNZ) { return m.ret(11); }            // ret nz
    m.step(0x346e, 5);
    regs.a = mem.read8((regs.ix + 0x09) & 0xffff); m.step(0x3471, 19);
    regs.cp(regs.b);                               m.step(0x3472, 4);
    if (regs.fC) { return m.ret(11); }             // ret c
    m.step(0x3473, 5);
    // falls through into the shared 0x3473 block below
  } else {
    m.step(0x345a, 7);                             // jr z not taken
    mem.write8((regs.ix + 0x08) & 0xffff, 0x01);   m.step(0x345e, 19);
    regs.de = 0x3838;                              m.step(0x3461, 10);
    m.step(0x381e, 10); return m.call(0x381e);     // jp 0x381e (TAIL)
  }

  // loc_3473: gate on 0x8f63; if already armed just latch (ix+0x01) and ret
  regs.a = mem.read8(0x8f63);                       m.step(0x3476, 13);
  regs.and(regs.a);                                 m.step(0x3477, 4);
  if (regs.fZ) {
    m.step(0x347f, 10);                             // jp z,0x347f (internal)
  } else {
    m.step(0x347a, 10);
    mem.write8((regs.ix + 0x01) & 0xffff, 0x01);    m.step(0x347e, 19);
    return m.ret(10);                               // ret
  }

  // loc_347f: bump the animation phase (0x8d43, capped at 0x07), re-arm the sprite row
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
