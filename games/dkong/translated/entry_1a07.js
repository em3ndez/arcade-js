// SPDX-License-Identifier: GPL-3.0-only
import { NotImplemented } from "../../../boards/dkong/io.js";

/**
 * entry_1a07  (ROM 0x1A07–0x1A32) — rst 0x28 STATE-MACHINE dispatcher.
 * ONE caller: loc_197a @ 0x19BC.
 * Reads (0x6386) and dispatches to one of 4 states via the inline table @0x1A0B =
 * dw [0x1A1E, 0x1A15, 0x1A1F, 0x1A2A] (idx4+ = dw 0x0000, a wild jp). rst 0x28
 * dispatches by JUMP (the pushed table base is consumed by the body's pop hl), so
 * each handler's `ret` returns to loc_197a, NOT to this dispatcher.
 *
 * The rst 0x28 body (ROM 0x0028-0x0037) is modelled FAITHFULLY (push/pop balanced,
 * table read from ROM).
 */
export function entry_1a07(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6386); // state 0..4
  m.step(0x1a0a, 13); // ld a,(0x6386)
  m.push16(0x1a0b); // rst 0x28 pushes the address AFTER it -- the TABLE BASE
  m.step(0x0028, 11); // rst 0x28

  // -- inline rst 0x28 body (ROM 0x0028-0x0037), modelled faithfully --
  regs.add(regs.a);
  m.step(0x0029, 4); // add a,a -- A = 2*state
  regs.hl = m.pop16(); // pop hl -- table base 0x1A0B (balances the push)
  m.step(0x002a, 10);
  regs.e = regs.a;
  m.step(0x002b, 4); // ld e,a
  regs.d = 0x00;
  m.step(0x002d, 7); // ld d,0x00
  m.step(0x0032, 10); // jp 0x0032
  regs.addHl(regs.de); // add hl,de -- HL = table base + 2*state (flags dead into handlers)
  m.step(0x0033, 11);
  regs.e = mem.read8(regs.hl);
  m.step(0x0034, 7); // ld e,(hl)
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0035, 6); // inc hl
  regs.d = mem.read8(regs.hl);
  m.step(0x0036, 7); // ld d,(hl)
  const target = regs.de; // ex de,hl -- HL becomes the target
  regs.de = regs.hl;
  regs.hl = target;
  m.step(0x0037, 4); // ex de,hl
  m.step(target, 4); // jp (hl)

  if (target === 0x1a1e) { m.call(0x1a1e); return true; } // idx0 -- no-op ret
  if (target === 0x1a15) { m.call(0x1a15); return true; } // idx1 -- INIT
  if (target === 0x1a1f) { m.call(0x1a1f); return true; } // idx2 -- DELAY
  if (target === 0x1a2a) return m.call(0x1a2a); // idx3 -- true (ret-nz) / false (caller-skip)
  // idx4+ ((0x6386) >= 4): table[4] = dw 0x0000 -> jp 0x0000, a wild jump (never on tape).
  throw new NotImplemented(
    `entry_1a07 rst 0x28 dispatches to ROM 0x${target.toString(16).padStart(4, "0")} ` +
      "((0x6386) out of the 0..3 state range -> wild jp 0x0000); non-executing frontier.",
  );
}
