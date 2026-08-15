# Auto-fit the dashboard to any desktop/laptop screen and OS scaling

## The problem

Right now the board is sized by guesswork: the shrink factor comes from three
fixed CSS breakpoints (`--tt-fit-scale` = 1 / 0.88 / 0.82 based on viewport
height only). That ignores:

- width differences (1366x768 laptop vs 1920x1080 vs ultrawide)
- Windows display scaling (100% / 125% / 150%), which changes the CSS pixel
  viewport, so a 1080p screen at 125% reports 1536x864
- browser zoom and taskbar/bookmark-bar height differences

Result: on some machines the board is cut off or scrolls, on others there is a
big empty band at the bottom.

## The fix: measure, then scale

Replace guessed breakpoints with a real measurement loop on desktop widths:

1. Render the board at its natural design size (no transform) and measure its
   actual content width and height.
2. Compute `scale = min(availableWidth / contentWidth, availableHeight / contentHeight)`,
   using `visualViewport` when available so browser zoom and OS scaling are both
   accounted for.
3. Clamp it: never above 1 (no blurry upscaling), never below a readability
   floor (~0.62). If content still doesn't fit at the floor, the page scrolls
   instead of becoming unreadable.
4. Re-run on window resize, `visualViewport` resize/zoom, device-pixel-ratio
   change (dragging the window to a second monitor with different scaling), and
   whenever the board's own height changes — e.g. Sunday planner adds rows, a
   modal opens, exam edit expands. A `ResizeObserver` on the board handles that.
5. Debounce with `requestAnimationFrame` so resizing stays smooth, and centre the
   scaled board horizontally so wide screens don't leave a lopsided gap.

The three height-only breakpoint blocks that hardcode 0.88 / 0.82 get removed so
they can't fight the measured value.

## What stays the same

- Layout, sections, colours, animations: untouched.
- Tablet (<=1023px) and phone (<=767px) keep the existing reflow behaviour with
  scaling off and natural scrolling — measuring/scaling only applies from
  laptop width up.
- The desktop "one page, no scroll" promise is preserved and now actually holds
  on 1366x768 and 125%-scaled screens.

## Technical notes

- `src/routes/index.tsx`: a `useFitScale` effect that measures
  `appRef.current.scrollWidth/scrollHeight` at scale 1, computes the ratio
  against `visualViewport.width/height` (fallback `innerWidth/innerHeight`),
  clamps to `[0.62, 1]`, and writes it to the `--tt-fit-scale` CSS variable on
  the root element. Listeners: `resize`, `visualViewport` resize + scroll, a
  `matchMedia('(resolution: Xdppx)')` change hook for DPR shifts, and a
  `ResizeObserver` on the app node. All batched through `rAF`.
- `src/styles.css`: drop the `max-height: 900px` / `max-height: 780px`
  `--tt-fit-scale` overrides; keep `.tt-scaleWrap` transform math but base
  its height/width on the measured variable; add horizontal centring for the
  scaled wrapper; leave the `<=1279px`, `<=1023px`, `<=767px` layers as-is
  except for making sure the JS scale is forced to 1 below 1024px.

## Verification

Check the board fits with no scrollbar and no dead space at: 1920x1080 @100%,
1920x1080 @125%, 1600x900, 1366x768 @100% and @125%, and at browser zoom 90%
and 110%.
