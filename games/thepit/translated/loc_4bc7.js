// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4bc7  (ROM 0x4BC7–0x4BE9, The Pit) — initialises two work-RAM tables, then
 * tail-jumps to 0x4CCA. Loop 1 fills 0x8280..0x829F (0x20 bytes) with 0x24; loop 2
 * writes the 5-byte record [0x10,0x0A,0x16,0x00,0x00] three times from 0x8039
 * (0x8039..0x8047). No flags are touched by any instruction. (Role best-effort from
 * the code; addresses, values, counts and control flow are exact.)
 *
 *   4bc7  21 80 82     ld   hl,0x8280
 *   4bca  06 20        ld   b,0x20
 * loc_4bcc:
 *   4bcc  36 24        ld   (hl),0x24
 *   4bce  23           inc  hl
 *   4bcf  10 fb        djnz 0x4bcc
 *   4bd1  21 39 80     ld   hl,0x8039
 *   4bd4  06 03        ld   b,0x03
 * loc_4bd6:
 *   4bd6  36 10        ld   (hl),0x10
 *   4bd8  23           inc  hl
 *   4bd9  36 0a        ld   (hl),0x0a
 *   4bdb  23           inc  hl
 *   4bdc  36 16        ld   (hl),0x16
 *   4bde  23           inc  hl
 *   4bdf  36 00        ld   (hl),0x00
 *   4be1  23           inc  hl
 *   4be2  36 00        ld   (hl),0x00
 *   4be4  23           inc  hl
 *   4be5  10 ef        djnz 0x4bd6
 *   4be7  c3 ca 4c     jp   0x4cca
 *
 * `jp 0x4cca` is an unconditional tail-jump into another routine (0x4cca = loc_4cca,
 * also reached by `jp` from 0x4be7 and 0x4edf): nothing is pushed, so it is modelled
 * `m.step(0x4cca,10); return m.call(0x4cca)` -- 0x4cca's own `ret` pops OUR caller's
 * return address. `ld`, `inc hl` (16-bit, flagless) and `djnz` (flagless) leave F as
 * the caller held it, so F is not modelled here.
 */
export function loc_4bc7(m) {
  const { regs, mem } = m;

  // 4bc7  ld hl,0x8280 -- top of the 0x20-byte fill region
  regs.hl = 0x8280;
  m.step(0x4bca, 10);
  // 4bca  ld b,0x20 -- 32 iterations
  regs.b = 0x20;
  m.step(0x4bcc, 7);

  do {
    // loc_4bcc -- djnz targets here; write 0x24, advance one byte.
    mem.write8(regs.hl, 0x24); // ld (hl),0x24
    m.step(0x4bce, 10);
    regs.hl = (regs.hl + 1) & 0xffff; // inc hl (no flags)
    m.step(0x4bcf, 6);
    regs.djnz(); // dec b, no flags (that is why it is NOT dec8)
    m.step(regs.b !== 0 ? 0x4bcc : 0x4bd1, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  // 4bd1  ld hl,0x8039 -- base of the three 5-byte records
  regs.hl = 0x8039;
  m.step(0x4bd4, 10);
  // 4bd4  ld b,0x03 -- 3 records
  regs.b = 0x03;
  m.step(0x4bd6, 7);

  do {
    // loc_4bd6 -- djnz targets here; write one [0x10,0x0a,0x16,0x00,0x00] record.
    mem.write8(regs.hl, 0x10); // ld (hl),0x10
    m.step(0x4bd8, 10);
    regs.hl = (regs.hl + 1) & 0xffff; // inc hl
    m.step(0x4bd9, 6);
    mem.write8(regs.hl, 0x0a); // ld (hl),0x0a
    m.step(0x4bdb, 10);
    regs.hl = (regs.hl + 1) & 0xffff; // inc hl
    m.step(0x4bdc, 6);
    mem.write8(regs.hl, 0x16); // ld (hl),0x16
    m.step(0x4bde, 10);
    regs.hl = (regs.hl + 1) & 0xffff; // inc hl
    m.step(0x4bdf, 6);
    mem.write8(regs.hl, 0x00); // ld (hl),0x00
    m.step(0x4be1, 10);
    regs.hl = (regs.hl + 1) & 0xffff; // inc hl
    m.step(0x4be2, 6);
    mem.write8(regs.hl, 0x00); // ld (hl),0x00
    m.step(0x4be4, 10);
    regs.hl = (regs.hl + 1) & 0xffff; // inc hl
    m.step(0x4be5, 6);
    regs.djnz(); // dec b, no flags
    m.step(regs.b !== 0 ? 0x4bd6 : 0x4be7, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  // 4be7  jp 0x4cca -- unconditional tail-jump; 0x4cca's ret returns to OUR caller
  m.step(0x4cca, 10);
  return m.call(0x4cca);
}
