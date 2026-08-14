// SPDX-License-Identifier: GPL-3.0-only

// loc_0000  (ROM 0x0000-0x0010) — the Z80 RESET vector: a dead self-check arm, a
// watchdog kick, then a tail-jump into the cold-boot init at 0x02a3.
export function loc_0000(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x4000);
  m.step(0x0003, 13); // ld a,(0x4000) -- unmapped, reads 0xFF (unmap_value_high)

  regs.cp(0x55);
  m.step(0x0005, 7); // cp 0x55 -- 0xFF != 0x55, so Z is never set

  if (regs.fZ) {
    // jp z,0x4001 -- DEAD arm aimed at non-code (0x4000 is unmapped=0xFF, never 0x55; 0x4001 outside ROM); throw if it fires
    throw new Error("loc_0000: jp z,0x4001 taken -- 0x4000 read as 0x55 (unmapped must be 0xFF)");
  }
  m.step(0x0008, 10);

  regs.a = mem.read8(0x8800);
  m.step(0x000b, 13); // ld a,(0x8800) -- watchdog reset_r (pets the dog)

  regs.sp = 0x8800;
  m.step(0x000e, 10);

  // jp 0x02a3 -- tail-jump into cold-boot init (pushes nothing; 0x02a3's flow is ours)
  m.step(0x02a3, 10);
  return m.call(0x02a3);
}
