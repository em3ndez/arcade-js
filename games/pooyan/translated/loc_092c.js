// SPDX-License-Identifier: GPL-3.0-only

// loc_092c  (ROM 0x092c-0x0975) -- attract sub-state 2 (dispatch target 0x08a1[2]).
// Gates on the 0x02ce frame timer (`ret nz` while counting), advances the sub-state (0x8e51)
// and clears scratch (0x02b9), spins until the ROM byte (0x07f5) reads 0x11 (a copy-protection
// stall -- 0x07f5 is ROM, so a tampered image loops here forever), then verifies a 7-byte ROM
// signature: for b=7..1 it looks up word table[b] at 0x0976 (via loc_0c45), reads the byte at
// table[b]+0x1c, and compares it to (IX) descending from 0x0838. A mismatch takes `jr nz,0x0976`
// -- a jump INTO the data word table (a tamper trap that corrupts the machine), modeled as a throw.
// On success it paints the attribute map (0x075d) and queues three rst-0x38 display commands.
export function loc_092c(m) {
  const { regs, mem } = m;

  regs.b = 0x19; m.step(0x092e, 7);
  m.push16(0x0931); m.step(0x02ce, 17); m.call(0x02ce); // 092e  call 0x02ce -- frame timer
  if (regs.fNZ) { m.ret(11); return; } // 0931  ret nz -- still counting
  m.step(0x0932, 5);
  m.push16(0x0935); m.step(0x02e3, 17); m.call(0x02e3); // 0932  call 0x02e3
  regs.hl = 0x8e51; m.step(0x0938, 10);
  regs.incMem8(mem, regs.hl); m.step(0x0939, 11); // 0938  inc (hl) -- next sub-state
  m.push16(0x093c); m.step(0x02b9, 17); m.call(0x02b9); // 0939  call 0x02b9
  regs.hl = 0x07f5; m.step(0x093f, 10);
  regs.a = 0x11; m.step(0x0941, 7);

  // 0941  spin until the ROM byte (0x07f5) == 0x11 (copy-protection stall)
  for (;;) {
    regs.cp(mem.read8(regs.hl)); m.step(0x0942, 7);
    if (regs.fNZ) { m.step(0x0941, 12); continue; }
    m.step(0x0944, 7);
    break;
  }

  regs.ix = 0x0838; m.step(0x0948, 14);
  regs.b = 0x07; m.step(0x094a, 7);

  // 094a  verify 7 ROM signature bytes: (IX) descending == byte at (word table[b] + 0x1c)
  for (;;) {
    regs.hl = 0x0976; m.step(0x094d, 10);
    regs.a = regs.b; m.step(0x094e, 4);
    m.push16(0x0951); m.step(0x0c45, 17); m.call(0x0c45); // 094e  call 0x0c45 -- DE = table[b]
    regs.a = 0x1c; m.step(0x0953, 7);
    regs.add(regs.e); m.step(0x0954, 4);
    regs.e = regs.a; m.step(0x0955, 4);
    if (regs.fC) {
      m.step(0x0957, 7);
      regs.d = regs.inc8(regs.d); m.step(0x0958, 4); // 0957  inc d -- carry into DE high
    } else {
      m.step(0x0958, 12); // 0955  jr nc,0x0958
    }
    regs.a = mem.read8(regs.de); m.step(0x0959, 7);
    regs.c = regs.a; m.step(0x095a, 4);
    regs.a = mem.read8(regs.ix & 0xffff); m.step(0x095d, 19); // 095a  ld a,(ix+0)
    regs.cp(regs.c); m.step(0x095e, 4);
    if (regs.fNZ) {
      m.step(0x0976, 12); // 095e  jr nz,0x0976 -- tamper trap: jump into the data word table
      throw new Error("loc_092c: ROM signature mismatch -> tamper trap jump into data at 0x0976");
    }
    m.step(0x0960, 7);
    regs.ix = (regs.ix - 1) & 0xffff; m.step(0x0962, 10); // 0960  dec ix
    regs.b = (regs.b - 1) & 0xff; // djnz: dec b, no flags
    if (regs.b !== 0) { m.step(0x094a, 13); continue; }
    m.step(0x0964, 8);
    break;
  }

  regs.bc = 0x07d9; m.step(0x0967, 10);
  m.push16(0x096a); m.step(0x075d, 17); m.call(0x075d); // 0967  call 0x075d -- fill attribute map
  regs.de = 0x068b; m.step(0x096d, 10);
  m.push16(0x096e); m.step(0x0038, 11); m.call(0x0038); // 096d  rst 0x38 -- queue display cmd
  regs.e = 0x8e; m.step(0x0970, 7);
  m.push16(0x0971); m.step(0x0038, 11); m.call(0x0038); // 0970  rst 0x38
  regs.de = 0x0200; m.step(0x0974, 10);
  m.push16(0x0975); m.step(0x0038, 11); m.call(0x0038); // 0974  rst 0x38
  m.ret(); // 0975  ret
}
