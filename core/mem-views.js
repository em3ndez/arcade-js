// SPDX-License-Identifier: GPL-3.0-only
/**
 * Indexable memory views — sugar so the idiomatic layer can read and write named
 * work-RAM cells with array syntax instead of method calls:
 *
 *     mem8[DIG_DIRS] = mem8[DIG_DIRS] - 1;   // 8-bit; wraps like the hardware
 *     const offset = mem16[TILE_OFFSET];     // 16-bit; little-endian
 *
 * A view is a Proxy over an existing memory object (the board's AddressSpace). A
 * numeric-index get/set is forwarded to that memory's read8/write8 (for an 8-bit view)
 * or read16/write16 (16-bit), so the views inherit EXACTLY the memory semantics the
 * equivalence gate already proves: address masking, width masking (so `x - 1` at 0
 * wraps to 255, and 16-bit stays little-endian), and any live rebinding of the accessor
 * (e.g. the entropy pin swapping read8) — because the method is looked up on the memory
 * object per access, never captured. Any non-numeric key falls through to plain object
 * behaviour, so the view is inert to anything but integer indexing.
 *
 * The memory object and its read8/write8 are untouched: the translated oracle and the
 * live engine keep calling them directly, so nothing on the hot path goes through a
 * Proxy and the equivalence reference is unchanged. These views exist purely for the
 * readability of the idiomatic layer.
 *
 * @param mem    the memory object exposing read8/write8/read16/write16
 * @param width  8 or 16 — the access width this view uses
 */
export function makeIndexedView(mem, width) {
  const readFn = width === 16 ? "read16" : "read8";
  const writeFn = width === 16 ? "write16" : "write8";
  return new Proxy(Object.create(null), {
    get(target, key) {
      if (typeof key === "string") {
        const addr = Number(key);
        // String(addr) === key admits only a canonical integer index (rejects "",
        // "0x8079", "1.5", and every method/property name like "constructor").
        if (Number.isInteger(addr) && String(addr) === key) return mem[readFn](addr);
      }
      return Reflect.get(target, key);
    },
    set(target, key, value) {
      if (typeof key === "string") {
        const addr = Number(key);
        if (Number.isInteger(addr) && String(addr) === key) {
          mem[writeFn](addr, value); // write8/write16 apply the width mask themselves
          return true;
        }
      }
      return Reflect.set(target, key, value);
    },
  });
}
