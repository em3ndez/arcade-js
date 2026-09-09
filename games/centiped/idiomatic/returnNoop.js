// SPDX-License-Identifier: GPL-3.0-only

/**
 * returnNoop -- do nothing and return.
 * A shared no-op landing that several "nothing to do here" exits fold onto; no observable
 * effect. The return is omitted here; the dispatch seam completes it, so the body is empty.
 */
export function returnNoop() {}
