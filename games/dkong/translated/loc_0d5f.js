// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0d5f  (ROM 0x0D5F–0x0DA6) — board-setup continuation: calls 0x0F56/0x2441/0x004E, seeds counters and copies the layout; board-4 arm at 0x0D8B.
 *
 *   0d5f  cd 56 0f     call 0x0f56
 *   0d62  cd 41 24     call 0x2441       ; entry_0d62
 *   0d65  21 09 60     ld   hl,0x6009    ; entry_0d65
 *   ...
 *
 * THREE ROUTINES MEET HERE: 0x0F56, 0x2441 and (at 0x0D6F) 0x004E.
 *
 * Note that 0x0F56 contains no `ret`, so whether control reaches 0x0D62 at all
 * was a question. It does -- see the note at sub_0f56's tail. The `rst 0x28`
 * consumes its own pushed continuation, not this call's.
 */
export function loc_0d5f(m) {
  const { regs, mem } = m;

  m.push16(0x0d62);
  m.step(0x0f56, 17);
  m.call(0x0f56);

  m.push16(0x0d65);
  m.step(0x2441, 17);
  m.call(0x2441);

  regs.hl = 0x6009;
  m.step(0x0d68, 10); // ld hl,0x6009
  mem.write8(regs.hl, 0x40);
  m.step(0x0d6a, 10); // ld (hl),0x40
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0d6b, 6); // inc hl
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));
  m.step(0x0d6c, 11); // inc (hl) -- read-modify-write, and it SETS FLAGS
  regs.hl = 0x385c;
  m.step(0x0d6f, 10); // ld hl,0x385c

  m.push16(0x0d72);
  m.step(0x004e, 17);
  m.call(0x004e);

  // HL IS LIVE ACROSS THAT CALL. sub_004e copies 0x28 bytes from the HL it
  // was handed and leaves HL at 0x385C + 0x28 = 0x3884, which is the source
  // the ldir below consumes -- only DE and BC are reloaded here. Hoisting or
  // re-deriving HL would be wrong, and nothing in this block says so locally.
  regs.de = 0x6900;
  m.step(0x0d75, 10); // ld de,0x6900
  regs.bc = 0x0008;
  m.step(0x0d78, 10); // ld bc,0x0008
  m.ldirAt(0x0d78, 0x0d7a);

  regs.a = mem.read8(0x6227);
  m.step(0x0d7d, 13); // ld a,(0x6227)
  regs.cp(0x04);
  m.step(0x0d7f, 7); // cp 0x04

  if (regs.fZ) {
    // 0x6227 == 4 -- the 100m RIVETS board setup arm (0x0D8B-0x0DA6). Transcribed
    // to make board 4 reachable. sub_003d / loc_0038
    // already exist; validated downstream by playing board 4 vs MAME.
    //   0d8b  21 08 69   ld hl,0x6908    0d8e  0e 44   ld c,0x44
    //   0d90  ff  rst 0x38               0d91  11 04 00 ld de,0x0004
    //   0d94  01 10 02   ld bc,0x0210    0d97  21 00 69 ld hl,0x6900
    //   0d9a  cd 3d 00   call 0x003d     0d9d  01 f8 02 ld bc,0x02f8
    //   0da0  21 03 69   ld hl,0x6903    0da3  cd 3d 00 call 0x003d   0da6  c9 ret
    m.step(0x0d8b, 12); // jr z,0x0d8b taken

    regs.hl = 0x6908;
    m.step(0x0d8e, 10); // ld hl,0x6908
    regs.c = 0x44;
    m.step(0x0d90, 7); // ld c,0x44
    m.push16(0x0d91);
    m.step(0x0038, 11); // rst 0x38
    m.call(0x0038);

    regs.de = 0x0004;
    m.step(0x0d94, 10); // ld de,0x0004
    regs.bc = 0x0210;
    m.step(0x0d97, 10); // ld bc,0x0210
    regs.hl = 0x6900;
    m.step(0x0d9a, 10); // ld hl,0x6900
    m.push16(0x0d9d);
    m.step(0x003d, 17); // call 0x003d
    m.call(0x003d);

    regs.bc = 0x02f8;
    m.step(0x0da0, 10); // ld bc,0x02f8
    regs.hl = 0x6903;
    m.step(0x0da3, 10); // ld hl,0x6903
    m.push16(0x0da6);
    m.step(0x003d, 17); // call 0x003d
    m.call(0x003d);

    m.ret(); // 0x0da6 -- returns to loc_0d5f's caller
    return;
  }

  m.step(0x0d81, 7); // jr z NOT taken -- 7 T, against 12 for the taken arm

  // TESTS BIT 1 OF A by rotating it into carry, the same idiom as the rst 0x30
  // handler at 0x0044 -- there the rotate count comes from memory, here it is a
  // fixed two.
  regs.rrca();
  m.step(0x0d82, 4); // rrca
  regs.rrca();
  m.step(0x0d83, 4); // rrca
  if (regs.fC) {
    m.ret(11); // ret c taken -- bit 1 of (0x6227) was set
    return;
  }
  m.step(0x0d84, 5); // ret c not taken

  regs.hl = 0x690b; // field +3 of the sprite record at 0x6908
  m.step(0x0d87, 10); // ld hl,0x690b
  regs.c = 0xfc; // -4 as a signed byte
  m.step(0x0d89, 7); // ld c,0xfc

  // `rst 0x38` is an 11 T call to 0x0038, and it pushes 0x0D8A like any call.
  // Modelled as a real push whose matching pop is sub_003d's `ret` -- stated
  // because the rst 0x28 dispatcher modelled the push and dropped the pop,
  // and that defect stayed invisible until a dispatched target first reached
  // a `ret`.
  m.push16(0x0d8a);
  m.step(0x0038, 11); // rst 0x38
  m.call(0x0038);

  m.ret(); // 0d8a
}
