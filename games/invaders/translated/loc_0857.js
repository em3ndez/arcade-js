// SPDX-License-Identifier: GPL-3.0-only
// loc_0857  (ROM 0x0857-0x086c) -- `jnz 0x0857` entry. Seeds DE=0x1aba, calls 0x08f3, then reads
// input port 1 and dispatches on two bits: bit1 -> loc_086d, bit2 -> 0x0798, else -> 0x077f.
export function loc_0857(m) {
  const { regs } = m;

  regs.de = 0x1aba; m.step(0x085a, 10); // 0857  lxi d,0x1aba
  m.push16(0x085d); m.step(0x08f3, 17); m.call(0x08f3); // 085a  call 0x08f3
  regs.b = 0x98; m.step(0x085f, 7); // 085d  mvi b,0x98
  regs.a = m.io.portIn(0x01); m.step(0x0861, 10); // 085f  in 0x01
  regs.rrca(); m.step(0x0862, 4); // 0861  rrc
  regs.rrca(); m.step(0x0863, 4); // 0862  rrc
  if (regs.fC) { m.step(0x086d, 10); return m.call(0x086d); } // 0863  jc 0x086d
  m.step(0x0866, 10);
  regs.rrca(); m.step(0x0867, 4); // 0866  rrc
  if (regs.fC) { m.step(0x0798, 10); return m.call(0x0798); } // 0867  jc 0x0798
  m.step(0x086a, 10);
  m.step(0x077f, 10); return m.call(0x077f); // 086a  jmp 0x077f (tail)
}
