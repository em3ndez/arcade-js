// SPDX-License-Identifier: GPL-3.0-only

// loc_4381  (ROM 0x4381-0x43e0) -- display-list interpreter.
// Reads a stream pointer pair: destination HL and source DE come from (0x8f43)/(0x8f45) when
// (0x8920)==0, else from (0x88b8)/(0x88ba). Up to B=0x1d bytes are copied source->dest; a source
// byte of 0x10 is a "skip C" opcode (advance dest by C, shrink the remaining count by C) and 0xff
// is a "reload dest + add byte to (0x88b7)" opcode. On exit the advanced HL/DE pointers are written
// back to the same pair selected on entry. Two `ret` exits; fully self-contained (no calls).
// The data it walks (0x43e1-0x4a0a) is the display-list table, not code. Bytes == disasm; entry
// PC + boundaries cross-checked vs scratchpad/pooyan-execpcs.txt (executed 0x4381-0x43df in attract).
export function loc_4381(m) {
  const { regs, mem } = m;

  regs.b = 0x1d;
  m.step(0x4383, 7); // 4381  ld b,0x1d
  regs.a = mem.read8(0x8920);
  m.step(0x4386, 13); // 4383  ld a,(0x8920)
  regs.hl = mem.read16(0x8f43);
  m.step(0x4389, 16); // 4386  ld hl,(0x8f43)
  regs.de = mem.read16(0x8f45);
  m.step(0x438d, 20); // 4389  ld de,(0x8f45)
  regs.and(regs.a);
  m.step(0x438e, 4); // 438d  and a
  if (regs.fZ) {
    m.step(0x4397, 12); // 438e  jr z,0x4397 (use 0x8f43/0x8f45 pair)
  } else {
    m.step(0x4390, 7);
    regs.hl = mem.read16(0x88b8);
    m.step(0x4393, 16); // 4390  ld hl,(0x88b8)
    regs.de = mem.read16(0x88ba);
    m.step(0x4397, 20); // 4393  ld de,(0x88ba)
  }

  // toStore true == cmd 0xff jumped straight to store_ptrs (0x43a8), skipping after_loop's inc hl x3.
  let toStore = false;
  for (;;) {
    // 4397  loop_top
    regs.a = mem.read8(regs.de);
    m.step(0x4398, 7); // 4397  ld a,(de)
    regs.cp(0x10);
    m.step(0x439a, 7); // 4398  cp 0x10
    if (regs.fZ) {
      m.step(0x43be, 12); // 439a  jr z,0x43be (cmd: skip C)
      regs.de = (regs.de + 1) & 0xffff;
      m.step(0x43bf, 6); // 43be  inc de
      regs.a = mem.read8(regs.de);
      m.step(0x43c0, 7); // 43bf  ld a,(de)
      regs.c = regs.a;
      m.step(0x43c1, 4); // 43c0  ld c,a
      regs.add(regs.l);
      m.step(0x43c2, 4); // 43c1  add a,l
      if (regs.fC) {
        m.step(0x43c4, 7); // 43c2  jr nc (not taken)
        regs.h = regs.inc8(regs.h);
        m.step(0x43c5, 4); // 43c4  inc h
      } else {
        m.step(0x43c5, 12); // 43c2  jr nc,0x43c5 (taken)
      }
      regs.l = regs.a;
      m.step(0x43c6, 4); // 43c5  ld l,a
      regs.de = (regs.de + 1) & 0xffff;
      m.step(0x43c7, 6); // 43c6  inc de
      regs.a = regs.b;
      m.step(0x43c8, 4); // 43c7  ld a,b
      regs.sub(regs.c);
      m.step(0x43c9, 4); // 43c8  sub c
      regs.b = regs.a;
      m.step(0x43ca, 4); // 43c9  ld b,a
      if (regs.fNZ) {
        m.step(0x4397, 12); // 43ca  jr nz,0x4397 (more to copy)
        continue;
      }
      m.step(0x43cc, 7); // 43ca  jr nz (not taken)
      m.step(0x43a5, 12); // 43cc  jr 0x43a5 (after_loop)
      break;
    }
    m.step(0x439c, 7); // 439a  jr z (not taken)
    regs.cp(0xff);
    m.step(0x439e, 7); // 439c  cp 0xff
    if (regs.fZ) {
      m.step(0x43ce, 12); // 439e  jr z,0x43ce (cmd: reload dest)
      regs.de = (regs.de + 1) & 0xffff;
      m.step(0x43cf, 6); // 43ce  inc de
      regs.a = mem.read8(regs.de);
      m.step(0x43d0, 7); // 43cf  ld a,(de)
      regs.l = regs.a;
      m.step(0x43d1, 4); // 43d0  ld l,a
      regs.de = (regs.de + 1) & 0xffff;
      m.step(0x43d2, 6); // 43d1  inc de
      regs.a = mem.read8(regs.de);
      m.step(0x43d3, 7); // 43d2  ld a,(de)
      regs.h = regs.a;
      m.step(0x43d4, 4); // 43d3  ld h,a
      regs.de = (regs.de + 1) & 0xffff;
      m.step(0x43d5, 6); // 43d4  inc de
      regs.a = mem.read8(regs.de);
      m.step(0x43d6, 7); // 43d5  ld a,(de)
      regs.c = regs.a;
      m.step(0x43d7, 4); // 43d6  ld c,a
      regs.a = mem.read8(0x88b7);
      m.step(0x43da, 13); // 43d7  ld a,(0x88b7)
      regs.add(regs.c);
      m.step(0x43db, 4); // 43da  add a,c
      mem.write8(0x88b7, regs.a);
      m.step(0x43de, 13); // 43db  ld (0x88b7),a
      regs.de = (regs.de + 1) & 0xffff;
      m.step(0x43df, 6); // 43de  inc de
      m.step(0x43a8, 12); // 43df  jr 0x43a8 (store_ptrs)
      toStore = true;
      break;
    }
    m.step(0x43a0, 7); // 439e  jr z (not taken) -- literal copy
    mem.write8(regs.hl, regs.a);
    m.step(0x43a1, 7); // 43a0  ld (hl),a
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x43a2, 6); // 43a1  inc de
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x43a3, 6); // 43a2  inc hl
    if (regs.djnz() !== 0) {
      m.step(0x4397, 13); // 43a3  djnz 0x4397
      continue;
    }
    m.step(0x43a5, 8); // 43a3  djnz (not taken)
    break;
  }

  if (!toStore) {
    // 43a5  after_loop
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x43a6, 6); // 43a5  inc hl
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x43a7, 6); // 43a6  inc hl
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x43a8, 6); // 43a7  inc hl
  }

  // 43a8  store_ptrs -- write the advanced HL/DE back to whichever pair was chosen on entry.
  regs.a = mem.read8(0x8920);
  m.step(0x43ab, 13); // 43a8  ld a,(0x8920)
  regs.and(regs.a);
  m.step(0x43ac, 4); // 43ab  and a
  if (regs.fNZ) {
    m.step(0x43b6, 12); // 43ac  jr nz,0x43b6
    mem.write16(0x88b8, regs.hl);
    m.step(0x43b9, 16); // 43b6  ld (0x88b8),hl
    mem.write16(0x88ba, regs.de);
    m.step(0x43bd, 20); // 43b9  ld (0x88ba),de
    m.ret(); // 43bd  ret
    return;
  }
  m.step(0x43ae, 7); // 43ac  jr nz (not taken)
  mem.write16(0x8f43, regs.hl);
  m.step(0x43b1, 16); // 43ae  ld (0x8f43),hl
  mem.write16(0x8f45, regs.de);
  m.step(0x43b5, 20); // 43b1  ld (0x8f45),de
  m.ret(); // 43b5  ret
}
