// SPDX-License-Identifier: GPL-3.0-only
// loc_da0a  (ROM 0xda0a-0xda61) -- self-test ROM checksum + POKEY random-seed settle. Reached by
// loc_d8ca's `jmp 0xda0a` (the EAROM/POKEY walk falls here when its S-counter underflows). XORs the
// ROM banks at $3000 (8 pages -> $7d), $3800 (-> $7e), then $9000.. (-> $7f..$89), kicking the
// watchdog ($5000) each page; if the bank-0 checksum ($7d) is nonzero it sounds an error tone via
// POKEY ($60c4=0x40/$60c5=0xa4); then debounces the two POKEY random registers ($60ca -> $7a,
// $60da -> $7b) with a 5-retry settle loop each. Control then FALLS THROUGH to $da62 (`jsr $de11`,
// the first JSR -- outside this chunk), the non-terminating self-test tail; modeled as a tail-call.
// NOTE: byte-for-byte the same code is also translated INLINE in loc_d93f.js (the reset routine's
// self-test path); this file is the standalone re-entry point that loc_d8ca targets.
export function loc_da0a(m) {
  const { regs, mem } = m;
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xda0c, 2);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xda0d, 2);
  regs.x = regs.a; regs.setNZ(regs.x); m.step(0xda0e, 2);
  mem.write8(0x3b, regs.a); m.step(0xda10, 3);
  regs.a = 0x30; regs.setNZ(regs.a); m.step(0xda12, 2);
  mem.write8(0x3c, regs.a); m.step(0xda14, 3);
  // ----- bank-checksum outer loop (da14..da34): XOR each 8-page bank into $7d,x -----
  do {
    regs.a = 0x08; regs.setNZ(regs.a); m.step(0xda16, 2);
    mem.write8(0x38, regs.a); m.step(0xda18, 3);
    regs.a = regs.x; regs.setNZ(regs.a); m.step(0xda19, 2);
    do {
      do {
        { const ptr = mem.read8(0x3b) | (mem.read8(0x3c) << 8);
          const addr = (ptr + regs.y) & 0xffff;
          const cross = (ptr & 0xff00) !== (addr & 0xff00);
          regs.eor(mem.read8(addr)); m.step(0xda1b, 5 + (cross ? 1 : 0)); }
        regs.y = regs.inc8(regs.y); m.step(0xda1c, 2);
        if (regs.fNZ) { m.step(0xda19, 3); } else { m.step(0xda1e, 2); break; }
      } while (true);
      mem.write8(0x3c, regs.inc8(mem.read8(0x3c))); m.step(0xda20, 5);
      mem.write8(0x5000, regs.a); m.step(0xda23, 4);
      mem.write8(0x38, regs.dec8(mem.read8(0x38))); m.step(0xda25, 5);
      if (regs.fNZ) { m.step(0xda19, 3); } else { m.step(0xda27, 2); break; }
    } while (true);
    mem.write8((0x7d + regs.x) & 0xff, regs.a); m.step(0xda29, 4);
    regs.x = regs.inc8(regs.x); m.step(0xda2a, 2);
    regs.cpx(0x02); m.step(0xda2c, 2);
    if (regs.fNZ) { m.step(0xda32, 3); } else {
      m.step(0xda2e, 2);
      regs.a = 0x90; regs.setNZ(regs.a); m.step(0xda30, 2);
      mem.write8(0x3c, regs.a); m.step(0xda32, 3);
    }
    regs.cpx(0x0c); m.step(0xda34, 2);
    if (regs.fNC) { m.step(0xda14, 3); } else { m.step(0xda36, 2); break; }
  } while (true);
  regs.a = mem.read8(0x7d); regs.setNZ(regs.a); m.step(0xda38, 3);
  if (regs.fZ) { m.step(0xda44, 3); } else {
    m.step(0xda3a, 2);
    regs.a = 0x40; regs.setNZ(regs.a); m.step(0xda3c, 2);
    regs.x = 0xa4; regs.setNZ(regs.x); m.step(0xda3e, 2);
    mem.write8(0x60c4, regs.a); m.step(0xda41, 4);
    mem.write8(0x60c5, regs.x); m.step(0xda44, 4);
  }
  // ----- POKEY $60ca random-register settle -> $7a (5-retry) -----
  regs.x = 0x05; regs.setNZ(regs.x); m.step(0xda46, 2);
  regs.a = mem.read8(0x60ca); regs.setNZ(regs.a); m.step(0xda49, 4);
  let stable1 = true;
  do {
    regs.cmp(mem.read8(0x60ca)); m.step(0xda4c, 4);
    if (regs.fNZ) { m.step(0xda53, 3); stable1 = false; break; }
    m.step(0xda4e, 2);
    regs.x = regs.dec8(regs.x); m.step(0xda4f, 2);
    if (regs.fPl) { m.step(0xda49, 3); } else { m.step(0xda51, 2); break; }
  } while (true);
  if (stable1) { mem.write8(0x7a, regs.a); m.step(0xda53, 3); }
  // ----- POKEY $60da random-register settle -> $7b (5-retry) -----
  regs.x = 0x05; regs.setNZ(regs.x); m.step(0xda55, 2);
  regs.a = mem.read8(0x60da); regs.setNZ(regs.a); m.step(0xda58, 4);
  let stable2 = true;
  do {
    regs.cmp(mem.read8(0x60da)); m.step(0xda5b, 4);
    if (regs.fNZ) { m.step(0xda62, 3); stable2 = false; break; }
    m.step(0xda5d, 2);
    regs.x = regs.dec8(regs.x); m.step(0xda5e, 2);
    if (regs.fPl) { m.step(0xda58, 3); } else { m.step(0xda60, 2); break; }
  } while (true);
  if (stable2) { mem.write8(0x7b, regs.a); m.step(0xda62, 3); }
  // da62: falls through to `jsr $de11` -- the self-test tail, a separate not-yet-lifted chunk
  // (non-terminating). Both settle paths converge here; transfer control as a tail-call.
  return m.call(0xda62);
}
