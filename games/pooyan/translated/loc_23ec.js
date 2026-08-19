// SPDX-License-Identifier: GPL-3.0-only
//
// loc_23ec  (ROM 0x23ec-0x2404) -- odd-frame gate + script-pointer retreat. Bumps the 0x8f37 frame
// counter and returns on odd frames (bit0 set). On even frames it walks the script pointer (0x88be):
// if the current byte is 0x34 it reloads (0x10, then dec hl to back up the high byte), else it
// decrements the byte in place; the updated pointer is stored back. Plain-ret (pattern A callee).
export function loc_23ec(m) {
  const { regs, mem } = m;

  regs.hl = 0x8f37; m.step(0x23ef, 10); // 23ec  ld hl,0x8f37
  regs.incMem8(mem, regs.hl); m.step(0x23f0, 11); // 23ef  inc (hl)
  regs.bit(0, mem.read8(regs.hl)); m.step(0x23f2, 12); // 23f0  bit 0,(hl)
  if (regs.fNZ) { m.ret(11); return; } // 23f2  ret nz (odd frame)
  m.step(0x23f3, 5);
  regs.hl = mem.read16(0x88be); m.step(0x23f6, 16); // 23f3  ld hl,(0x88be)
  regs.a = mem.read8(regs.hl); m.step(0x23f7, 7); // 23f6  ld a,(hl)
  regs.cp(0x34); m.step(0x23f9, 7); // 23f7  cp 0x34
  if (regs.fZ) {
    m.step(0x23fe, 12); // 23f9  jr z,0x23fe
    mem.write8(regs.hl, 0x10); m.step(0x2400, 10); // 23fe  ld (hl),0x10
    regs.hl = (regs.hl - 1) & 0xffff; m.step(0x2401, 6); // 2400  dec hl
  } else {
    m.step(0x23fb, 7);
    regs.decMem8(mem, regs.hl); m.step(0x23fc, 11); // 23fb  dec (hl)
    m.step(0x2401, 12); // 23fc  jr 0x2401
  }
  mem.write16(0x88be, regs.hl); m.step(0x2404, 16); // 2401  ld (0x88be),hl
  m.ret(); // 2404  ret
}
