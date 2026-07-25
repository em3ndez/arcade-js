// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_4816  (ROM 0x4816-0x4839) — draws one HUD strip: sets the column/row cursor
 * (0x8058=0x01 col, 0x8059=0x0b row), resolves that cell's screen offset and its
 * colour/video-RAM addresses (sub_3dae, sub_3dc9), then fills a 0x0a-cell vertical
 * strip from the ROM table at 0x494f (fill byte 0x8057=0x00, count 0x8055=0x0a via
 * sub_3ddb) and TAIL-JUMPS into sub_3e01 to paint the paired colour column.
 *
 *   4816  3e 01        ld   a,0x01
 *   4818  32 58 80     ld   (0x8058),a      ; column = 1
 *   481b  3e 0b        ld   a,0x0b
 *   481d  32 59 80     ld   (0x8059),a      ; row = 0x0b
 *   4820  cd ae 3d     call 0x3dae          ; row/col -> tile offset @0x805a
 *   4823  cd c9 3d     call 0x3dc9          ; offset -> colour/video addrs @0x805e/0x8060
 *   4826  3e 00        ld   a,0x00
 *   4828  32 57 80     ld   (0x8057),a      ; fill byte = 0x00
 *   482b  3e 0a        ld   a,0x0a
 *   482d  32 55 80     ld   (0x8055),a      ; strip height = 0x0a
 *   4830  dd 21 4f 49  ld   ix,0x494f       ; source table (walked by sub_3ddb)
 *   4834  cd db 3d     call 0x3ddb          ; fill the tilemap strip
 *   4837  c3 01 3e     jp   0x3e01          ; TAIL into sub_3e01 (fill colour column)
 *
 * Returns via sub_3e01's own `ret`: the closing `jp 0x3e01` pushes nothing, so
 * sub_3e01's `ret` pops sub_4816's caller and returns there. The three earlier
 * `call`s are ordinary returning calls (stack balanced). No flags are read across
 * the boundary — the routine is pure setup-and-paint.
 */
export function sub_4816(m) {
  const { regs, mem } = m;

  regs.a = 0x01;
  m.step(0x4818, 7); // 4816  ld a,0x01

  mem.write8(0x8058, regs.a);
  m.step(0x481b, 13); // 4818  ld (0x8058),a -- column

  regs.a = 0x0b;
  m.step(0x481d, 7); // 481b  ld a,0x0b

  mem.write8(0x8059, regs.a);
  m.step(0x4820, 13); // 481d  ld (0x8059),a -- row

  m.push16(0x4823);
  m.step(0x3dae, 17); // 4820  call 0x3dae -- tile offset @0x805a
  m.call(0x3dae);

  m.push16(0x4826);
  m.step(0x3dc9, 17); // 4823  call 0x3dc9 -- colour/video addrs @0x805e/0x8060
  m.call(0x3dc9);

  regs.a = 0x00;
  m.step(0x4828, 7); // 4826  ld a,0x00

  mem.write8(0x8057, regs.a);
  m.step(0x482b, 13); // 4828  ld (0x8057),a -- fill byte

  regs.a = 0x0a;
  m.step(0x482d, 7); // 482b  ld a,0x0a

  mem.write8(0x8055, regs.a);
  m.step(0x4830, 13); // 482d  ld (0x8055),a -- strip height

  regs.ix = 0x494f;
  m.step(0x4834, 14); // 4830  ld ix,0x494f -- source table

  m.push16(0x4837);
  m.step(0x3ddb, 17); // 4834  call 0x3ddb -- fill the tilemap strip
  m.call(0x3ddb);

  // 4837  jp 0x3e01 -- TAIL into sub_3e01; no push, so sub_3e01's ret returns
  // to sub_4816's caller.
  m.step(0x3e01, 10);
  return m.call(0x3e01);
}
