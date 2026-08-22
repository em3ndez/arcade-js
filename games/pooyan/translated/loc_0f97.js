// SPDX-License-Identifier: GPL-3.0-only

// loc_0f97  (ROM 0x0f97-0x0fa1) -- second entry into the loc_0f92 display trampoline. Derives command
// A = (((0x8907) rrca) & 3) + 0x1e from the round counter, then tail-jumps to the 0x0fc3 command
// dispatcher (which ret's to loc_0f97's caller).
export function loc_0f97(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x8907); m.step(0x0f9a, 13); // ld a,(0x8907)
  regs.rrca();                m.step(0x0f9b, 4);
  regs.and(0x03);             m.step(0x0f9d, 7);
  regs.add(0x1e);             m.step(0x0f9f, 7);
  m.step(0x0fc3, 10);
  return m.call(0x0fc3); // jp 0x0fc3 -- tail-delegate to the shared command dispatcher
}
