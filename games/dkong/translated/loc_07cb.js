// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_07cb  (ROM 0x07CB–0x084A) — ROUND-2 BATCH: per-frame countdown animation task.
 * (128 bytes). Dispatch-table handler (dw 0x07cb @0x0754, the 0x0748 task table --
 * same dispatch as handler_1977).
 * Reached only via the 0x0754 task-table dispatch.
 * Frame timer 0x638A / pattern 0x638B; on expiry finishes (0x6009=2, 0x600A++,
 * clears 0x638A/B); else decodes 2 pattern bits (rlc, CB-form) and table-driven
 * fills from 0x3D08, then queues tasks (sub_309f x2), repaints (sub_004e/sub_3f24),
 * and two rst-0x38 sound triggers. Fields not interpreted.
 */
export function loc_07cb(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x638a);
  m.step(0x07ce, 13); // ld a,(0x638a) -- frame timer
  regs.cp(0x00);
  m.step(0x07d0, 7); // cp 0x00
  if (regs.fNZ) {
    // loc_082d -- countdown frame
    m.step(0x082d, 10); // jp nz,0x082d
    regs.a = mem.read8(0x638b);
    m.step(0x0830, 13); // ld a,(0x638b)
    regs.c = regs.a;
    m.step(0x0831, 4); // ld c,a -- restore pattern
    regs.a = mem.read8(0x638a);
    m.step(0x0834, 13); // ld a,(0x638a)
    regs.a = regs.dec8(regs.a);
    m.step(0x0835, 4); // dec a
    mem.write8(0x638a, regs.a);
    m.step(0x0838, 13); // ld (0x638a),a
    m.step(0x07da, 10); // jp 0x07da -> body
  } else {
    m.step(0x07d3, 10); // jp nz NOT taken
    regs.a = 0x60;
    m.step(0x07d5, 7); // ld a,0x60
    mem.write8(0x638a, regs.a);
    m.step(0x07d8, 13); // ld (0x638a),a -- arm timer
    regs.c = 0x5f;
    m.step(0x07da, 7); // ld c,0x5f -- initial pattern
  }

  // loc_07da -- shared body (JOIN). A = timer, C = pattern.
  regs.cp(0x00);
  m.step(0x07dc, 7); // cp 0x00
  if (regs.fZ) {
    // loc_083b -- finish
    m.step(0x083b, 10); // jp z,0x083b
    regs.hl = 0x6009;
    m.step(0x083e, 10); // ld hl,0x6009
    mem.write8(regs.hl, 0x02);
    m.step(0x0840, 10); // ld (hl),0x02 -- 0x6009=2
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0841, 6); // inc hl -> 0x600a
    regs.incMem8(mem, regs.hl);
    m.step(0x0842, 11); // inc (hl) -- 0x600a++
    regs.hl = 0x638a;
    m.step(0x0845, 10); // ld hl,0x638a
    mem.write8(regs.hl, 0x00);
    m.step(0x0847, 10); // ld (hl),0x00 -- 0x638a=0
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0848, 6); // inc hl -> 0x638b
    mem.write8(regs.hl, 0x00);
    m.step(0x084a, 10); // ld (hl),0x00 -- 0x638b=0
    m.ret(); // 0x084a
    return;
  }
  m.step(0x07df, 10); // jp z NOT taken

  // decode 2 pattern bits into 0x7d86 / 0x7d87
  regs.hl = 0x7d86;
  m.step(0x07e2, 10); // ld hl,0x7d86
  mem.write8(regs.hl, 0x00);
  m.step(0x07e4, 10); // ld (hl),0x00
  regs.a = regs.c;
  m.step(0x07e5, 4); // ld a,c
  regs.a = regs.rlc(regs.a);
  m.step(0x07e7, 8); // rlc a -- CB-form
  if (regs.fC) {
    m.step(0x07e9, 7); // jr nc NOT taken
    mem.write8(regs.hl, 0x01);
    m.step(0x07eb, 10); // ld (hl),0x01
  } else {
    m.step(0x07eb, 12); // jr nc taken
  }
  // loc_07eb
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x07ec, 6); // inc hl -> 0x7d87
  mem.write8(regs.hl, 0x00);
  m.step(0x07ee, 10); // ld (hl),0x00
  regs.a = regs.rlc(regs.a);
  m.step(0x07f0, 8); // rlc a -- second bit
  if (regs.fC) {
    m.step(0x07f2, 7); // jr nc NOT taken
    mem.write8(regs.hl, 0x01);
    m.step(0x07f4, 10); // ld (hl),0x01
  } else {
    m.step(0x07f4, 12); // jr nc taken
  }
  // loc_07f4
  mem.write8(0x638b, regs.a);
  m.step(0x07f7, 13); // ld (0x638b),a -- save rotated pattern
  regs.hl = 0x3d08;
  m.step(0x07fa, 10); // ld hl,0x3d08 -- fill table

  // table-driven fill: outer over records, inner djnz block-fill
  do {
    regs.a = 0xb0;
    m.step(0x07fc, 7); // ld a,0xb0
    regs.b = mem.read8(regs.hl);
    m.step(0x07fd, 7); // ld b,(hl) -- count
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x07fe, 6); // inc hl
    regs.e = mem.read8(regs.hl);
    m.step(0x07ff, 7); // ld e,(hl) -- dest lo
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0800, 6); // inc hl
    regs.d = mem.read8(regs.hl);
    m.step(0x0801, 7); // ld d,(hl) -- dest hi
    // loc_0801 inner block-fill
    do {
      mem.write8(regs.de, regs.a);
      m.step(0x0802, 7); // ld (de),a
      regs.de = (regs.de + 1) & 0xffff;
      m.step(0x0803, 6); // inc de
      regs.b = (regs.b - 1) & 0xff; // djnz
      m.step(regs.b !== 0 ? 0x0801 : 0x0805, regs.b !== 0 ? 13 : 8);
    } while (regs.b !== 0);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0806, 6); // inc hl
    regs.a = mem.read8(regs.hl);
    m.step(0x0807, 7); // ld a,(hl) -- next count
    regs.cp(0x00);
    m.step(0x0809, 7); // cp 0x00
    m.step(regs.fNZ ? 0x07fa : 0x080c, 10); // jp nz,0x07fa
  } while (regs.fNZ);

  // 0x080c -- queue tasks, repaint, sprite-field nudges
  regs.de = 0x031e;
  m.step(0x080f, 10); // ld de,0x031e
  m.push16(0x0812);
  m.step(0x309f, 17); // call 0x309f -- queue task 0x031E
  m.call(0x309f);
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x0813, 6); // inc de
  m.push16(0x0816);
  m.step(0x309f, 17); // call 0x309f -- queue task 0x031F
  m.call(0x309f);
  regs.hl = 0x39cf;
  m.step(0x0819, 10); // ld hl,0x39cf
  m.push16(0x081c);
  m.step(0x004e, 17); // call 0x004e -- repaint
  m.call(0x004e);
  m.push16(0x081f);
  m.step(0x3f24, 17); // call 0x3f24
  m.call(0x3f24);
  m.step(0x0820, 4); // nop
  regs.hl = 0x6908;
  m.step(0x0823, 10); // ld hl,0x6908
  regs.c = 0x44;
  m.step(0x0825, 7); // ld c,0x44
  m.push16(0x0826);
  m.step(0x0038, 11); // rst 0x38
  m.call(0x0038);
  regs.hl = 0x690b;
  m.step(0x0829, 10); // ld hl,0x690b
  regs.c = 0x78;
  m.step(0x082b, 7); // ld c,0x78
  m.push16(0x082c);
  m.step(0x0038, 11); // rst 0x38
  m.call(0x0038);
  m.ret(); // 0x082c
}
