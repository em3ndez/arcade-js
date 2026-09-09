// SPDX-License-Identifier: GPL-3.0-only

/**
 * returnImmediately -- a shared no-op return; does nothing observable.
 * The return itself is omitted here; the dispatch seam supplies it, so the body is empty.
 */
export function returnImmediately(_m) {
  // Intentionally empty: a bare return that the seam completes.
}
