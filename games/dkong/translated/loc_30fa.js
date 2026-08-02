// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_30fa  (ROM 0x30FA–0x3103) — code + 0x3104-0x310F inline table (22 bytes).
 *
 *   30fa  3a 80 63     ld   a,(0x6380)
 *   30fd  fe 06        cp   0x06
 *   30ff  38 02        jr   c,0x3103      ; A < 6 -> dispatch as-is
 *   3101  3e 05        ld   a,0x05        ; A >= 6 -> clamp to 5
 *   3103  ef           rst  0x28          ; TAIL dispatch through the table below
 *   3104: 10 31 10 31 1b 31 26 31 26 31 31 31   (dw 3110 3110 311b 3126 3126 3131)
 *
 * the 12-byte table is read from ROM by sub_0028, not
 * transcribed.
 * Not yet wired into the live dispatcher: reached only from entry_30ed
 * (untranslated), and the guard targets are reached ONLY through this table --
 * never through the executed NMI/substate dispatches (grep-confirmed). The
 * sub_0028 correctness-gate inversion only fires once handler_1977 integrates
 * and this chain actually runs.
 *
 * Clamps the index at 0x6380 to [0,5] (>= 6 becomes 5), then `rst 0x28`
 * dispatches through the inline table to one of the four 0x3110-family guards.
 *
 * THE TAIL CASE (lead ruling condition 3). The rst 0x28 is loc_30fa's LAST
 * instruction -- 0x3104+ is table data, not code -- so loc_30fa has NO frame of
 * its own when the guard rets: the guard returns straight to loc_30fa's caller.
 * `return m.call(0x0028, ...)` therefore passes the guard's skip-boolean up
 * TRANSPARENTLY. A caller of loc_30fa that dispatches a skip-capable target must
 * consume it: `if (!m.call(0x30fa)) return;`. (3e88/3e99 do NOT share this shape --
 * they push HL across the dispatch -- and must be derived from their own bytes.)
 *
 * rst 0x28 pushes 0x3104 (the address after the opcode = the TABLE BASE); sub_0028
 * pops that, indexes table[A] from ROM, and dispatches. 0x6380 not interpreted.
 */
export function loc_30fa(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x6380);
  m.step(0x30fd, 13); // ld a,(0x6380)
  regs.cp(0x06);
  m.step(0x30ff, 7); // cp 0x06
  if (regs.fC) {
    m.step(0x3103, 12); // jr c,0x3103 TAKEN (A < 6) -- jr taken = 12
  } else {
    m.step(0x3101, 7); // jr c NOT taken -- jr not taken = 7
    regs.a = 0x05;
    m.step(0x3103, 7); // ld a,0x05 -- clamp
  }

  // rst 0x28 -- TAIL dispatch. Push the table base (0x3104); sub_0028 indexes it
  // and returns the selected guard's skip-boolean, which we pass straight up.
  m.push16(0x3104);
  m.step(0x0028, 11); // rst 0x28
  return m.call(0x0028, "0x3104 (loc_30fa dispatch)");
}
