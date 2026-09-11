// SPDX-License-Identifier: GPL-3.0-only
// loc_b60f (ROM 0xb60f-0xb61b) -- picks a jump-mode byte from the 0xb61e table by ($028a,x & 3), loads Y
// with the slot's target ($02b9,x), then tail-jmps to loc_bcfd (the shared computed-jump dispatcher).
export function loc_b60f(m) {
  const { regs, mem } = m;
  let e = (0x028a + regs.x) & 0xffff;
  regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xb612, 4 + ((0x028a & 0xff00) !== (e & 0xff00) ? 1 : 0));
  regs.and(0x03); m.step(0xb614, 2);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xb615, 2);
  e = (0xb61e + regs.y) & 0xffff;
  regs.a = mem.read8(e); regs.setNZ(regs.a); m.step(0xb618, 4 + ((0xb61e & 0xff00) !== (e & 0xff00) ? 1 : 0));
  e = (0x02b9 + regs.x) & 0xffff;
  regs.y = mem.read8(e); regs.setNZ(regs.y); m.step(0xb61b, 4 + ((0x02b9 & 0xff00) !== (e & 0xff00) ? 1 : 0));
  m.step(0xbcfd, 3); return m.call(0xbcfd); // jmp 0xbcfd
}
