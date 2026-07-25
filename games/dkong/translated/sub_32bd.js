// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_32bd  (ROM 0x32BD–0x32D5) — 25 bytes, 11 instructions.
 *
 *   32bd  3a 27 62     ld   a,(0x6227)
 *   32c0  fe 01        cp   0x01
 *   32c2  ca ce 32     jp   z,0x32ce       ; == 1 -> sub_342c
 *   32c5  fe 02        cp   0x02
 *   32c7  ca d2 32     jp   z,0x32d2       ; == 2 -> sub_3478
 *   32ca  cd b9 34     call 0x34b9         ; default
 *   32cd  c9           ret
 *   32ce  cd 2c 34     call 0x342c         ; loc_32ce
 *   32d1  c9           ret
 *   32d2  cd 78 34     call 0x3478         ; loc_32d2
 *   32d5  c9           ret
 *
 * Translated for completeness; not yet wired into the live dispatcher.
 * Not yet wired into the live dispatcher: called from 0x327A (entry_3202, untranslated).
 * CLOSES THE 32bd SUBTREE: all three callees landed in drains #19/#20/#21.
 *
 * A 3-way dispatch on 0x6227: == 1 calls sub_342c, == 2 calls sub_3478, and
 * everything else (including 0 and >= 3) falls through to sub_34b9 -- there is
 * no range check. Each arm is a real call followed by a ret, so whatever the
 * handler leaves in A/flags passes up through this ret. 0x6227 not interpreted.
 *
 * SHARED-LOAD DISCIPLINE: `A` is loaded ONCE at 0x32BD and the `cp 0x01` /
 * `cp 0x02` chain both test that same value -- `cp` does not modify A, and the
 * ROM does not reload it. Re-reading 0x6227 before the second compare would be
 * a different program if anything could write it in between.
 *
 * Note sub_3478 has no `ret` of its own (it tail-jumps into loc_3445), so the
 * 0x32D5 return address pushed here is consumed by THAT tail's ret -- the
 * balance still works out because the tail-jump pushes nothing.
 */
export function sub_32bd(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x6227);
  m.step(0x32c0, 13); // ld a,(0x6227)
  regs.cp(0x01);
  m.step(0x32c2, 7); // cp 0x01
  if (regs.fZ) {
    // loc_32ce
    m.step(0x32ce, 10); // jp z,0x32ce TAKEN
    m.push16(0x32d1);
    m.step(0x342c, 17); // call 0x342c
    m.call(0x342c);
    m.ret(); // 32d1
    return;
  }
  m.step(0x32c5, 10); // jp z NOT taken

  regs.cp(0x02); // same A -- not reloaded
  m.step(0x32c7, 7); // cp 0x02
  if (regs.fZ) {
    // loc_32d2
    m.step(0x32d2, 10); // jp z,0x32d2 TAKEN
    m.push16(0x32d5);
    m.step(0x3478, 17); // call 0x3478
    m.call(0x3478); // no ret of its own -- loc_3445's ret consumes 0x32D5
    m.ret(); // 32d5
    return;
  }
  m.step(0x32ca, 10); // jp z NOT taken -- default arm

  m.push16(0x32cd);
  m.step(0x34b9, 17); // call 0x34b9
  m.call(0x34b9);

  m.ret(); // 32cd
}
