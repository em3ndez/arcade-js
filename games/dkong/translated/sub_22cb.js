// SPDX-License-Identifier: GPL-3.0-only
import { NotImplemented } from "../../../boards/dkong/io.js";

/**
 * sub_22cb  (ROM 0x22CB–0x2302) — OBJECT VELOCITY INIT (difficulty/mode/RNG scaled).
 * Called from 0x2149. IX live-in
 * (object record). Sets (ix+0x11)=magnitude, (ix+0x10)=(A&1)-1 (0x00 odd / 0xFF even).
 *
 *   22cb  ld a,(0x6348) / and a / jp z,0x22e1   ; mode 0 -> loc_22e1 (0x6229 pick)
 *   22d2  ld a,(0x6380) / dec a / rst 0x28      ; difficulty 0..5, index = diff-1
 *   22d7  dw 22f6,22f6,2303,2303,231a           ; INLINE table: diff 1/2->22f6 (RNG,
 *                                               ;   internal); diff 3/4->2303, 5->231a
 *                                               ;   (EXTERNAL, non-executing frontier)
 *
 * The rst 0x28 body (ROM 0x0028-0x0037) is modelled FAITHFULLY (push/pop balanced,
 * table read from ROM), per the sub_0f56 rst-0x28 discipline -- NOT summarised as a
 * JS array (that hides the pop hl and the register/flag clobber). On the coin_start
 * tape difficulty is 1 -> 0x22F6, so 0x2303/0x231a are a non-executing frontier.
 */
export function sub_22cb(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x6348); // mode flag
  m.step(0x22ce, 13); // ld a,(0x6348)
  regs.and(regs.a);
  m.step(0x22cf, 4); // and a
  if (regs.fZ) {
    m.step(0x22e1, 10); // jp z,0x22e1 -- mode 0
    return m.call(0x22e1);
  }
  m.step(0x22d2, 10); // jp z NOT taken

  regs.a = mem.read8(0x6380); // difficulty 0..5
  m.step(0x22d5, 13); // ld a,(0x6380)
  regs.a = regs.dec8(regs.a); // dec a -- index = difficulty - 1
  m.step(0x22d6, 4);
  m.push16(0x22d7); // rst 0x28 pushes the address AFTER it -- the TABLE BASE
  m.step(0x0028, 11); // rst 0x28

  // -- inline rst 0x28 body (ROM 0x0028-0x0037), modelled faithfully (sub_0f56 discipline) --
  regs.add(regs.a);
  m.step(0x0029, 4); // add a,a -- A = 2*index
  regs.hl = m.pop16(); // pop hl -- table base 0x22D7 (balances the push)
  m.step(0x002a, 10);
  regs.e = regs.a;
  m.step(0x002b, 4); // ld e,a
  regs.d = 0x00;
  m.step(0x002d, 7); // ld d,0x00
  m.step(0x0032, 10); // jp 0x0032
  regs.addHl(regs.de); // add hl,de -- HL = table base + 2*index (flags dead into targets)
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

  if (target === 0x22f6) return m.call(0x22f6); // diff 1/2 -> RNG (internal)
  if (target === 0x2303) return m.call(0x2303); // diff 3/4
  if (target === 0x231a) return m.call(0x231a); // diff 5
  throw new NotImplemented(
    `sub_22cb rst 0x28 dispatches to unexpected ROM 0x${target.toString(16).padStart(4, "0")}`,
  );
}
