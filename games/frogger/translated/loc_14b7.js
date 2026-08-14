// SPDX-License-Identifier: GPL-3.0-only
import { NotImplemented } from "../../../boards/frogger/io.js";

// loc_14b7  (ROM 0x14B7-0x14C6) — object/sprite dispatcher. Index = (0x80FF) (0..10); HL = 0x14C7 +
// 2*index reads a 16-bit pointer from the table at 0x14C7 and `jp (hl)` enters that arm. The 11 arm
// bodies (0x14DD-0x1597) are separate routines; this stub only computes + delegates.
export function loc_14b7(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x80ff);
  m.step(0x14ba, 13); // A = (0x80ff) object index (0..10)
  regs.bc = 0x14c7;
  m.step(0x14bd, 10); // BC = pointer-table base
  regs.h = 0x00;
  m.step(0x14bf, 7);
  regs.add(regs.a);
  m.step(0x14c0, 4); // A = 2*index
  regs.l = regs.a;
  m.step(0x14c1, 4); // HL = 2*index
  regs.addHl(regs.bc);
  m.step(0x14c2, 11); // HL = 0x14c7 + 2*index
  regs.c = mem.read8(regs.hl);
  m.step(0x14c3, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x14c4, 6);
  regs.h = mem.read8(regs.hl);
  m.step(0x14c5, 7);
  regs.l = regs.c;
  m.step(0x14c6, 4); // HL = the arm pointer

  m.step(regs.hl, 4); // jp (hl)
  switch (regs.hl) {
    case 0x14dd: return m.call(0x14dd);
    case 0x14ee: return m.call(0x14ee);
    case 0x14ff: return m.call(0x14ff);
    case 0x1510: return m.call(0x1510);
    case 0x1521: return m.call(0x1521);
    case 0x1532: return m.call(0x1532);
    case 0x1543: return m.call(0x1543);
    case 0x1554: return m.call(0x1554);
    case 0x1565: return m.call(0x1565);
    case 0x1576: return m.call(0x1576);
    case 0x1587: return m.call(0x1587);
    default:
      throw new NotImplemented(
        `loc_14b7 jp(hl) at 0x14c6: target 0x${regs.hl.toString(16)} outside the object arm ` +
          "table {0x14dd..0x1587} -- (0x80ff) > 10",
      );
  }
}
