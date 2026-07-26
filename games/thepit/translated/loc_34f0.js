// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_34f0  (ROM 0x34F0-0x34FD, The Pit) — periodic refresh: pulls a fresh
 * pseudo-random byte from the LFSR (loc_4b1a), forces bit 7 set, stashes it at
 * 0x808b, then arms the state/timer byte 0x8084 to 0x09.
 *
 * Reached from loc_34da's once-per-256 tick wrap (`jr z,0x34f0`), i.e. every
 * 256 calls. loc_4b1a advances the 16-bit LFSR at 0x800d/0x800e and returns its
 * new LOW byte in A; `or 0x80` guarantees the stored value's bit 7 is set (so
 * 0x808b is always in 0x80..0xFF), and 0x8084 is reset to a fixed 0x09 to
 * re-arm whatever consumes it. Both stores are to work RAM (0x8000-0x87FF), so
 * neither needs a hardware write-bus offset.
 *
 *   34f0  cd 1a 4b     call 0x4b1a       ; A = new LFSR low byte
 *   34f3  f6 80        or   0x80         ; force bit 7 -> A in 0x80..0xFF
 *   34f5  32 8b 80     ld   (0x808b),a   ; store the masked random byte
 *   34f8  3e 09        ld   a,0x09
 *   34fa  32 84 80     ld   (0x8084),a   ; re-arm the state/timer byte to 9
 *   34fd  c9           ret
 *
 * The `or 0x80` flags (S set, Z clear, PV/H/N/C per the result) fall out of the
 * z80.js `or` helper and are not consumed here — `ret` reads no flags. The CALL
 * is a normal mid-routine call: it returns to 0x34f3 and execution continues,
 * so it is m.push16(return)/m.step(target,17)/m.call(target), NOT a tail-jump.
 */
export function loc_34f0(m) {
  const { regs, mem } = m;

  m.push16(0x34f3); // 34f0  call 0x4b1a -- return addr 0x34f3; callee returns the new LFSR low byte in A
  m.step(0x4b1a, 17);
  m.call(0x4b1a);
  regs.or(0x80); // 34f3  or 0x80 -- force bit 7 set on the returned byte
  m.step(0x34f5, 7);
  mem.write8(0x808b, regs.a); // 34f5  ld (0x808b),a -- store the masked random byte (work RAM, no bus offset)
  m.step(0x34f8, 13);
  regs.a = 0x09; // 34f8  ld a,0x09
  m.step(0x34fa, 7);
  mem.write8(0x8084, regs.a); // 34fa  ld (0x8084),a -- re-arm the state/timer byte
  m.step(0x34fd, 13);
  m.ret(); // 34fd  ret
}
