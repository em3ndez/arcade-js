// SPDX-License-Identifier: GPL-3.0-only

// loc_0a48  (ROM 0x0A48-0x0A5E) — render the lives/level row: draw B copies of tile 0x4C down the
// column at 0xA87E stepping +0x20, where B = min((0x83B7), 0x0F). Called from loc_0425 (0x0451).
export function loc_0a48(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x83b7);
  m.step(0x0a4b, 13);
  regs.hl = 0xa87e;
  m.step(0x0a4e, 10);
  regs.de = 0x0020;
  m.step(0x0a51, 10);
  regs.cp(0x0f);
  m.step(0x0a53, 7);
  if (regs.fC) {
    m.step(0x0a57, 12);
  } else {
    m.step(0x0a55, 7);
    regs.a = 0x0f;
    m.step(0x0a57, 7); // clamp the count to 0x0f
  }
  regs.b = regs.a;
  m.step(0x0a58, 4);
  regs.c = 0x4c;
  m.step(0x0a5a, 7); // C = tile 0x4c

  for (;;) {
    // loc_0a5a: draw one tile
    mem.write8(regs.hl, regs.c);
    m.step(0x0a5b, 7);
    regs.addHl(regs.de);
    m.step(0x0a5c, 11);
    if (m.regs.djnz() !== 0) {
      m.step(0x0a5a, 13);
      continue;
    }
    m.step(0x0a5e, 8);
    break;
  }

  m.ret();
}
