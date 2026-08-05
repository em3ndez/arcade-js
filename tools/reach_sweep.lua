-- reach_sweep.lua — measure WHICH of a game's unnamed routines the real ROM actually executes.
--
-- Backlog triage for an understanding pass, and the evidence reviewer-rules.md R18 requires.
-- A Z80 opcode fetch is a read of the program space, so a one-byte read tap at a routine's entry
-- address counts its executions, attributed to the game state live at the time.
--
-- WHY IT EXISTS, HOW TO READ A ZERO, and the two limits that make it report false zeros on a new
-- game (encrypted AS_OPCODES sets; the boot blind spot) — all in docs/idiomatic-generation.md,
-- "Triage the backlog FIRST". Read that before trusting a not-reached set.
--
-- MAME 0.288: there is no start or stop hook, which is why output is written periodically.
-- RETAIN EVERY SUBSCRIPTION TOKEN IN A GLOBAL — a dropped token is collected silently and the
-- sweep then measures nothing at all.
--
-- USAGE (game-agnostic — nothing about a specific game is hardcoded):
--   ADDRLIST=<file>    one entry address per line ("0x1234" or decimal); blank lines ignored
--   REACHOUT=<file>    output CSV: addr,hits,contexts
--   CTXCELLS=<spec>    OPTIONAL. Comma-separated name:addr pairs naming the cells to attribute
--                      hits by, e.g. "b:0x6227,l:0x6229,d:0x6380" for DK's board/level/difficulty.
--                      Omit for a plain hit count with no attribution.
--   DRIVER=<file>      OPTIONAL. A lua chunk returning function(f, mem) called once per frame,
--                      where you coin up, press start, poke the game to each state you want swept,
--                      and drive inputs. WITHOUT ONE THIS SWEEP ONLY MEASURES ATTRACT MODE, which
--                      is the single easiest way to produce a falsely large not-reached set.
--
--   SDL_VIDEODRIVER=dummy mame <game> -rompath <dir> -video none -sound none -nothrottle \
--     -seconds_to_run 150 -autoboot_script tools/reach_sweep.lua
--
-- A zero-hit row means "not reached by THIS sweep", never "dead code".

local M = manager.machine
local mem, frame = nil, 0

local function parse_addrs(path)
  -- EVERY malformed input here is FATAL. A sweep that silently drops an address reports it as
  -- not-reached, which is the precise false conclusion this tool exists to prevent.
  local out, seen = {}, {}
  local f = assert(io.open(path, 'r'), 'ADDRLIST not readable: ' .. tostring(path))
  local lineno = 0
  for line in f:lines() do
    lineno = lineno + 1
    local t = line:gsub('%s+', '')
    if t ~= '' then
      local a = tonumber(t)
      assert(a, string.format('ADDRLIST line %d is not an address: %q', lineno, line))
      assert(a >= 0 and a <= 0xffff,
             string.format('ADDRLIST line %d: 0x%x is outside the 16-bit address space', lineno, a))
      assert(not seen[a],
             string.format('ADDRLIST line %d: 0x%04x is a DUPLICATE (it would double-count)', lineno, a))
      seen[a] = true
      out[#out + 1] = a
    end
  end
  f:close()
  assert(#out > 0, 'ADDRLIST contained no addresses')
  return out
end

local function parse_ctx(spec)
  -- Also fatal on malformed input: a typo here would silently remove attribution, and the CSV
  -- would look fine.
  local out = {}
  for pair in (spec or ''):gmatch('[^,]+') do
    local name, addr = pair:match('^%s*([%w_]+)%s*:%s*(.+)%s*$')
    assert(name and tonumber(addr), string.format('CTXCELLS: cannot parse %q (want name:addr)', pair))
    out[#out + 1] = { name = name, addr = tonumber(addr) }
  end
  return out
end

local ADDRS  = parse_addrs(assert(os.getenv('ADDRLIST'), 'ADDRLIST not set'))
local OUTPUT = assert(os.getenv('REACHOUT'), 'REACHOUT not set')
local CTX    = parse_ctx(os.getenv('CTXCELLS'))

local DRIVE
do
  local path = os.getenv('DRIVER')
  if path then
    local chunk = assert(loadfile(path), 'DRIVER not loadable: ' .. path)
    DRIVE = chunk()
    assert(type(DRIVE) == 'function', 'DRIVER must return a function(frame, mem)')
  end
end

-- Truncate the output NOW, after parsing succeeded. "No file" is this tool's failure signal, so
-- a previous run's CSV left at the same path would be read as this run's result. (That is not
-- hypothetical: a concurrent agent overwrote a sweep's output file during this tool's own
-- development, and the stale data was briefly mistaken for a regression.)
io.open(OUTPUT, 'w'):close()

local hits, ctxhits = {}, {}
for _, a in ipairs(ADDRS) do hits[a] = 0; ctxhits[a] = {} end

-- Globals, deliberately: these tokens must outlive this chunk or the taps stop firing.
REACH_TAPS = {}
REACH_SUB  = nil

local function context_key()
  if #CTX == 0 then return nil end
  local parts = {}
  for _, c in ipairs(CTX) do
    parts[#parts + 1] = string.format('%s%02x', c.name, mem:read_u8(c.addr))
  end
  return table.concat(parts, '/')
end

local function dump()
  local out = assert(io.open(OUTPUT, 'w'))
  out:write('addr,hits,contexts\n')
  for _, a in ipairs(ADDRS) do
    local cs = {}
    for k, v in pairs(ctxhits[a]) do cs[#cs + 1] = k .. '=' .. v end
    table.sort(cs)
    out:write(string.format('0x%04x,%d,%s\n', a, hits[a], table.concat(cs, ' ')))
  end
  out:close()
end

REACH_SUB = emu.add_machine_frame_notifier(function()
  if not mem then
    -- Install into a LOCAL handle and publish `mem` only once EVERY tap is in place, so a
    -- part-way failure leaves the empty startup file rather than false zeros. The earlier version
    -- assigned mem first: one bad address left every later address untapped, exit 0, all zeros.
    local space = M.devices[':maincpu'].spaces['program']
    local taps = {}
    for _, a in ipairs(ADDRS) do
      taps[#taps + 1] = space:install_read_tap(a, a, string.format('reach%04x', a),
        function(offset, data)
          hits[a] = hits[a] + 1
          local k = context_key()
          if k then ctxhits[a][k] = (ctxhits[a][k] or 0) + 1 end
          return data
        end)
    end
    assert(#taps == #ADDRS,
           string.format('installed %d taps for %d addresses -- refusing to sweep', #taps, #ADDRS))
    REACH_TAPS = taps
    mem = space
  end

  frame = frame + 1
  if DRIVE then DRIVE(frame, mem) end

  -- Every second, and NOT on frame 1: that dump runs in the same notifier call that installs the
  -- taps, before one CPU cycle has elapsed, so it writes an all-zero CSV by construction -- a
  -- plausible file of zeros where "no file" is this tool's failure signal.
  if frame % 60 == 0 then dump() end
end)
