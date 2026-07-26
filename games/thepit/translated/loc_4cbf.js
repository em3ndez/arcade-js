// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4cbf  (ROM 0x4cbf–0x4d09, then falls through into loc_4d0c) — rebuilds the
 * numeric readout buffers: clears the flag at 0x8048, refreshes the active
 * player's shared block (call 0x4644), clamps/compares via loc_4d3a, then formats
 * three 3-byte source records into the display cells at 0x8283 / 0x828c / 0x8295.
 *
 *   4cbf  3e 00        ld   a,0x00
 *   4cc1  32 48 80     ld   (0x8048),a
 *   4cc4  cd 44 46     call 0x4644
 *   4cc7  cd 3a 4d     call 0x4d3a
 *
 *   4cca  11 83 82     ld   de,0x8283       ; loc_4cca
 *   4ccd  21 39 80     ld   hl,0x8039
 *   4cd0  01 03 00     ld   bc,0x0003
 *   4cd3  ed b0        ldir                 ; copy 0x8039..0x803b -> 0x8283
 *   4cd5  2a 3c 80     ld   hl,(0x803c)
 *   4cd8  22 37 80     ld   (0x8037),hl
 *   4cdb  21 86 82     ld   hl,0x8286
 *   4cde  cd 0c 4d     call 0x4d0c          ; format into cells at 0x8286
 *   4ce1  11 8c 82     ld   de,0x828c
 *   4ce4  21 3e 80     ld   hl,0x803e
 *   4ce7  01 03 00     ld   bc,0x0003
 *   4cea  ed b0        ldir                 ; copy 0x803e..0x8040 -> 0x828c
 *   4cec  2a 41 80     ld   hl,(0x8041)
 *   4cef  22 37 80     ld   (0x8037),hl
 *   4cf2  21 8f 82     ld   hl,0x828f
 *   4cf5  cd 0c 4d     call 0x4d0c          ; format into cells at 0x828f
 *   4cf8  11 95 82     ld   de,0x8295
 *   4cfb  21 43 80     ld   hl,0x8043
 *   4cfe  01 03 00     ld   bc,0x0003
 *   4d01  ed b0        ldir                 ; copy 0x8043..0x8045 -> 0x8295
 *   4d03  2a 46 80     ld   hl,(0x8046)
 *   4d06  22 37 80     ld   (0x8037),hl
 *   4d09  21 98 82     ld   hl,0x8298       ; --> falls through into loc_4d0c
 *
 * The `ld (0x8037),hl` stores a 16-bit value into 0x8037/0x8038, which loc_4d0c
 * then reads (0x8038 = high byte, 0x8037 = low byte) and splits into four nibble
 * "digit" cells plus two trailing zeros at the pointer HL. Each of the three
 * records supplies a 3-byte block (copied verbatim by the ldir) and a 16-bit
 * value (from 0x803c / 0x8041 / 0x8046). The THIRD format call is reached by
 * fall-through, not `call`: after `ld hl,0x8298` PC is already at loc_4d0c, whose
 * final `ret` returns to loc_4cbf's OWN caller — so it is modelled as a tail-call
 * (m.call with NO push and NO trailing ret; a second ret would double-pop).
 */
export function loc_4cbf(m) {
  const { regs, mem } = m;

  regs.a = 0x00;
  m.step(0x4cc1, 7); // 4cbf  ld a,0x00

  mem.write8(0x8048, regs.a);
  m.step(0x4cc4, 13); // 4cc1  ld (0x8048),a

  m.push16(0x4cc7);
  m.step(0x4644, 17); // 4cc4  call 0x4644
  m.call(0x4644);

  m.push16(0x4cca);
  m.step(0x4d3a, 17); // 4cc7  call 0x4d3a
  m.call(0x4d3a);

  // loc_4cca -- record 1: block 0x8039->0x8283, value (0x803c) -> cells at 0x8286
  regs.de = 0x8283;
  m.step(0x4ccd, 10); // 4cca  ld de,0x8283

  regs.hl = 0x8039;
  m.step(0x4cd0, 10); // 4ccd  ld hl,0x8039

  regs.bc = 0x0003;
  m.step(0x4cd3, 10); // 4cd0  ld bc,0x0003

  m.ldirAt(0x4cd3, 0x4cd5); // 4cd3  ldir -- 3-byte block copy

  regs.hl = mem.read16(0x803c);
  m.step(0x4cd8, 16); // 4cd5  ld hl,(0x803c)

  mem.write16(0x8037, regs.hl);
  m.step(0x4cdb, 16); // 4cd8  ld (0x8037),hl

  regs.hl = 0x8286;
  m.step(0x4cde, 10); // 4cdb  ld hl,0x8286

  m.push16(0x4ce1);
  m.step(0x4d0c, 17); // 4cde  call 0x4d0c
  m.call(0x4d0c);

  // record 2: block 0x803e->0x828c, value (0x8041) -> cells at 0x828f
  regs.de = 0x828c;
  m.step(0x4ce4, 10); // 4ce1  ld de,0x828c

  regs.hl = 0x803e;
  m.step(0x4ce7, 10); // 4ce4  ld hl,0x803e

  regs.bc = 0x0003;
  m.step(0x4cea, 10); // 4ce7  ld bc,0x0003

  m.ldirAt(0x4cea, 0x4cec); // 4cea  ldir -- 3-byte block copy

  regs.hl = mem.read16(0x8041);
  m.step(0x4cef, 16); // 4cec  ld hl,(0x8041)

  mem.write16(0x8037, regs.hl);
  m.step(0x4cf2, 16); // 4cef  ld (0x8037),hl

  regs.hl = 0x828f;
  m.step(0x4cf5, 10); // 4cf2  ld hl,0x828f

  m.push16(0x4cf8);
  m.step(0x4d0c, 17); // 4cf5  call 0x4d0c
  m.call(0x4d0c);

  // record 3: block 0x8043->0x8295, value (0x8046) -> cells at 0x8298 (fall-through)
  regs.de = 0x8295;
  m.step(0x4cfb, 10); // 4cf8  ld de,0x8295

  regs.hl = 0x8043;
  m.step(0x4cfe, 10); // 4cfb  ld hl,0x8043

  regs.bc = 0x0003;
  m.step(0x4d01, 10); // 4cfe  ld bc,0x0003

  m.ldirAt(0x4d01, 0x4d03); // 4d01  ldir -- 3-byte block copy

  regs.hl = mem.read16(0x8046);
  m.step(0x4d06, 16); // 4d03  ld hl,(0x8046)

  mem.write16(0x8037, regs.hl);
  m.step(0x4d09, 16); // 4d06  ld (0x8037),hl

  regs.hl = 0x8298;
  m.step(0x4d0c, 10); // 4d09  ld hl,0x8298 -- PC now at loc_4d0c

  // Fall through into loc_4d0c: its ret returns to loc_4cbf's caller. Tail-call
  // idiom -- no push, no trailing m.ret.
  return m.call(0x4d0c);
}
