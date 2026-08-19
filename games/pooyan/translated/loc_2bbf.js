// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2bbf  (ROM 0x2bbf-0x2bd1) -- caller-skip helper for loc_2b9a. With A = (0x8903): if A==1 it
// tail-blits the ready sprite (loc_2bd3); if the tile at 0x877b already equals 0xba it does `pop af;
// ret`, aborting loc_2b9a (the boolean skip); otherwise it blits tile 0x2be1 at 0x877b (loc_3325) and
// falls into loc_2bd3. Boolean protocol: true = normal return, false = caller-skip. loc_3325 = pat A.
export function loc_2bbf(m) {
  const { regs, mem } = m;

  regs.cp(0x01); m.step(0x2bc1, 7); // 2bbf  cp 0x01
  regs.hl = 0x877b; m.step(0x2bc4, 10); // 2bc1  ld hl,0x877b
  if (regs.fZ) { m.step(0x2bd3, 12); m.call(0x2bd3); return true; } // 2bc4  jr z,0x2bd3 (normal)
  m.step(0x2bc6, 7);
  regs.a = mem.read8(regs.hl); m.step(0x2bc7, 7); // 2bc6  ld a,(hl)
  regs.cp(0xba); m.step(0x2bc9, 7); // 2bc7  cp 0xba
  if (regs.fNZ) {
    m.step(0x2bcd, 12); // 2bc9  jr nz,0x2bcd
  } else {
    m.step(0x2bcb, 7);
    regs.af = m.pop16(); m.step(0x2bcc, 10); // 2bcb  pop af (discard caller return)
    m.ret(); return false; // 2bcc  ret -- caller-skip
  }
  regs.de = 0x2be1; m.step(0x2bd0, 10); // 2bcd  ld de,0x2be1
  m.push16(0x2bd3); m.step(0x3325, 17); m.call(0x3325); // 2bd0  call 0x3325 (pattern A)
  m.call(0x2bd3); return true; // fall into loc_2bd3 (normal)
}
