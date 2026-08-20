// SPDX-License-Identifier: GPL-3.0-only

// loc_3757  (ROM 0x3757-0x3774) -- advance the actor's X position (ix+5) by its signed step (ix+0x0a).
// If the current X is below the negated step, decrement the lap/column counter (ix+6). Adds the step,
// stores it back, then dispatches on the level byte (0x8901): <3 tail-jp 0x362d, else fall through
// into loc_3775.
export function loc_3757(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x0a) & 0xffff);   m.step(0x375a, 19);
  regs.neg();                                      m.step(0x375c, 8);
  regs.b = regs.a;                                 m.step(0x375d, 4);
  regs.a = mem.read8((regs.ix + 0x05) & 0xffff);   m.step(0x3760, 19);
  regs.cp(regs.b);                                 m.step(0x3761, 4);
  if (regs.fNC) {
    m.step(0x3766, 12);                            // jr nc -- (ix+5) >= -(ix+0x0a)
  } else {
    m.step(0x3763, 7);
    regs.decMem8(mem, (regs.ix + 0x06) & 0xffff);  m.step(0x3766, 23);
  }
  regs.add(mem.read8((regs.ix + 0x0a) & 0xffff));  m.step(0x3769, 19);
  mem.write8((regs.ix + 0x05) & 0xffff, regs.a);   m.step(0x376c, 19);
  regs.b = regs.a;                                 m.step(0x376d, 4);
  regs.a = mem.read8(0x8901);                      m.step(0x3770, 13);
  regs.cp(0x03);                                   m.step(0x3772, 7);
  if (regs.fC) {
    m.step(0x362d, 10);                            // jp c,0x362d (tail)
    return m.call(0x362d);
  }
  m.step(0x3775, 10);                              // fall through into loc_3775
  return m.call(0x3775);
}
