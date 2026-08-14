// SPDX-License-Identifier: GPL-3.0-only

// loc_0670  (ROM 0x0670-0x0694) — stamp all five home-frog slot markers: call loc_0695 at each slot
// base (0xAB64/0xAAA4/0xA9E4/0xA924/0xA864), clear (0x842F), then tail-jump to loc_0a5f.
export function loc_0670(m) {
  const { regs, mem } = m;

  regs.hl = 0xab64;
  m.step(0x0673, 10);
  m.push16(0x0676);
  m.step(0x0695, 17); // call 0x0695 -- slot 1
  m.call(0x0695);

  regs.hl = 0xaaa4;
  m.step(0x0679, 10);
  m.push16(0x067c);
  m.step(0x0695, 17); // slot 2
  m.call(0x0695);

  regs.hl = 0xa9e4;
  m.step(0x067f, 10);
  m.push16(0x0682);
  m.step(0x0695, 17); // slot 3
  m.call(0x0695);

  regs.hl = 0xa924;
  m.step(0x0685, 10);
  m.push16(0x0688);
  m.step(0x0695, 17); // slot 4
  m.call(0x0695);

  regs.hl = 0xa864;
  m.step(0x068b, 10);
  m.push16(0x068e);
  m.step(0x0695, 17); // slot 5
  m.call(0x0695);

  regs.xor(regs.a);
  m.step(0x068f, 4);
  mem.write8(0x842f, regs.a);
  m.step(0x0692, 13); // (0x842f) = 0

  m.step(0x0a5f, 10); // jp 0x0a5f
  return m.call(0x0a5f);
}
