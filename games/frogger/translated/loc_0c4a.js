// SPDX-License-Identifier: GPL-3.0-only

// loc_0c4a  (ROM 0x0C4A-0x0C50) — write byte E at the row computed as (D - C): if D-C == D (i.e. C==0)
// return without writing, else L = D-C and store E at (hl). Called from loc_0c3d.
export function loc_0c4a(m) {
  const { regs, mem } = m;

  regs.a = regs.d;
  m.step(0x0c4b, 4);
  regs.sub(regs.c);
  m.step(0x0c4c, 4); // A = D - C
  regs.cp(regs.d);
  m.step(0x0c4d, 4);
  if (regs.fZ) {
    m.ret(11);
    return;
  }
  m.step(0x0c4e, 5);

  regs.l = regs.a;
  m.step(0x0c4f, 4);
  mem.write8(regs.hl, regs.e);
  m.step(0x0c50, 7); // (hl) = E
  m.ret();
}
