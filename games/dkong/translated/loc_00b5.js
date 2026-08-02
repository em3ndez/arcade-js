// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_00b5  (ROM 0x00B5–0x00DF) — loc_00b5 through the epilogue.
 *
 * Decrementing 0x601A is what releases the main loop, which spins comparing
 * it against 0x6383.
 */
export function loc_00b5(m) {
  const { regs, mem } = m;

  regs.hl = 0x601a;
  m.tick(10);
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl))); // dec (hl)
  m.tick(11);

  m.push16(0x00bc);
  m.tick(17);
  m.call(0x0057);

  m.push16(0x00bf);
  m.tick(17);
  m.call(0x017b);

  m.push16(0x00c2);
  m.tick(17);
  m.call(0x00e0);

  // Push the epilogue address so the dispatched state handler's `ret` lands
  // on 0x00D2. This is the pattern that bounds the inline jump table exactly.
  regs.hl = 0x00d2;
  m.tick(10);
  m.push16(regs.hl);
  m.tick(11);
  regs.a = mem.read8(0x6005);
  m.tick(13);
  m.push16(0x00ca); // rst 0x28 pushes its return address = the table base
  m.tick(11);
  m.call(0x0028);

  // loc_00d2 -- epilogue
  regs.iy = m.pop16();
  m.tick(14);
  regs.ix = m.pop16();
  m.tick(14);
  regs.hl = m.pop16();
  m.tick(10);
  regs.de = m.pop16();
  m.tick(10);
  regs.bc = m.pop16();
  m.tick(10);
  regs.a = 0x01;
  m.tick(7);
  mem.write8(0x7d84, regs.a, 10); // re-enable the NMI mask
  m.tick(13);
  regs.af = m.pop16();
  m.tick(10);
  // Was `m.pop16(); m.tick(10)`, which charged the cycles correctly but used
  // tick() and so discarded the PC. Safe -- tick() clears pcKnown, and
  // fireNmi refuses to push an unknown PC rather than guessing -- but it left
  // the machine unable to accept an NMI until the interrupted code's next
  // step(), for no reason. The popped value IS the return address.
  m.ret();
}
