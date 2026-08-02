// SPDX-License-Identifier: GPL-3.0-only
import { NotImplemented } from "../../../boards/dkong/io.js";

/**
 * loc_1e96  (ROM 0x1E96–0x1E99) — + inline table 0x1E9A-0x1E9F.
 *
 *   1e96  3a 45 63     ld   a,(0x6345)
 *   1e99  ef           rst  0x28
 *   ; ---- inline jump table 0x1E9A-0x1E9F (DATA: a0 1e 09 1f 23 1f) ----
 *   1e9a  dw 0x1EA0    ; (0x6345) == 0
 *   1e9c  dw 0x1F09    ; (0x6345) == 1
 *   1e9e  dw 0x1F23    ; (0x6345) == 2
 */
export function loc_1e96(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x6345); // ld a,(0x6345) -- the dispatch index
  m.step(0x1e99, 13);
  const idx = regs.a; // for the diagnostic below

  // rst 0x28: dispatch through the inline table at 0x1E9A. Body (ROM
  // 0x0028-0x0037) modelled exactly as sub_1dbd / sub_0f56.
  m.push16(0x1e9a); // rst 0x28 pushes the address AFTER it -- the table base
  m.step(0x0028, 11);

  regs.add(regs.a);
  m.step(0x0029, 4); // add a,a -- A = 2*index
  regs.hl = m.pop16(); // pop hl -- table base 0x1E9A, balancing the push
  m.step(0x002a, 10);
  regs.e = regs.a;
  m.step(0x002b, 4); // ld e,a
  regs.d = 0x00;
  m.step(0x002d, 7); // ld d,0x00 -- DE = 2*index
  m.step(0x0032, 10); // jp 0x0032
  regs.addHl(regs.de); // add hl,de -- &table[index] (RAW: no bounds check)
  m.step(0x0033, 11);
  regs.e = mem.read8(regs.hl);
  m.step(0x0034, 7); // ld e,(hl)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0035, 6); // inc hl
  regs.d = mem.read8(regs.hl);
  m.step(0x0036, 7); // ld d,(hl)
  const target = regs.de; // ex de,hl: HL becomes the target, DE the pointer
  regs.de = regs.hl;
  regs.hl = target;
  m.step(0x0037, 4); // ex de,hl
  m.step(target, 4); // jp (hl)

  if (target === 0x1ea0) return m.call(0x1ea0); // idx 0
  if (target === 0x1f09) return m.call(0x1f09); // idx 1
  if (target === 0x1f23) return m.call(0x1f23); // idx 2
  throw new NotImplemented(
    `loc_1e96 dispatches via rst 0x28 to ROM 0x${target.toString(16).padStart(4, "0")} ` +
      `(3-entry table at 0x1E9A, index A=mem[0x6345]=${idx}), which is not translated.`,
  );
}
