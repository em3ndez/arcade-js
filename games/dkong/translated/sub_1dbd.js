// SPDX-License-Identifier: GPL-3.0-only
import { NotImplemented } from "../../../boards/dkong/io.js";

/**
 * sub_1dbd  (ROM 0x1DBD–0x1DC8) — rst 0x28 inline-jump-table dispatcher on 0x6340.
 *
 *   1dbd  3a 40 63     ld   a,(0x6340)
 *   1dc0  ef           rst  0x28
 *   ; ---- inline jump table 0x1DC1-0x1DC8 (DATA: 49 1e c9 1d 4a 1e 00 00) ----
 *   1dc1  dw 0x1E49    ; 0x6340 == 0
 *   1dc3  dw 0x1DC9    ; 0x6340 == 1  -> loc_1dc9 (advances 0x6340 := 2)
 *   1dc5  dw 0x1E4A    ; 0x6340 == 2
 *   1dc7  dw 0x0000    ; 0x6340 == 3  -> RESET VECTOR
 *
 * The ROUTER on state var 0x6340 (writes nothing itself). Leaves via the
 * dispatch, never a ret of its own.
 */
export function sub_1dbd(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x6340); // ld a,(0x6340) -- flag-neutral; A is the index
  m.step(0x1dc0, 13);
  const idx = regs.a; // raw state value, for the diagnostic below

  // rst 0x28: dispatch through the inline table at 0x1DC1, indexed by A. Body
  // (ROM 0x0028-0x0037) modelled exactly as sub_0f56's dispatcher above.
  m.push16(0x1dc1); // rst 0x28 pushes the address AFTER it -- the table base
  m.step(0x0028, 11);

  regs.add(regs.a);
  m.step(0x0029, 4); // add a,a -- A = 2*index
  regs.hl = m.pop16(); // pop hl -- table base 0x1DC1, balancing the push
  m.step(0x002a, 10);
  regs.e = regs.a;
  m.step(0x002b, 4); // ld e,a
  regs.d = 0x00;
  m.step(0x002d, 7); // ld d,0x00 -- DE = 2*index
  m.step(0x0032, 10); // jp 0x0032
  regs.addHl(regs.de); // add hl,de -- &table[index]
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

  if (target === 0x1dc9) return m.call(0x1dc9); // entry 1: 0x6340 == 1
  if (target === 0x1e49) return m.call(0x1e49); // entry 0: 0x6340 == 0 (idle ret; tape-hot)
  if (target === 0x1e4a) return m.call(0x1e4a); // entry 2: 0x6340 == 2 (state-2 countdown; finale-latent)
  throw new NotImplemented(
    `sub_1dbd dispatches via rst 0x28 to ROM 0x${target.toString(16).padStart(4, "0")} ` +
      `(table at 0x1DC1, index A=mem[0x6340]=${idx}), which is not translated.`,
  );
}
