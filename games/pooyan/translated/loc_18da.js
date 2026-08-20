// SPDX-License-Identifier: GPL-3.0-only

// loc_18da  (ROM 0x18da-0x191b) -- pending-bonus / score-tally step. (0x8909) holds a queued
// award; when zero it reloads the queue slot (0x05 or 0x03 per demo flag 0x8800) and returns.
// When non-zero it gates on the active player's counter MSB (0x88a4/0x88a7 per 0x880d bit0)
// equalling the queued value; if so it bumps a saturating counter at 0x8908, computes the next
// step (0x08 or 0x07 per 0x8800) BCD-added to the queue, stores it, and runs two sub-handlers.
export function loc_18da(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8909);        m.step(0x18dd, 13);
  regs.and(regs.a);                  m.step(0x18de, 4);
  if (regs.fZ) {
    m.step(0x190e, 12);              // jr z,0x190e taken -- queue empty, reload slot
    regs.a = mem.read8(0x8800);      m.step(0x1911, 13);
    regs.and(regs.a);                m.step(0x1912, 4);
    regs.a = 0x05;                   m.step(0x1914, 7);
    if (regs.fZ) {
      m.step(0x1918, 12);            // jr z,0x1918 taken -- A stays 0x05
    } else {
      m.step(0x1916, 7);
      regs.a = 0x03;                 m.step(0x1918, 7);
    }
    mem.write8(0x8909, regs.a);      m.step(0x191b, 13);
    return m.ret(10);                // 191b  ret
  }
  m.step(0x18e0, 7);                 // jr z not taken

  regs.c = regs.a;                   m.step(0x18e1, 4);
  regs.a = mem.read8(0x880d);        m.step(0x18e4, 13);
  regs.hl = 0x88a4;                  m.step(0x18e7, 10);
  regs.and(regs.a);                  m.step(0x18e8, 4);
  if (regs.fZ) {
    m.step(0x18ed, 12);              // jr z,0x18ed taken -- player 1 counter
  } else {
    m.step(0x18ea, 7);
    regs.hl = 0x88a7;                m.step(0x18ed, 10); // player 2 counter
  }
  regs.a = mem.read8(regs.hl);       m.step(0x18ee, 7);
  regs.cp(regs.c);                   m.step(0x18ef, 4);
  if (regs.fNZ) { return m.ret(11); } // 18ef  ret nz -- MSB not yet reached
  m.step(0x18f0, 5);

  regs.hl = 0x8908;                  m.step(0x18f3, 10);
  regs.a = mem.read8(regs.hl);       m.step(0x18f4, 7);
  regs.cp(0xff);                     m.step(0x18f6, 7);
  if (regs.fNC) {
    m.step(0x18f9, 12);              // jr nc,0x18f9 taken -- already saturated
  } else {
    m.step(0x18f8, 7);
    regs.incMem8(mem, regs.hl);      m.step(0x18f9, 11); // 18f8  inc (hl)
  }
  regs.a = mem.read8(0x8800);        m.step(0x18fc, 13);
  regs.and(regs.a);                  m.step(0x18fd, 4);
  regs.a = 0x08;                     m.step(0x18ff, 7);
  if (regs.fZ) {
    m.step(0x1902, 12);              // jr z,0x1902 taken -- step 0x08
  } else {
    m.step(0x1901, 7);
    regs.a = regs.dec8(regs.a);      m.step(0x1902, 4); // dec a -> step 0x07
  }
  regs.add(regs.c);                  m.step(0x1903, 4);
  regs.daa();                        m.step(0x1904, 4);
  mem.write8(0x8909, regs.a);        m.step(0x1907, 13);

  m.push16(0x190a); m.step(0x03c2, 17); m.call(0x03c2); // 1907  call 0x03c2
  m.push16(0x190d); m.step(0x0f0d, 17); m.call(0x0f0d); // 190a  call 0x0f0d
  return m.ret(10);                  // 190d  ret
}
