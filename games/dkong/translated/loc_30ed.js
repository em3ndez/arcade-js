// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_30ed  (ROM 0x30ED–0x30F9) — orchestrator: four sequenced calls, then ret.
 *
 *   30ed  cd fa 30     call 0x30fa        ; SKIP-CAPABLE (rst-28 guard dispatch) -- guarded
 *   30f0  cd 3c 31     call 0x313c        ; SKIP-CAPABLE (inc sp splice) -- guarded
 *   30f3  cd b1 31     call 0x31b1
 *   30f6  cd f3 34     call 0x34f3
 *   30f9  c9           ret
 *
 * The HEAD of the >=0x3000 closure chain (30ed -> 31b1 -> 3202 -> 333d ...)
 * and the LAST of it to integrate.
 * Not yet wired into the live dispatcher: called from 0x198C
 * (< 0x3000, in the untranslated handler_1977 region -- the run stops at 0x1977),
 * and nothing in translated src invokes loc_30ed. The whole chain becomes
 * reachable only when handler_1977 (finale) lands.
 *
 * TWO of the four callees are SKIP-CAPABLE and are boolean-guarded (
 * resolved against the INTEGRATED callees -- the drafter did not open them):
 *   0x30FA call sub_30fa -- a rst-0x28 TAIL dispatcher to the 0x3110 guard family;
 *     a guard that splices (inc sp/inc sp/ret) unwinds PAST loc_30ed to its
 *     caller. sub_30fa passes that skip-boolean up via `return sub_0028(...)`.
 *     Guard: `if (!m.call(0x30fa)) return;`.
 *   0x313C call entry_313c -- on counter==0 it does inc sp/inc sp/ret (its own
 *     comment names loc_30ed as the spliced caller) and returns false.
 *     Guard: `if (!m.call(0x313c)) return;`.
 * The other two (entry_31b1, entry_34f3) return NORMALLY (verified: no boolean,
 * no inc sp) -> plain calls. entry_30f0 (the 0x313c call site) has NO static
 * caller -- ruled an interior/tracer-artifact label, not a second entry.
 */
export function loc_30ed(m) {
  m.push16(0x30f0);
  m.step(0x30fa, 17); // call 0x30fa
  if (!m.call(0x30fa)) return; // sub_30fa's dispatched guard spliced -> loc_30ed skipped

  // 0x30f0 (entry_30f0 label -- interior)
  m.push16(0x30f3);
  m.step(0x313c, 17); // call 0x313c
  if (!m.call(0x313c)) return; // entry_313c spliced (counter==0) -> loc_30ed skipped

  m.push16(0x30f6);
  m.step(0x31b1, 17); // call 0x31b1
  m.call(0x31b1);

  m.push16(0x30f9);
  m.step(0x34f3, 17); // call 0x34f3
  m.call(0x34f3);

  m.ret(); // 30f9
}
