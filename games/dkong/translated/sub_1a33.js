// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_1a33  (ROM 0x1A33–0x1AC2) — edge item pickup: grid clear + sprite erase (task-gated).
 * rst 0x30 gate (A=0x08). At a screen-edge X (0x4B/0xB3) -> arm (0x6291=1); when armed
 * (0x6291==1), process the pickup: build a slot index B from player X/Y bits, clear the
 * 0x6292+B slot, dec count 0x6290, compute the video address (stride 5 from 0x02CB/0x012B),
 * erase a 3-cell sprite, set collection flags (0x6340/0x6342/0x6225), and call z sub_1d95.
 */
export function sub_1a33(m) {
  const { regs, mem } = m;
  regs.a = 0x08;
  m.step(0x1a35, 7);
  m.push16(0x1a36); m.step(0x0030, 11);
  if (!m.call(0x0030)) return; // rst 0x30 gate closed -> caller-skip
  regs.a = mem.read8(0x6203);
  m.step(0x1a39, 13); // player X
  regs.cp(0x4b);
  m.step(0x1a3b, 7);
  if (regs.fZ) { m.step(0x1a4b, 10); return m.call(0x1a4b); } // X == 0x4B -> arm
  m.step(0x1a3e, 10);
  regs.cp(0xb3);
  m.step(0x1a40, 7);
  if (regs.fZ) { m.step(0x1a4b, 10); return m.call(0x1a4b); } // X == 0xB3 -> arm
  m.step(0x1a43, 10);
  regs.a = mem.read8(0x6291);
  m.step(0x1a46, 13);
  regs.a = regs.dec8(regs.a);
  m.step(0x1a47, 4);
  if (!regs.fZ) { m.ret(10); return; } // (0x6291) != 1 -> not armed
  m.step(0x1a51, 10);
  // -- armed pickup (A == 0 here) --
  mem.write8(0x6291, regs.a);
  m.step(0x1a54, 13); // disarm
  regs.b = regs.a;
  m.step(0x1a55, 4); // B = 0
  regs.a = mem.read8(0x6205);
  m.step(0x1a58, 13); // player Y
  regs.a = regs.dec8(regs.a);
  m.step(0x1a59, 4);
  regs.cp(0xd0);
  m.step(0x1a5b, 7);
  if (regs.fNC) { m.ret(11); return; } // off-field
  regs.rlca();
  m.step(0x1a5d, 4);
  if (regs.fC) { m.step(0x1a60, 10); regs.b = regs.set(2, regs.b); m.step(0x1a62, 8); } else m.step(0x1a62, 10);
  regs.rlca();
  m.step(0x1a63, 4);
  regs.rlca();
  m.step(0x1a64, 4);
  if (regs.fC) { m.step(0x1a67, 10); regs.b = regs.set(1, regs.b); m.step(0x1a69, 8); } else m.step(0x1a69, 10);
  regs.and(0x07);
  m.step(0x1a6b, 7);
  regs.cp(0x06);
  m.step(0x1a6d, 7);
  if (regs.fZ) { m.step(0x1a70, 10); regs.b = regs.set(1, regs.b); m.step(0x1a72, 8); } else m.step(0x1a72, 10);
  regs.a = mem.read8(0x6203);
  m.step(0x1a75, 13); // player X
  regs.rlca();
  m.step(0x1a76, 4);
  if (regs.fC) { m.step(0x1a79, 10); regs.b = regs.set(0, regs.b); m.step(0x1a7b, 8); } else m.step(0x1a7b, 10);
  regs.hl = 0x6292;
  m.step(0x1a7e, 10);
  regs.a = regs.b;
  m.step(0x1a7f, 4);
  regs.add(regs.l);
  m.step(0x1a80, 4); // add a,l
  regs.l = regs.a;
  m.step(0x1a81, 4); // HL = 0x6292 + B
  regs.a = mem.read8(regs.hl);
  m.step(0x1a82, 7);
  regs.and(regs.a);
  m.step(0x1a83, 4);
  if (regs.fZ) { m.ret(11); return; } // slot empty
  mem.write8(regs.hl, 0x00);
  m.step(0x1a86, 10); // clear slot
  regs.hl = 0x6290;
  m.step(0x1a89, 10);
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)));
  m.step(0x1a8a, 11); // dec count
  regs.a = regs.b;
  m.step(0x1a8b, 4);
  regs.bc = 0x0005;
  m.step(0x1a8e, 10);
  regs.rra();
  m.step(0x1a8f, 4); // A = B>>1, carry = B.0
  if (regs.fC) {
    m.step(0x1abd, 10);
    regs.hl = 0x012b;
    m.step(0x1ac0, 10);
    m.step(0x1a95, 10); // jp 0x1a95
  } else {
    m.step(0x1a92, 10);
    regs.hl = 0x02cb;
    m.step(0x1a95, 10);
  }
  // -- loc_1a95: stride multiply --
  regs.and(regs.a);
  m.step(0x1a96, 4);
  if (regs.fZ) {
    m.step(0x1a9e, 10); // jp z,0x1a9e
  } else {
    m.step(0x1a99, 10);
    do {
      regs.addHl(regs.bc);
      m.step(0x1a9a, 11); // add hl,bc
      regs.a = regs.dec8(regs.a);
      m.step(0x1a9b, 4); // dec a
      m.step(regs.a !== 0 ? 0x1a99 : 0x1a9e, 10); // jp nz,0x1a99
    } while (regs.a !== 0);
  }
  // -- loc_1a9e --
  regs.bc = 0x7400;
  m.step(0x1aa1, 10);
  regs.addHl(regs.bc);
  m.step(0x1aa2, 11); // HL = video addr
  regs.a = 0x10;
  m.step(0x1aa4, 7);
  mem.write8(regs.hl, regs.a);
  m.step(0x1aa5, 7);
  regs.l = regs.dec8(regs.l);
  m.step(0x1aa6, 4);
  mem.write8(regs.hl, regs.a);
  m.step(0x1aa7, 7);
  regs.l = regs.inc8(regs.l);
  m.step(0x1aa8, 4);
  regs.l = regs.inc8(regs.l);
  m.step(0x1aa9, 4);
  mem.write8(regs.hl, regs.a);
  m.step(0x1aaa, 7); // 3-cell erase
  regs.a = 0x01;
  m.step(0x1aac, 7);
  mem.write8(0x6340, regs.a);
  m.step(0x1aaf, 13);
  mem.write8(0x6342, regs.a);
  m.step(0x1ab2, 13);
  mem.write8(0x6225, regs.a);
  m.step(0x1ab5, 13); // collection flags
  regs.a = mem.read8(0x6216);
  m.step(0x1ab8, 13);
  regs.and(regs.a);
  m.step(0x1ab9, 4);
  if (regs.fZ) { m.push16(0x1abc); m.step(0x1d95, 17); m.call(0x1d95); } // call z,0x1d95
  else m.step(0x1abc, 10);
  m.ret(10);
}
