// SPDX-License-Identifier: GPL-3.0-only
// loc_9a9d (ROM 0x9a9d-0x9aba) -- a demo list-pointer setup that dispatches into the loc_9aee family. From
// its entry it sets $2c=[$9b02], A=[$015d], Y=0, and the `ldy #0; beq` (Z always set) branches to loc_9af6
// (store $2b=0/$2d=A). The 0x9aa9+ block (ldy #N; bne into loc_9af1/loc_9aee) is faithful but unreachable
// from this entry (each ldy #N sets Z=0 so its bne is always taken before the fall-through into loc_9abb).
import { loc_9aee, loc_9af1, loc_9af6 } from "./loc_9aee.js";
import { loc_9abb } from "./loc_9abb.js";

export function loc_9a9d(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x9b02); regs.setNZ(regs.a); m.step(0x9aa0, 4);
  mem.write8(0x2c, regs.a); m.step(0x9aa2, 3);
  regs.a = mem.read8(0x015d); regs.setNZ(regs.a); m.step(0x9aa5, 4);
  regs.y = 0x00; regs.setNZ(regs.y); m.step(0x9aa7, 2);
  if (regs.fZ) { m.step(0x9af6, 3); return loc_9af6(m); } // beq 0x9af6
  m.step(0x9aa9, 2);
  regs.a = mem.read8(0x9b03); regs.setNZ(regs.a); m.step(0x9aac, 4);
  regs.ora(mem.read8(0x016d)); m.step(0x9aaf, 4);
  regs.y = 0x01; regs.setNZ(regs.y); m.step(0x9ab1, 2);
  if (!regs.fZ) { m.step(0x9af1, 3); return loc_9af1(m); } // bne 0x9af1
  m.step(0x9ab3, 2);
  regs.y = 0x04; regs.setNZ(regs.y); m.step(0x9ab5, 2);
  if (!regs.fZ) { m.step(0x9aee, 3); return loc_9aee(m); } // bne 0x9aee
  m.step(0x9ab7, 2); return loc_9ab7(m); // falls into loc_9ab7 (also an external dispatch entry)
}

// loc_9ab7 (ROM 0x9ab7-0x9aba) -- mid-entry dispatched externally: ldy #3; bne loc_9aee (Z always clear so
// always taken); the fall into loc_9abb is dead (kept faithful).
export function loc_9ab7(m) {
  const { regs } = m;
  regs.y = 0x03; regs.setNZ(regs.y); m.step(0x9ab9, 2);
  if (!regs.fZ) { m.step(0x9aee, 3); return loc_9aee(m); } // bne 0x9aee
  m.step(0x9abb, 2); return loc_9abb(m); // falls into loc_9abb
}
