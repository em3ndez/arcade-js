// SPDX-License-Identifier: GPL-3.0-only
import { NotImplemented } from "../../../boards/dkong/io.js";

/**
 * dispatchTask  (ROM 0x02E3–0x0306) — the main loop's task dispatch.
 *
 *   02e3  e6 1f        and  0x1f
 *   02e5  5f           ld   e,a
 *   02e6  16 00        ld   d,0x00
 *   02e8  36 ff        ld   (hl),0xff
 *   02ea  2c           inc  l
 *   02eb  4e           ld   c,(hl)
 *   02ec  36 ff        ld   (hl),0xff
 *   02ee  2c           inc  l
 *   02ef  7d           ld   a,l
 *   02f0  fe c0        cp   0xc0
 *   02f2  30 02        jr   nc,0x02f6
 *   02f4  3e c0        ld   a,0xc0
 *   02f6  32 b1 60     ld   (0x60b1),a
 *   02f9  79           ld   a,c
 *   02fa  21 bd 02     ld   hl,0x02bd
 *   02fd  e5           push hl
 *   02fe  21 07 03     ld   hl,0x0307
 *   0301  19           add  hl,de
 *   0302  5e           ld   e,(hl)
 *   0303  23           inc  hl
 *   0304  56           ld   d,(hl)
 *   0305  eb           ex   de,hl
 *   0306  e9           jp   (hl)
 *
 * Consumes one task from the ring: the low 5 bits of the first byte index a
 * table of handlers at 0x0307, the second byte is passed to the handler in A,
 * and BOTH slots are marked 0xFF -- free -- as they are read. The read
 * pointer at 0x60B1 wraps back to 0xC0 rather than 0x00, matching sub_309f's
 * write pointer.
 *
 * 0x02BD is pushed as the return address, so the handler's `ret` lands back
 * at the top of the main loop rather than after the dispatch. That is also
 * what bounds the 0x0307 table exactly: it ends where 0x0315 begins.
 *
 * This is the second dispatcher in the ROM and it is computed INLINE rather
 * than via the rst 0x28 trampoline, which is why static tracing logs the
 * `jp (hl)` at 0x0306 as unresolved instead of following it.
 */
export function dispatchTask(m) {
  const { regs, mem } = m;

  regs.and(0x1f);
  m.step(0x02e5, 7);
  regs.e = regs.a;
  m.step(0x02e6, 4);
  regs.d = 0x00;
  m.step(0x02e8, 7);
  mem.write8(regs.hl, 0xff); // free the slot as it is consumed
  m.step(0x02ea, 10);
  regs.l = (regs.l + 1) & 0xff;
  m.step(0x02eb, 4);
  regs.c = mem.read8(regs.hl);
  m.step(0x02ec, 7);
  mem.write8(regs.hl, 0xff);
  m.step(0x02ee, 10);
  regs.l = (regs.l + 1) & 0xff;
  m.step(0x02ef, 4);
  regs.a = regs.l;
  m.step(0x02f0, 4);
  regs.cp(0xc0);
  m.step(0x02f2, 7);
  if (regs.fNC) {
    m.step(0x02f6, 12); // jr nc taken
  } else {
    m.step(0x02f4, 7);
    regs.a = 0xc0; // wrap the read pointer to the ring base
    m.step(0x02f6, 7);
  }
  mem.write8(0x60b1, regs.a);
  m.step(0x02f9, 13);
  regs.a = regs.c; // the task's payload byte, passed to the handler
  m.step(0x02fa, 4);
  regs.hl = 0x02bd;
  m.step(0x02fd, 10);
  m.push16(regs.hl); // the handler returns to the top of the main loop
  m.step(0x02fe, 11);
  regs.hl = 0x0307;
  m.step(0x0301, 10);
  regs.addHl(regs.de);
  m.step(0x0302, 11);
  const index = regs.e; // capture BEFORE the table read clobbers it
  regs.e = mem.read8(regs.hl);
  m.step(0x0303, 7);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0304, 6);
  regs.d = mem.read8(regs.hl);
  m.step(0x0305, 7);
  regs.exDeHl();
  m.step(0x0306, 4);
  m.step(regs.hl, 4); // jp (hl)

  if (m.overrides && m.overrides.has(regs.hl)) return m.overrides.get(regs.hl)(m);
  if (regs.hl === 0x05e9) return m.call(0x05e9);
  if (regs.hl === 0x05c6) return m.call(0x05c6);
  if (regs.hl === 0x0611) return m.call(0x0611);
  if (regs.hl === 0x051c) return m.call(0x051c);
  if (regs.hl === 0x062a) return m.call(0x062a);
  if (regs.hl === 0x06b8) return m.call(0x06b8);
  if (regs.hl === 0x059b) return m.call(0x059b); // 0x0307 task table idx 2 (gameplay)
  throw new NotImplemented(
    `task handler at ROM 0x${regs.hl.toString(16).padStart(4, "0")} ` +
      `(0x0307 table index ${index}, payload 0x${regs.a.toString(16)})`,
  );
}
