// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2b59  (ROM 0x2b59-0x2b8c) -- reset a column of 8 attribute bytes at 0x855f (stride -0x20) to
// 0x10, then checksum the 10-byte 0x82bc column into C; unless it sums to 0xaa it returns. On the
// magic sum it clears 0x8e2a and, on the 0x880e / 0x880d flags, hands to loc_2bd2 or loc_2bb3, else
// falls into the shared epilogue loc_2b8d.
export function loc_2b59(m) {
  const { regs, mem } = m;

  regs.hl = 0x855f; m.step(0x2b5c, 10);
  regs.de = 0xffe0; m.step(0x2b5f, 10);
  regs.b = 0x08; m.step(0x2b61, 7);
  for (;;) {
    regs.a = 0x10; m.step(0x2b63, 7);
    mem.write8(regs.hl, regs.a); m.step(0x2b64, 7); // 2b63  ld (hl),a
    regs.addHl(regs.de); m.step(0x2b65, 11);
    if (regs.djnz() !== 0) { m.step(0x2b61, 13); continue; }
    m.step(0x2b67, 8); break;
  }
  regs.hl = 0x82bc; m.step(0x2b6a, 10);
  regs.de = 0xffe0; m.step(0x2b6d, 10);
  regs.bc = 0x0a00; m.step(0x2b70, 10);
  for (;;) {
    regs.a = mem.read8(regs.hl); m.step(0x2b71, 7); // 2b70  ld a,(hl)
    regs.add(regs.c); m.step(0x2b72, 4);
    regs.c = regs.a; m.step(0x2b73, 4);
    regs.addHl(regs.de); m.step(0x2b74, 11);
    if (regs.djnz() !== 0) { m.step(0x2b70, 13); continue; }
    m.step(0x2b76, 8); break;
  }
  regs.a = regs.c; m.step(0x2b77, 4);
  regs.cp(0xaa); m.step(0x2b79, 7);
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x2b7a, 5);
  regs.xor(regs.a); m.step(0x2b7b, 4);
  mem.write8(0x8e2a, regs.a); m.step(0x2b7e, 13); // 2b7b  ld (0x8e2a),a
  regs.a = mem.read8(0x880e); m.step(0x2b81, 13); // 2b7e  ld a,(0x880e)
  regs.and(regs.a); m.step(0x2b82, 4);
  if (regs.fZ) { m.step(0x2bd2, 12); return m.call(0x2bd2); }
  m.step(0x2b84, 7);
  regs.a = mem.read8(0x880d); m.step(0x2b87, 13); // 2b84  ld a,(0x880d)
  regs.and(regs.a); m.step(0x2b88, 4);
  if (regs.fZ) { m.step(0x2bb3, 12); return m.call(0x2bb3); }
  m.step(0x2b8a, 7);
  regs.a = mem.read8(0x8948); m.step(0x2b8d, 13); // 2b8a  ld a,(0x8948)
  return m.call(0x2b8d); // fall into loc_2b8d
}
