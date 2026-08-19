// SPDX-License-Identifier: GPL-3.0-only

// loc_755d  (ROM 0x755d-0x756c) -- dispatch state 2 (from loc_7442's table): the per-frame gameplay
// driver. Calls, in order, the projectile spawner (0x756d), the arrow/object mover (0x7621), the
// eagle blitter (0x6b13), 0x76af, and 0x02ef, then returns. Each is a plain-ret callee, so every
// site is pattern A (push the return, then call so the callee's ret pops it). 0x756d may end in
// loc_7595's caller-skip, but that skip pops exactly this routine's pushed 0x7560 return, landing
// control on the next call all the same.
export function loc_755d(m) {
  m.push16(0x7560);
  m.step(0x756d, 17); // 755d  call 0x756d -- projectile spawner driver
  m.call(0x756d);
  m.push16(0x7563);
  m.step(0x7621, 17); // 7560  call 0x7621
  m.call(0x7621);
  m.push16(0x7566);
  m.step(0x6b13, 17); // 7563  call 0x6b13 -- two-tile blitter
  m.call(0x6b13);
  m.push16(0x7569);
  m.step(0x76af, 17); // 7566  call 0x76af
  m.call(0x76af);
  m.push16(0x756c);
  m.step(0x02ef, 17); // 7569  call 0x02ef
  m.call(0x02ef);
  m.ret(); // 756c  ret
}
