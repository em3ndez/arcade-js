// SPDX-License-Identifier: GPL-3.0-only

// loc_7517  (ROM 0x7517-0x755c) -- dispatch state 1 (from loc_7442's table). Calls the 0x4381
// helper and ticks a frame counter (0x88b7), returning early until it reaches 0x1c; on that tick it
// steps a sub-phase (0x8920) and returns on the first pass. Otherwise it column-sums two 14-tile
// video-RAM strips (0x82bc and 0x86bc, stride -0x20) into DE and verifies E==0x4f / D==1 (a HUD
// check aborting to 0x43e1 / 0x462c); on success it advances (0x8921) to state 2 and tail-calls 0x0fb2.
export function loc_7517(m) {
  const { regs, mem } = m;

  m.push16(0x751a);
  m.step(0x4381, 17); // 7517  call 0x4381 (pattern A)
  m.call(0x4381);
  regs.hl = 0x88b7;
  m.step(0x751d, 10); // 751a  ld hl,0x88b7
  regs.incMem8(mem, regs.hl);
  m.step(0x751e, 11); // 751d  inc (hl)
  regs.a = mem.read8(regs.hl);
  m.step(0x751f, 7); // 751e  ld a,(hl)
  regs.cp(0x1c);
  m.step(0x7521, 7); // 751f  cp 0x1c
  if (regs.fNZ) { m.ret(11); return; } // 7521  ret nz -- counter not yet at 0x1c
  m.step(0x7522, 5); // 7521  ret nz (not taken)

  regs.hl = 0x8920;
  m.step(0x7525, 10); // 7522  ld hl,0x8920
  regs.a = mem.read8(regs.hl);
  m.step(0x7526, 7); // 7525  ld a,(hl)
  regs.incMem8(mem, regs.hl);
  m.step(0x7527, 11); // 7526  inc (hl)
  regs.and(regs.a);
  m.step(0x7528, 4); // 7527  and a -- test the pre-increment (0x8920)
  mem.write8(0x88b7, regs.a);
  m.step(0x752b, 13); // 7528  ld (0x88b7),a
  if (regs.fZ) { m.ret(11); return; } // 752b  ret z -- first pass, skip the HUD check
  m.step(0x752c, 5); // 752b  ret z (not taken)

  regs.hl = 0x82bc;
  m.step(0x752f, 10); // 752c  ld hl,0x82bc
  regs.de = 0x0000;
  m.step(0x7532, 10); // 752f  ld de,0x0000
  regs.c = 0x02;
  m.step(0x7534, 7); // 7532  ld c,0x02

  for (;;) { // outer strip loop (head 0x7534), C strips
    regs.b = 0x0e;
    m.step(0x7536, 7); // 7534  ld b,0x0e
    for (;;) { // inner column sum (head 0x7536), B tiles up the strip
      regs.a = mem.read8(regs.hl);
      m.step(0x7537, 7); // 7536  ld a,(hl)
      regs.add(regs.e);
      m.step(0x7538, 4); // 7537  add a,e
      regs.e = regs.a;
      m.step(0x7539, 4); // 7538  ld e,a
      if (regs.fNC) {
        m.step(0x753c, 12); // 7539  jr nc,0x753c
      } else {
        m.step(0x753b, 7); // 7539  jr nc (not taken)
        regs.d = regs.inc8(regs.d);
        m.step(0x753c, 4); // 753b  inc d -- carry into the high byte
      }
      regs.a = regs.l;
      m.step(0x753d, 4); // 753c  ld a,l
      regs.sub(0x20);
      m.step(0x753f, 7); // 753d  sub 0x20
      regs.l = regs.a;
      m.step(0x7540, 4); // 753f  ld l,a
      if (regs.fNC) {
        m.step(0x7543, 12); // 7540  jr nc,0x7543
      } else {
        m.step(0x7542, 7); // 7540  jr nc (not taken)
        regs.h = regs.dec8(regs.h);
        m.step(0x7543, 4); // 7542  dec h -- borrow, HL -= 0x20 across the page
      }
      if (regs.djnz() !== 0) { m.step(0x7536, 13); continue; } // 7543  djnz 0x7536
      m.step(0x7545, 8); break; // 7543  djnz (fell through)
    }
    regs.c = regs.dec8(regs.c);
    m.step(0x7546, 4); // 7545  dec c
    regs.hl = 0x86bc;
    m.step(0x7549, 10); // 7546  ld hl,0x86bc -- base of the second strip
    if (regs.fNZ) { m.step(0x7534, 12); continue; } // 7549  jr nz,0x7534
    m.step(0x754b, 7); break; // 7549  jr nz (fell through)
  }

  regs.a = regs.e;
  m.step(0x754c, 4); // 754b  ld a,e
  regs.cp(0x4f);
  m.step(0x754e, 7); // 754c  cp 0x4f
  if (regs.fNZ) { throw new Error("loc_7517: ROM-integrity/sanity trap 0x43e1 unreachable with a valid ROM"); } // 754e  jp nz,0x43e1
  m.step(0x7551, 10); // 754e  jp nz (not taken)
  regs.d = regs.dec8(regs.d);
  m.step(0x7552, 4); // 7551  dec d
  if (regs.fNZ) { throw new Error("loc_7517: ROM-integrity/sanity trap 0x462c unreachable with a valid ROM"); } // 7552  jp nz,0x462c
  m.step(0x7555, 10); // 7552  jp nz (not taken)
  regs.hl = 0x8921;
  m.step(0x7558, 10); // 7555  ld hl,0x8921
  regs.incMem8(mem, regs.hl);
  m.step(0x7559, 11); // 7558  inc (hl) -- advance selector to state 2
  m.push16(0x755c);
  m.step(0x0fb2, 17); // 7559  call 0x0fb2 (pattern A)
  m.call(0x0fb2);
  m.ret(); // 755c  ret
}
