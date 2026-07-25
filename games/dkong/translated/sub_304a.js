// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_304a  (ROM 0x304A–0x3063) — 26 bytes, 11 instructions.
 *
 *   304a  11 e0 ff     ld   de,0xffe0     ; DE = -0x20 (two's complement)
 *   304d  3a 8e 63     ld   a,(0x638e)    ; A = the index at 0x638E
 *   3050  4f           ld   c,a
 *   3051  06 00        ld   b,0x00        ; BC = A (0..255), B forced to 0
 *   3053  21 00 76     ld   hl,0x7600
 *   3056  cd 64 30     call 0x3064        ; copy (0x7600+BC) -> (0x7600+BC-0x20)
 *   3059  21 c0 75     ld   hl,0x75c0
 *   305c  cd 64 30     call 0x3064        ; copy (0x75C0+BC) -> (0x75C0+BC-0x20)
 *   305f  21 8e 63     ld   hl,0x638e
 *   3062  35           dec  (hl)          ; index at 0x638E -= 1
 *   3063  c9           ret
 *
 * Its
 * callers (0x0AF0 `call z`, 0x0B38 `call`) live in an untranslated routine, and
 * nothing in translated src references 0x304A -- so this function is dormant and
 * adding it is not yet wired into the live dispatcher.
 *
 * NO live-in registers: DE, A, C, B, HL are all set before any read (A from
 * memory). Straight-line, no branch, one unconditional ret.
 *
 * WHAT IT DOES (mechanism; 0x638E's meaning not named): loads the index at
 * 0x638E into BC (B=0), then calls sub_3064 twice to copy one byte each from
 * 0x7600+BC and 0x75C0+BC to 0x20 bytes LOWER, then decrements the index.
 *   - `ld de,0xffe0` is -0x20: sub_3064's `add hl,de` is a 16-bit add that wraps
 *     (0x7600+BC+0xFFE0 = 0x7600+BC-0x20). A naive `de = 0x0020` (reading it as a
 *     +32 forward stride) would write 0x20 too HIGH -- the discriminating hazard.
 *   - 0x75A0-0x7600 is VIDEO RAM (0x7400-0x77FF); 0x20 = one 32-col tilemap row,
 *     so each copy moves a cell one row. Stated as fact, not as purpose.
 *   - sub_3064 preserves BC and DE (touches only HL, A, flags), so the second
 *     call correctly reuses BC=index and DE=-0x20 set once at the top. This is a
 *     real cross-call dependency; it holds because sub_3064 never writes BC/DE.
 *   - `dec (hl)` at 0x638E is a work-RAM RMW; its flags escape to the caller
 *     (ret is unconditional), a live-out this unit cannot resolve (untranslated
 *     callers) -- dec8 sets them faithfully regardless (cf. entry_3009's carry).
 */
export function sub_304a(m) {
  const { regs, mem } = m;

  regs.de = 0xffe0; // -0x20; sub_3064's `add hl,de` subtracts 0x20 via wrap
  m.step(0x304d, 10); // ld de,0xffe0
  regs.a = mem.read8(0x638e);
  m.step(0x3050, 13); // ld a,(0x638e)
  regs.c = regs.a;
  m.step(0x3051, 4); // ld c,a
  regs.b = 0x00; // BC = the index, B forced to 0
  m.step(0x3053, 7); // ld b,0x00
  regs.hl = 0x7600;
  m.step(0x3056, 10); // ld hl,0x7600

  m.push16(0x3059); // call 0x3064 -- real call, sub_3064 rets back to 0x3059
  m.step(0x3064, 17);
  m.call(0x3064); // preserves BC and DE

  regs.hl = 0x75c0;
  m.step(0x305c, 10); // ld hl,0x75c0

  m.push16(0x305f); // call 0x3064 -- reuses BC and DE preserved across the first
  m.step(0x3064, 17);
  m.call(0x3064);

  regs.hl = 0x638e;
  m.step(0x3062, 10); // ld hl,0x638e
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)), 8); // dec (hl) -- RMW, work RAM
  m.step(0x3063, 11); // dec (hl)

  m.ret(); // 3063
}
