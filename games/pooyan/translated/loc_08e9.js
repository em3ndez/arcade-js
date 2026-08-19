// SPDX-License-Identifier: GPL-3.0-only

// loc_08e9  (ROM 0x08e9-0x0923) -- attract sub-state 1 (dispatch target 0x08a1[1]).
// Gates on the 0x02ce frame timer (`ret nz` while counting), then verifies two ROM tables
// by 8-bit sum (0x0859..0x0878 == 0x63; 0x0831..0x0839 == 0xaa; a failed sum re-enters
// 0x08f2, spinning on tampered ROM), paints the attribute map via loc_075d, queues two
// display commands (rst 0x38), and sets sub-state 0x8e51 = 7.
export function loc_08e9(m) {
  const { regs, mem } = m;

  regs.b = 0x1d;
  m.step(0x08eb, 7);
  m.call(0x02ce);
  m.step(0x08ee, 17); // 08eb  call 0x02ce -- frame timer
  if (regs.fNZ) {
    m.ret(11); // 08ee  ret nz (still counting)
    return;
  }
  m.step(0x08ef, 5);
  m.call(0x02e3);
  m.step(0x08f2, 17);

  for (;;) {
    // 08f2  guard 1: sum 0x0859..0x0878 must be 0x63
    regs.hl = 0x0859;
    m.step(0x08f5, 10);
    regs.b = 0x1f;
    m.step(0x08f7, 7);
    regs.a = mem.read8(regs.hl);
    m.step(0x08f8, 7);
    for (;;) {
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x08f9, 6);
      regs.add(mem.read8(regs.hl));
      m.step(0x08fa, 7);
      if (regs.djnz() !== 0) {
        m.step(0x08f8, 13);
        continue;
      }
      m.step(0x08fc, 8);
      break;
    }
    regs.cp(0x63);
    m.step(0x08fe, 7);
    if (regs.fNZ) {
      m.step(0x08f2, 12); // 08fe  checksum 1 fail -> retry
      continue;
    }
    m.step(0x0900, 7);
    regs.bc = 0x0859;
    m.step(0x0903, 10);
    m.call(0x075d);
    m.step(0x0906, 17); // 0903  call 0x075d -- fill attribute map
    // 0906  guard 2: sum 0x0831..0x0839 must be 0xaa
    regs.hl = 0x0831;
    m.step(0x0909, 10);
    regs.b = 0x08;
    m.step(0x090b, 7);
    regs.a = mem.read8(regs.hl);
    m.step(0x090c, 7);
    for (;;) {
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x090d, 6);
      regs.add(mem.read8(regs.hl));
      m.step(0x090e, 7);
      if (regs.djnz() !== 0) {
        m.step(0x090c, 13);
        continue;
      }
      m.step(0x0910, 8);
      break;
    }
    regs.cp(0xaa);
    m.step(0x0912, 7);
    if (regs.fNZ) {
      m.step(0x08f2, 12); // 0912  checksum 2 fail -> retry
      continue;
    }
    m.step(0x0914, 7);
    break;
  }

  m.call(0x0e54);
  m.step(0x0917, 17); // 0914  call 0x0e54
  regs.de = 0x0611;
  m.step(0x091a, 10);
  m.call(0x0038);
  m.step(0x091b, 11); // 091a  rst 0x38 -- queue display cmd (0x0611)
  regs.e = 0x0b;
  m.step(0x091d, 7);
  m.call(0x0038);
  m.step(0x091e, 11); // 091d  rst 0x38 -- queue display cmd (0x060b)
  regs.hl = 0x8e51;
  m.step(0x0921, 10);
  mem.write8(regs.hl, 0x07);
  m.step(0x0923, 10); // 0921  (0x8e51) := 7 (next sub-state)
  m.ret(); // 0923  ret
}
