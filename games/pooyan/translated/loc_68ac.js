// SPDX-License-Identifier: GPL-3.0-only

// loc_68ac  (ROM 0x68ac-0x68ea) -- once-only (0x8f55 latch) tile-region checksum + dispatch. Sums the
// bytes of a stride-0x20 region from 0x8402 into DE (E=low, D=carry count), scanning columns to l&0x1f
// ==0x1f, then l+=3 to the next row, until h>=0x88. E is matched against the 4-entry table at 0x68eb;
// no match -> tail 0x76d4. On a match, D is matched against the paired entry (ret z), else tail 0x3829.
export function loc_68ac(m) {
  const { regs, mem } = m;

  regs.hl = 0x8f55;                 m.step(0x68af, 10);
  regs.a = mem.read8(regs.hl);      m.step(0x68b0, 7);
  regs.and(regs.a);                 m.step(0x68b1, 4);
  if (regs.fNZ) { m.ret(11); return; } // 68b1  ret nz -- already ran
  m.step(0x68b2, 5);
  regs.incMem8(mem, regs.hl);       m.step(0x68b3, 11); // 68b2  inc (hl) -- set latch
  regs.hl = 0x8402;                 m.step(0x68b6, 10);
  regs.de = 0x0000;                 m.step(0x68b9, 10);

  for (;;) {
    regs.a = mem.read8(regs.hl);    m.step(0x68ba, 7);
    regs.add(regs.e);               m.step(0x68bb, 4);
    regs.e = regs.a;                m.step(0x68bc, 4);
    if (regs.fNC) {
      m.step(0x68bf, 12);           // 68bc  jr nc
    } else {
      m.step(0x68be, 7);
      regs.d = regs.inc8(regs.d);   m.step(0x68bf, 4); // 68be  inc d
    }
    regs.l = regs.inc8(regs.l);     m.step(0x68c0, 4);
    regs.a = regs.l;                m.step(0x68c1, 4);
    regs.and(0x1f);                 m.step(0x68c3, 7);
    regs.cp(0x1f);                  m.step(0x68c5, 7);
    if (regs.fNZ) { m.step(0x68b9, 12); continue; } // 68c5  jr nz -- next column
    m.step(0x68c7, 7);
    regs.a = regs.l;                m.step(0x68c8, 4);
    regs.add(0x03);                 m.step(0x68ca, 7);
    regs.l = regs.a;                m.step(0x68cb, 4);
    if (regs.fNC) { m.step(0x68b9, 12); continue; } // 68cb  jr nc -- next row
    m.step(0x68cd, 7);
    regs.h = regs.inc8(regs.h);     m.step(0x68ce, 4);
    regs.a = regs.h;                m.step(0x68cf, 4);
    regs.cp(0x88);                  m.step(0x68d1, 7);
    if (regs.fC) { m.step(0x68b9, 12); continue; } // 68d1  jr c -- more rows
    m.step(0x68d3, 7);
    break;
  }

  regs.hl = 0x68eb;                 m.step(0x68d6, 10);
  regs.b = 0x04;                    m.step(0x68d8, 7);
  regs.a = regs.e;                  m.step(0x68d9, 4);
  let matched = false;
  for (;;) {
    regs.cp(mem.read8(regs.hl));    m.step(0x68da, 7);
    if (regs.fZ) { m.step(0x68e2, 12); matched = true; break; } // 68da  jr z
    m.step(0x68dc, 7);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x68dd, 6);
    if (regs.djnz() !== 0) { m.step(0x68d9, 13); continue; } // 68dd  djnz
    m.step(0x68df, 8);
    break;
  }
  // 68df  jp 0x76d4 (data) -- tamper trap, unreachable with a valid ROM + correct tilemap (cf. loc_3278)
  if (!matched) throw new Error("loc_68ac: tile-region tamper checksum failed (E no match) -- 0x76d4 is data");

  for (;;) {
    regs.a = regs.d;               m.step(0x68e3, 4);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x68e4, 6);
    regs.cp(mem.read8(regs.hl));    m.step(0x68e5, 7);
    if (regs.fZ) { m.ret(11); return; } // 68e5  ret z -- paired match
    m.step(0x68e6, 5);
    if (regs.djnz() !== 0) { m.step(0x68e2, 13); continue; } // 68e6  djnz
    m.step(0x68e8, 8);
    break;
  }
  // 68e8  jp 0x3829 (data) -- tamper trap, unreachable with a valid ROM + correct tilemap (cf. loc_3278)
  throw new Error("loc_68ac: tile-region tamper checksum failed (D no match) -- 0x3829 is data");
}
