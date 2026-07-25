// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_141e  (ROM 0x141E–0x1485) — search 0x611C[5] for record 1 or 3, dispatch.
 */
export function loc_141e(m) {
  const { regs, mem } = m;

  m.push16(0x1421);
  m.step(0x0616, 17); // call 0x0616
  m.call(0x0616);
  m.push16(0x1422);
  m.step(0x0018, 11); // rst 0x18
  if (!m.call(0x0018)) return; // counter not expired -- aborted
  m.push16(0x1425);
  m.step(0x0874, 17); // call 0x0874
  m.call(0x0874);

  regs.a = 0x00;
  m.step(0x1427, 7); // ld a,0x00
  mem.write8(0x600e, regs.a); // clear player index
  m.step(0x142a, 13);
  mem.write8(0x600d, regs.a);
  m.step(0x142d, 13);

  // ---- search 0x611C[5] (stride 0x22) for a record == 1 ----
  regs.hl = 0x611c;
  m.step(0x1430, 10); // ld hl,0x611c
  regs.de = 0x0022;
  m.step(0x1433, 10); // ld de,0x0022
  regs.b = 0x05;
  m.step(0x1435, 7); // ld b,0x05
  regs.a = 0x01;
  m.step(0x1437, 7); // ld a,0x01 -- the search key (runs once)
  do {
    regs.cp(mem.read8(regs.hl));
    m.step(0x1438, 7); // cp (hl)
    if (regs.fZ) {
      m.step(0x1459, 10); // jp z,0x1459
      return m.call(0x1459); // A = 0x01 here
    }
    m.step(0x143b, 10); // jp z NOT taken
    regs.addHl(regs.de);
    m.step(0x143c, 11); // add hl,de
    regs.b = (regs.b - 1) & 0xff;
    m.step(regs.b !== 0 ? 0x1437 : 0x143e, regs.b !== 0 ? 13 : 8); // djnz 0x1437
  } while (regs.b !== 0);

  // ---- search 0x611C[5] for a record == 3 ----
  regs.hl = 0x611c;
  m.step(0x1441, 10); // ld hl,0x611c
  regs.b = 0x05;
  m.step(0x1443, 7); // ld b,0x05
  regs.a = 0x03;
  m.step(0x1445, 7); // ld a,0x03 -- the search key (runs once)
  do {
    regs.cp(mem.read8(regs.hl));
    m.step(0x1446, 7); // cp (hl)
    if (regs.fZ) {
      m.step(0x144f, 10); // jp z,0x144f
      return m.call(0x144f);
    }
    m.step(0x1449, 10); // jp z NOT taken
    regs.addHl(regs.de);
    m.step(0x144a, 11); // add hl,de
    regs.b = (regs.b - 1) & 0xff;
    m.step(regs.b !== 0 ? 0x1445 : 0x144c, regs.b !== 0 ? 13 : 8); // djnz 0x1445
  } while (regs.b !== 0);

  m.step(0x1475, 10); // jp 0x1475 -- neither found
  return m.call(0x1475);
}
