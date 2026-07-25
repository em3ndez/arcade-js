// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_23e8  (ROM 0x23E8–0x241B) — seeds a tilemap pointer + a countdown, conditionally
 * pokes one tile via 0x4CA3, then (if the head cell is 0xFE) patches two VRAM cells.
 *
 *   23e8  21 04 91     ld   hl,0x9104
 *   23eb  22 65 80     ld   (0x8065),hl        ; save the tilemap pointer
 *   23ee  3a 28 80     ld   a,(0x8028)
 *   23f1  cb 27        sla  a
 *   23f3  cb 27        sla  a                   ; a = 4 * (0x8028)
 *   23f5  47           ld   b,a
 *   23f6  3a 4f 80     ld   a,(0x804f)
 *   23f9  90           sub  b                   ; a = (0x804f) - 4*(0x8028)
 *   23fa  32 67 80     ld   (0x8067),a          ; store the countdown
 *   23fd  dd 21 64 92  ld   ix,0x9264
 *   2401  dd 7e 00     ld   a,(ix+0x00)         ; tile at 0x9264
 *   2404  fe 32        cp   0x32
 *   2406  cc a3 4c     call z,0x4ca3            ; only when that tile == 0x32
 *   2409  dd 21 e4 90  ld   ix,0x90e4
 *   240d  dd 7e 00     ld   a,(ix+0x00)         ; tile at 0x90e4
 *   2410  fe fe        cp   0xfe
 *   2412  c0           ret  nz                  ; head cell not 0xFE -> done
 *   2413  dd 36 00 ae  ld   (ix+0x00),0xae      ; 0x90e4 = 0xAE
 *   2417  dd 36 e0 ac  ld   (ix-0x20),0xac      ; 0x90C4 = 0xAC
 *   241b  c9           ret
 */
export function loc_23e8(m) {
  const { regs, mem } = m;

  regs.hl = 0x9104;
  m.step(0x23eb, 10); // ld hl,0x9104
  mem.write16(0x8065, regs.hl);
  m.step(0x23ee, 16); // ld (0x8065),hl
  regs.a = mem.read8(0x8028);
  m.step(0x23f1, 13); // ld a,(0x8028)
  regs.a = regs.sla(regs.a);
  m.step(0x23f3, 8); // sla a
  regs.a = regs.sla(regs.a);
  m.step(0x23f5, 8); // sla a -- a = 4*(0x8028)
  regs.b = regs.a;
  m.step(0x23f6, 4); // ld b,a
  regs.a = mem.read8(0x804f);
  m.step(0x23f9, 13); // ld a,(0x804f)
  regs.sub(regs.b);
  m.step(0x23fa, 4); // sub b
  mem.write8(0x8067, regs.a);
  m.step(0x23fd, 13); // ld (0x8067),a

  regs.ix = 0x9264;
  m.step(0x2401, 14); // ld ix,0x9264
  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
  m.step(0x2404, 19); // ld a,(ix+0x00)
  regs.cp(0x32);
  m.step(0x2406, 7); // cp 0x32
  if (regs.fZ) {
    m.push16(0x2409); // call z,0x4ca3 taken -- return addr = 0x2409
    m.step(0x4ca3, 17);
    m.call(0x4ca3);
  } else {
    m.step(0x2409, 10); // call z NOT taken
  }

  regs.ix = 0x90e4;
  m.step(0x240d, 14); // ld ix,0x90e4
  regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
  m.step(0x2410, 19); // ld a,(ix+0x00)
  regs.cp(0xfe);
  m.step(0x2412, 7); // cp 0xfe
  if (regs.fNZ) {
    m.ret(11); // ret nz -- head cell != 0xFE, done
    return;
  }
  m.step(0x2413, 5); // ret nz NOT taken

  mem.write8((regs.ix + 0x00) & 0xffff, 0xae); // ld (ix+0x00),0xae -> 0x90E4
  m.step(0x2417, 19);
  mem.write8((regs.ix - 0x20) & 0xffff, 0xac); // ld (ix-0x20),0xac -> 0x90C4
  m.step(0x241b, 19);
  m.ret(10); // ret (0x241B)
}
