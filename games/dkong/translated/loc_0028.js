// SPDX-License-Identifier: GPL-3.0-only
import { loc_00ca } from "./loc_00ca.js";

/**
 * loc_0028  (ROM 0x0028–0x0037) — the inline-jump-table trampoline.
 *
 *   0028  87           add  a,a
 *   0029  e1           pop  hl
 *   002a  5f           ld   e,a
 *   002b  16 00        ld   d,0x00
 *   002d  c3 32 00     jp   0x0032
 *   0032  19           add  hl,de            ; loc_0032
 *   0033  5e           ld   e,(hl)
 *   0034  23           inc  hl
 *   0035  56           ld   d,(hl)
 *   0036  eb           ex   de,hl
 *   0037  e9           jp   (hl)
 *
 * TRANSLATED RATHER THAN SHORT-CIRCUITED, for three reasons a review caught:
 *
 *  1. `pop hl` consumes the pushed return address, and the Z80 does not clear
 *     popped bytes -- so 0x00CA's two bytes stay resident below SP, inside
 *     the work RAM that gets diffed against MAME. Skipping the push/pop pair
 *     leaves those bytes stale and produces a divergence at an address no
 *     routine ever names.
 *  2. The body is 74 T-states, and it runs every frame. Charging only the
 *     `rst`'s own 11 would drift every subsequent frame boundary.
 *  3. It CLOBBERS REGISTERS the handlers then see: on entry to a state
 *     handler the hardware has A = state*2, DE = the target address, HL = the
 *     target too (after `ex de,hl`), and flags from `add a,a` / `add hl,de`.
 *
 * The table is read from ROM through the normal memory path rather than from
 * a JS array, so it stays the ROM's data rather than a transcription of it.
 */
export function loc_0028(m, site = "0x00CA (NMI game state)") {
  const { regs, mem } = m;

  regs.add(regs.a); // add a,a -- index * 2
  m.tick(4);
  regs.hl = m.pop16(); // pop hl -- the table base, 0x00CA
  m.tick(10);
  regs.e = regs.a;
  m.tick(4);
  regs.d = 0x00;
  m.tick(7);
  m.tick(10); // jp 0x0032
  regs.addHl(regs.de); // add hl,de -- &table[index]
  m.tick(11);
  regs.e = mem.read8(regs.hl);
  m.tick(7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.tick(6);
  regs.d = mem.read8(regs.hl);
  m.tick(7);
  regs.exDeHl(); // ex de,hl -- HL = target
  m.tick(4);
  m.tick(4); // jp (hl)

  // RETURN the target's value, do not drop it. rst 0x28 is a call LAYER, and a
  // call layer that swallows a skip-capable target's boolean loses the skip
  // exactly like the 216d plain-call defect -- one level deeper. The 5 existing
  // loc_00ca arms already `return handler(m)`, and the two current
  // loc_0028 callers (entry_0066 / the 0x0748 substate dispatch) ignore the value,
  // so this is INERT today. It becomes load-bearing for skip-capable dispatch
  // targets (the 0x3110 guard family, reached via sub_30fa). Lead-ratified
  // convention: a caller dispatching a skip-capable target consumes and
  // propagates the boolean.
  return loc_00ca(m, regs.hl, site);
}
