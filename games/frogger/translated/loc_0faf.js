// SPDX-License-Identifier: GPL-3.0-only
import { NotImplemented } from "../../../boards/frogger/io.js";

// loc_0faf  (ROM 0x0FAF-0x0FBD) — frog-animation dispatcher. Index = the low byte of (0x8000) (0..10);
// HL = 0x0FBE + 2*index reads a 16-bit pointer from the table at 0x0FBE and `jp (hl)` enters that arm.
// The 11 arm bodies (0x0FD4-0x1197) are separate routines; this stub only computes + delegates.
export function loc_0faf(m) {
  const { regs, mem } = m;

  regs.hl = mem.read16(0x8000);
  m.step(0x0fb2, 16); // HL = (0x8000); its low byte is the anim index
  regs.bc = 0x0fbe;
  m.step(0x0fb5, 10); // BC = pointer-table base
  regs.h = 0x00;
  m.step(0x0fb7, 7); // HL = index (0..10)
  regs.addHl(regs.hl);
  m.step(0x0fb8, 11); // HL = 2*index
  regs.addHl(regs.bc);
  m.step(0x0fb9, 11); // HL = 0x0fbe + 2*index
  regs.c = mem.read8(regs.hl);
  m.step(0x0fba, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0fbb, 6);
  regs.h = mem.read8(regs.hl);
  m.step(0x0fbc, 7);
  regs.l = regs.c;
  m.step(0x0fbd, 4); // HL = the arm pointer

  m.step(regs.hl, 4); // jp (hl)
  switch (regs.hl) {
    case 0x0fd4: return m.call(0x0fd4);
    case 0x1058: return m.call(0x1058);
    case 0x107b: return m.call(0x107b);
    case 0x109b: return m.call(0x109b);
    case 0x10bb: return m.call(0x10bb);
    case 0x10db: return m.call(0x10db);
    case 0x10f8: return m.call(0x10f8);
    case 0x1118: return m.call(0x1118);
    case 0x1138: return m.call(0x1138);
    case 0x1158: return m.call(0x1158);
    case 0x1178: return m.call(0x1178);
    default:
      throw new NotImplemented(
        `loc_0faf jp(hl) at 0x0fbd: target 0x${regs.hl.toString(16)} outside the frog-anim arm ` +
          "table {0x0fd4..0x1178} -- (0x8000) low byte > 10",
      );
  }
}
