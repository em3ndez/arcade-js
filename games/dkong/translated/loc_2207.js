// SPDX-License-Identifier: GPL-3.0-only
import { NotImplemented } from "../../../boards/dkong/io.js";

/**
 * loc_2207  (ROM 0x2207–0x2239) — 0x197a cascade: rst 0x30 gate-head.
 *
 *   2207  3e 02        ld   a,0x02
 *   2209  f7           rst  0x30        ; gate: rotate A right mem[0x6227] times; carry -> body,
 *                                       ; else skip -> return to caller. SKIPS on coin_start.
 *   220a  ...          (body -- NON-EXECUTING frontier; object update over 0x6280 -> ret 0x2239)
 *
 * A rst-0x30-gated head reached via `call 0x2207` @0x199B (197a cascade). On the
 * measured coin_start tape the gate SKIPS -- only the 3-byte head executes; the body
 * 0x220A-0x2239 is a non-executing frontier (NotImplemented marks it, like the loc_0c92
 * untranslated arms).
 */
export function loc_2207(m) {
  const { regs } = m;

  regs.a = 0x02;
  m.step(0x2209, 7); // ld a,0x02
  m.push16(0x220a); // rst 0x30 pushes the body address
  m.step(0x0030, 11); // rst 0x30
  if (!m.call(0x0030)) return; // gate SKIPPED (coin_start) -> returned to caller

  return sub_2207_body(m); // 0x220A: the object-update body (now translated)
}

/**
 * sub_2207_body  (ROM 0x2207–0x221A) — loc_2207's object-update body (0x220A onward). Reads (0x601A) frame parity to.
 * pick record 0x6280 (odd) / 0x6288 (even); push the record base; rst 0x28 dispatches on the state
 * byte to loc_2227/2259/2299/22a2 (table @0x221B). rst-0x28 body modelled faithfully.
 */
export function sub_2207_body(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x601a);
  m.step(0x220d, 13); // ld a,(0x601a)
  regs.rra();
  m.step(0x220e, 4); // rra -- frame bit0 -> carry
  regs.hl = 0x6280;
  m.step(0x2211, 10); // ld hl,0x6280
  regs.a = mem.read8(regs.hl);
  m.step(0x2212, 7); // ld a,(hl)
  if (regs.fC) {
    m.step(0x2219, 10); // jp c,0x2219 (odd frame -> keep 0x6280)
  } else {
    m.step(0x2215, 10);
    regs.hl = 0x6288;
    m.step(0x2218, 10); // ld hl,0x6288
    regs.a = mem.read8(regs.hl);
    m.step(0x2219, 7); // ld a,(hl)
  }
  m.push16(regs.hl); // push hl -- the record base (each arm pops it)
  m.step(0x221a, 11);
  m.push16(0x221b); // rst 0x28 pushes the table base 0x221B
  m.step(0x0028, 11);
  // -- inline rst 0x28 body (ROM 0x0028-0x0037), state A in 0..3 --
  regs.add(regs.a);
  m.step(0x0029, 4); // add a,a
  regs.hl = m.pop16();
  m.step(0x002a, 10); // pop hl = 0x221B
  regs.e = regs.a;
  m.step(0x002b, 4);
  regs.d = 0x00;
  m.step(0x002d, 7);
  m.step(0x0032, 10);
  regs.addHl(regs.de);
  m.step(0x0033, 11);
  regs.e = mem.read8(regs.hl);
  m.step(0x0034, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0035, 6);
  regs.d = mem.read8(regs.hl);
  m.step(0x0036, 7);
  const target = regs.de;
  regs.de = regs.hl;
  regs.hl = target;
  m.step(0x0037, 4); // ex de,hl
  m.step(target, 4); // jp (hl)
  if (target === 0x2227) return m.call(0x2227);
  if (target === 0x2259) return m.call(0x2259);
  if (target === 0x2299) return m.call(0x2299);
  if (target === 0x22a2) return m.call(0x22a2);
  throw new NotImplemented(
    `loc_2207 body rst 0x28 -> unexpected ROM 0x${target.toString(16).padStart(4, "0")}`,
  );
}
