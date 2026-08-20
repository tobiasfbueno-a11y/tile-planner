// ---------- Version (bump this on every update — compare with what's on screen) ----------
const APP_VERSION = 'v31';
document.getElementById('appVersion').textContent = APP_VERSION;

// ---------- Whole-inches + fraction measurement fields ----------
// Every measurement field (wall, tile, crooked corners) pairs a whole-inch
// number input with a tape-measure-style fraction dropdown (1/16 through
// 15/16), matching how people actually read a tape measure instead of
// typing decimals.
const FRACTIONS = [
  ['0', '+0'], ['0.0625', '1/16'], ['0.125', '1/8'], ['0.1875', '3/16'],
  ['0.25', '1/4'], ['0.3125', '5/16'], ['0.375', '3/8'], ['0.4375', '7/16'],
  ['0.5', '1/2'], ['0.5625', '9/16'], ['0.625', '5/8'], ['0.6875', '11/16'],
  ['0.75', '3/4'], ['0.8125', '13/16'], ['0.875', '7/8'], ['0.9375', '15/16'],
];
document.querySelectorAll('select.frac-select').forEach(sel => {
  sel.innerHTML = FRACTIONS.map(([v, label]) => `<option value="${v}">${label}</option>`).join('');
});
// Reads a whole+fraction pair (e.g. ids 'wallWidthWhole'/'wallWidthFrac')
// and returns the combined decimal inches, or NaN if the whole part is empty.
function getFracValue(prefix) {
  const wholeEl = document.getElementById(prefix + 'Whole');
  const fracEl = document.getElementById(prefix + 'Frac');
  if (!wholeEl || wholeEl.value === '') return NaN;
  const whole = parseFloat(wholeEl.value) || 0;
  const frac = fracEl ? parseFloat(fracEl.value) || 0 : 0;
  return whole + frac;
}

// ---------- State ----------
const state = {
  wallFile: null,
  wallDataUrl: null,
  tileFile: null,
  tileDataUrl: null,
  crooked: false,
};

const steps = ['screen-wall', 'screen-measure', 'screen-tile', 'screen-key', 'screen-result'];

// ---------- Navigation ----------
function goTo(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const idx = steps.indexOf(id);
  document.querySelectorAll('#progressGrout .seg').forEach((seg, i) => {
    seg.classList.toggle('filled', i <= idx);
  });
  window.scrollTo(0, 0);
}

document.querySelectorAll('[data-back]').forEach(btn => {
  btn.addEventListener('click', () => goTo(btn.dataset.back));
});

// ---------- Photo capture (wall) ----------
const wallSlot = document.getElementById('wallSlot');
const wallInput = document.getElementById('wallInput');
wallSlot.addEventListener('click', () => wallInput.click());
wallInput.addEventListener('change', async () => {
  const file = wallInput.files[0];
  if (!file) return;
  state.wallFile = file;
  const raw = await fileToDataUrl(file);
  state.wallDataUrl = await resizeDataUrl(raw);
  wallSlot.innerHTML = `<img src="${state.wallDataUrl}" alt="Foto do espaço">`;
  document.getElementById('toStep2').disabled = false;
});

// ---------- Photo capture (tile) ----------
const tileSlot = document.getElementById('tileSlot');
const tileInput = document.getElementById('tileInput');
tileSlot.addEventListener('click', () => tileInput.click());
tileInput.addEventListener('change', async () => {
  const file = tileInput.files[0];
  if (!file) return;
  state.tileFile = file;
  const raw = await fileToDataUrl(file);
  state.tileDataUrl = await resizeDataUrl(raw);
  tileSlot.innerHTML = `<img src="${state.tileDataUrl}" alt="Foto do tile">`;
  checkStep3Ready();
});

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Downscales a data URL image so uploads stay fast and reliable on mobile networks.
function resizeDataUrl(dataUrl, maxDim = 1440, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round(height * (maxDim / width));
          width = maxDim;
        } else {
          width = Math.round(width * (maxDim / height));
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// ---------- Step buttons ----------
document.getElementById('toStep2').addEventListener('click', () => goTo('screen-measure'));

document.getElementById('crookedToggle').addEventListener('click', (e) => {
  state.crooked = !state.crooked;
  e.target.classList.toggle('on', state.crooked);
  document.getElementById('crookedFields').style.display = state.crooked ? 'block' : 'none';
  document.getElementById('squareFields').style.display = state.crooked ? 'none' : 'block';
  if (state.crooked) drawShapeIllustration();
});

// Live-updating illustrative sketch of the 4-sided space. Not a precise
// geometric solve (4 side lengths alone don't fully determine a
// quadrilateral's angles) — it's a rough, proportion-aware sketch so the
// numbered sides visually match the numbered input fields below it.
['side1', 'side2', 'side3', 'side4'].forEach(prefix => {
  document.getElementById(prefix + 'Whole').addEventListener('input', drawShapeIllustration);
  document.getElementById(prefix + 'Frac').addEventListener('change', drawShapeIllustration);
});

function drawShapeIllustration() {
  const s1 = getFracValue('side1') || 80; // top
  const s2 = getFracValue('side2') || 96; // right
  const s3 = getFracValue('side3') || 80; // bottom
  const s4 = getFracValue('side4') || 96; // left

  const avgW = (s1 + s3) / 2;
  const avgH = (s2 + s4) / 2;
  const vbW = 240, vbH = 200, pad = 30;
  const drawW = vbW - pad * 2, drawH = vbH - pad * 2;
  const scale = Math.min(drawW / avgW, drawH / avgH);

  // Center each edge's width/height around the shared average, and bow the
  // left/right edges to reflect side2 vs side4 differing — a simple,
  // honest sketch rather than a fully solved quadrilateral.
  const topW = s1 * scale, bottomW = s3 * scale;
  const rightH = s2 * scale, leftH = s4 * scale;
  const cx = vbW / 2;
  const topY = pad + (drawH - Math.max(rightH, leftH)) / 2;

  const tl = { x: cx - topW / 2, y: topY };
  const tr = { x: cx + topW / 2, y: topY };
  const bl = { x: cx - bottomW / 2, y: topY + leftH };
  const br = { x: cx + bottomW / 2, y: topY + rightH };

  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const m1 = mid(tl, tr), m2 = mid(tr, br), m3 = mid(bl, br), m4 = mid(tl, bl);

  const svg = document.getElementById('shapeSvg');
  svg.innerHTML = `
    <polygon points="${tl.x},${tl.y} ${tr.x},${tr.y} ${br.x},${br.y} ${bl.x},${bl.y}"
      fill="rgba(62,124,122,0.25)" stroke="#5AABA8" stroke-width="2"/>
    <text x="${m1.x}" y="${m1.y - 8}" text-anchor="middle" fill="#F3E9DE" font-size="13" font-family="JetBrains Mono, monospace">①</text>
    <text x="${m2.x + 12}" y="${m2.y}" text-anchor="start" fill="#F3E9DE" font-size="13" font-family="JetBrains Mono, monospace">②</text>
    <text x="${m3.x}" y="${m3.y + 18}" text-anchor="middle" fill="#F3E9DE" font-size="13" font-family="JetBrains Mono, monospace">③</text>
    <text x="${m4.x - 12}" y="${m4.y}" text-anchor="end" fill="#F3E9DE" font-size="13" font-family="JetBrains Mono, monospace">④</text>
  `;
}

document.getElementById('toStep3').addEventListener('click', () => {
  if (state.crooked) {
    const sides = ['side1', 'side2', 'side3', 'side4'].map(getFracValue);
    if (sides.some(v => !v)) {
      alert('Preencha os 4 lados do espaço.');
      return;
    }
  } else {
    const w = getFracValue('wallWidth');
    const h = getFracValue('wallHeight');
    if (!w || !h) {
      alert('Preencha largura e altura do espaço.');
      return;
    }
  }
  goTo('screen-tile');
});

document.getElementById('skipTilePhoto').addEventListener('change', (e) => {
  const skip = e.target.checked;
  document.getElementById('tilePhotoBlock').style.display = skip ? 'none' : 'block';
  if (skip) {
    state.tileFile = null;
    state.tileDataUrl = null;
  }
  checkStep3Ready();
});

['tileWidthWhole', 'tileWidthFrac', 'tileHeightWhole', 'tileHeightFrac'].forEach(id => {
  document.getElementById(id).addEventListener('input', checkStep3Ready);
  document.getElementById(id).addEventListener('change', checkStep3Ready);
});
function checkStep3Ready() {
  const tw = getFracValue('tileWidth');
  const th = getFracValue('tileHeight');
  const skip = document.getElementById('skipTilePhoto').checked;
  document.getElementById('toStep4').disabled = !(tw && th && (skip || state.tileDataUrl));
}

document.getElementById('toStep4').addEventListener('click', () => {
  if (document.getElementById('skipTilePhoto').checked) {
    goTo('screen-result');
    runCalculation();
    return;
  }
  const saved = localStorage.getItem('openrouter_api_key');
  if (saved) document.getElementById('apiKey').value = saved;
  goTo('screen-key');
});

document.getElementById('toStep5').addEventListener('click', () => {
  const key = document.getElementById('apiKey').value.trim();
  if (key) localStorage.setItem('openrouter_api_key', key);
  goTo('screen-result');
  runCalculation();
});

document.getElementById('restartBtn').addEventListener('click', () => {
  location.reload();
});

// ---------- Layout algorithm ----------
const MIN_CUT_IN = 4; // never leave an edge cut piece thinner than this (fragile + ugly)

// Given a total run and a repeating unit (tile+grout), finds how many full
// units fit while keeping the two symmetric edge cuts at least MIN_CUT_IN wide.
// If an edge cut would be too thin, it sacrifices one full tile so the extra
// width gets folded into both edge pieces instead.
function centeredSplit(total, unit, minCut) {
  let n = Math.floor(total / unit);
  let rem = +(total - n * unit).toFixed(3);
  let edge = +(rem / 2).toFixed(3);
  let guard = 0;
  while (edge > 0.01 && edge < minCut && n > 0 && guard < 20) {
    n -= 1;
    rem = +(total - n * unit).toFixed(3);
    edge = +(rem / 2).toFixed(3);
    guard++;
  }
  return { n, rem, edge };
}

// Like centeredSplit, but lets the installer pick which side gets the full
// (uncut) tile — e.g. flush against the main wall/floor — instead of always
// splitting the leftover evenly on both edges. anchor: 'start' = full tiles
// begin at position 0 (cut lands at the far edge), 'end' = full tiles are
// flush with the far edge (cut lands at position 0), 'center' = old behavior.
function anchoredSplit(total, unit, minCut, anchor) {
  if (anchor === 'center') {
    const c = centeredSplit(total, unit, minCut);
    return { n: c.n, rem: c.rem, edgeStart: c.edge, edgeEnd: c.edge, anchor };
  }
  // Single-sided anchor: the leftover can only land on ONE edge. A pure
  // single edge piece can never be bigger than one real tile (see below),
  // so we can't fix a too-thin sliver by pulling a whole tile out the way
  // centeredSplit does. Instead, when the single-sided cut would come out
  // under minCut, borrow a little from the flush side too and split the
  // total leftover across BOTH edges — still close to flush at the chosen
  // anchor, but neither edge ends up a razor-thin sliver.
  const n = Math.floor(total / unit);
  const rem = +(total - n * unit).toFixed(3);
  if (rem > 0.05 && rem < minCut && n > 0) {
    const c = centeredSplit(total, unit, minCut);
    return { n: c.n, rem: c.rem, edgeStart: c.edge, edgeEnd: c.edge, anchor, redistributed: true };
  }
  return {
    n, rem,
    edgeStart: anchor === 'end' ? rem : 0,
    edgeEnd: anchor === 'start' ? rem : 0,
    anchor,
  };
}

function computeLayout() {
  let wallWidth = getFracValue('wallWidth');
  let wallHeight = getFracValue('wallHeight');
  let tileW = getFracValue('tileWidth');
  let tileH = getFracValue('tileHeight');
  const groutIn = parseFloat(document.getElementById('groutWidth').value) || 0.125;
  const orientation = document.getElementById('tileOrientation').value; // horizontal | vertical | diamond
  const pattern = document.getElementById('tilePattern').value; // straight | brick | third | thirdMirrored
  const horizAnchor = document.getElementById('horizAnchor').value; // left | right | center
  const vertAnchor = document.getElementById('vertAnchor').value; // bottom | top | center

  let sides = null;
  let widthVariation = 0, heightVariation = 0;
  if (state.crooked) {
    // 4 measured sides going clockwise from the top: side1=top, side2=right,
    // side3=bottom, side4=left. Width comes from the top/bottom pair,
    // height from the left/right pair — this replaces the old "4 corner
    // heights" model with something that matches how the illustration
    // above (and a tape measure) actually works: measure each side.
    const s1 = getFracValue('side1'); // top width
    const s2 = getFracValue('side2'); // right height
    const s3 = getFracValue('side3'); // bottom width
    const s4 = getFracValue('side4'); // left height
    sides = { top: s1, right: s2, bottom: s3, left: s4 };
    wallWidth = (s1 + s3) / 2;
    wallHeight = (s2 + s4) / 2;
    widthVariation = Math.abs(s1 - s3);
    heightVariation = Math.abs(s2 - s4);
  }

  // Orientation controls which side of the tile runs horizontally, regardless
  // of the order width/height were typed in. "Horizontal" = long side across
  // the wall; "vertical" = long side running up-down; "diamond" = on point.
  const diagonalMode = orientation === 'diamond';
  const longSide = Math.max(tileW, tileH);
  const shortSide = Math.min(tileW, tileH);
  if (orientation === 'horizontal') {
    tileW = longSide; tileH = shortSide;
  } else if (orientation === 'vertical') {
    tileW = shortSide; tileH = longSide;
  }

  let effW, effH, diagonalWaste = 1;
  if (diagonalMode) {
    const diag = Math.sqrt(tileW * tileW + tileH * tileH);
    effW = diag + groutIn;
    effH = diag + groutIn;
    // Diamond layouts need extra material for the triangular cuts along every edge.
    diagonalWaste = 1.15;
  } else {
    effW = tileW + groutIn;
    effH = tileH + groutIn;
  }

  // Vertical (row) split is the same regardless of horizontal pattern offset.
  // vertAnchor: 'bottom' = full tiles flush with the floor (cut lands at the
  // top); 'top' = flush with the ceiling (cut at the floor); 'center' = old
  // symmetric behavior.
  const vertAnchorNorm = vertAnchor === 'bottom' ? 'start' : vertAnchor === 'top' ? 'end' : 'center';
  const rowSplit = anchoredSplit(wallHeight, effH, MIN_CUT_IN, vertAnchorNorm);
  const rowsFull = rowSplit.n;
  const remH = rowSplit.rem;
  const edgeCutHStart = rowSplit.edgeStart; // at the floor
  const edgeCutHEnd = rowSplit.edgeEnd;     // at the ceiling/top
  const hasHorizontalCut = remH > 0.05;
  const vertRedistributed = !!rowSplit.redistributed;
  const totalRows = rowsFull + (edgeCutHStart > 0.05 ? 1 : 0) + (edgeCutHEnd > 0.05 ? 1 : 0);

  let colsFull, remW, edgeCutWStart, edgeCutWEnd, hasVerticalCut, totalCols, totalTiles, colsRange = null;
  let horizRedistributed = false;
  let colTaper = null, rowTaper = null;

  if (pattern === 'straight' || diagonalMode) {
    // horizAnchor: 'left'/'right' flush a full tile against that wall; the
    // cut lands on the opposite side. 'center' splits the leftover evenly.
    const horizAnchorNorm = horizAnchor === 'left' ? 'start' : horizAnchor === 'right' ? 'end' : 'center';
    const colSplit = anchoredSplit(wallWidth, effW, MIN_CUT_IN, horizAnchorNorm);
    colsFull = colSplit.n;
    remW = colSplit.rem;
    edgeCutWStart = colSplit.edgeStart; // left side
    edgeCutWEnd = colSplit.edgeEnd;     // right side
    hasVerticalCut = remW > 0.05;
    horizRedistributed = !!colSplit.redistributed;
    totalCols = colsFull + (edgeCutWStart > 0.05 ? 1 : 0) + (edgeCutWEnd > 0.05 ? 1 : 0);
    totalTiles = Math.ceil(totalCols * totalRows * diagonalWaste);

    // Crooked space + straight pattern: the wall isn't actually one uniform
    // height/width — it tapers between the two measured sides. Using one
    // averaged cut everywhere means the "main" edge you chose to keep flush
    // won't really be flush at every column. The fix is the standard
    // diminishing-course technique: keep the same number of FULL tile rows
    // everywhere (so courses stay level), but let the CUT piece at each
    // column/row take its own real size, computed from the actual local
    // wall height/width at that position — not the average.
    if (state.crooked && sides && !diagonalMode) {
      const colsForTaper = [];
      let cx = 0;
      if (edgeCutWStart > 0.05) { colsForTaper.push({ x: cx, w: edgeCutWStart }); cx += edgeCutWStart; }
      for (let i = 0; i < colsFull; i++) { colsForTaper.push({ x: cx, w: tileW }); cx += tileW; }
      if (edgeCutWEnd > 0.05) { colsForTaper.push({ x: cx, w: edgeCutWEnd }); cx += edgeCutWEnd; }

      colTaper = colsForTaper.map(c => {
        const xFrac = wallWidth > 0 ? (c.x + c.w / 2) / wallWidth : 0.5;
        const localHeight = sides.left + (sides.right - sides.left) * xFrac;
        const localRem = +(localHeight - rowsFull * effH).toFixed(3);
        if (vertAnchorNorm === 'center') {
          const e = +(localRem / 2).toFixed(3);
          return { x: c.x, w: c.w, edgeCutHStart: Math.max(e, 0), edgeCutHEnd: Math.max(e, 0), localHeight };
        }
        return {
          x: c.x, w: c.w, localHeight,
          edgeCutHStart: vertAnchorNorm === 'end' ? Math.max(localRem, 0) : 0,
          edgeCutHEnd: vertAnchorNorm === 'start' ? Math.max(localRem, 0) : 0,
        };
      });

      const rowsForTaper = [];
      let cy = 0;
      if (edgeCutHStart > 0.05) { rowsForTaper.push({ y: cy, h: edgeCutHStart }); cy += edgeCutHStart; }
      for (let i = 0; i < rowsFull; i++) { rowsForTaper.push({ y: cy, h: tileH }); cy += tileH; }
      if (edgeCutHEnd > 0.05) { rowsForTaper.push({ y: cy, h: edgeCutHEnd }); cy += edgeCutHEnd; }

      rowTaper = rowsForTaper.map(r => {
        const yFrac = wallHeight > 0 ? (r.y + r.h / 2) / wallHeight : 0.5;
        const localWidth = sides.top + (sides.bottom - sides.top) * yFrac;
        const localRem = +(localWidth - colsFull * effW).toFixed(3);
        if (horizAnchorNorm === 'center') {
          const e = +(localRem / 2).toFixed(3);
          return { y: r.y, h: r.h, edgeCutWStart: Math.max(e, 0), edgeCutWEnd: Math.max(e, 0), localWidth };
        }
        return {
          y: r.y, h: r.h, localWidth,
          edgeCutWStart: horizAnchorNorm === 'end' ? Math.max(localRem, 0) : 0,
          edgeCutWEnd: horizAnchorNorm === 'start' ? Math.max(localRem, 0) : 0,
        };
      });
    }
  } else {
    // Running-bond style patterns: each row is offset horizontally, so the
    // cut pieces land in different spots row to row — the pattern itself
    // dictates where cuts fall, so horizAnchor doesn't apply here.
    const rowsCount = Math.max(totalRows, 1);
    let minCols = Infinity, maxCols = -Infinity, sumCols = 0;
    for (let r = 0; r < rowsCount; r++) {
      const offset = rowOffset(pattern, r, effW);
      const row = buildRowColumns(effW, wallWidth, offset);
      minCols = Math.min(minCols, row.length);
      maxCols = Math.max(maxCols, row.length);
      sumCols += row.length;
    }
    colsFull = Math.floor(wallWidth / effW);
    remW = +(wallWidth - colsFull * effW).toFixed(2);
    edgeCutWStart = +(remW / 2).toFixed(2);
    edgeCutWEnd = edgeCutWStart;
    hasVerticalCut = true; // offset patterns virtually always produce edge cuts somewhere
    totalCols = maxCols;
    colsRange = minCols === maxCols ? `${minCols}` : `${minCols}–${maxCols}`;
    totalTiles = sumCols;
  }

  const smallestVertCut = Math.min(...[edgeCutWStart, edgeCutWEnd].filter(v => v > 0.05), Infinity);
  const smallestHorizCut = Math.min(...[edgeCutHStart, edgeCutHEnd].filter(v => v > 0.05), Infinity);
  const thinSliverWarning = smallestVertCut < MIN_CUT_IN - 0.01 || smallestHorizCut < MIN_CUT_IN - 0.01;

  return {
    wallWidth, wallHeight, tileW, tileH, groutIn,
    orientation, pattern, diagonalMode, horizAnchor, vertAnchor,
    colsFull, remW, edgeCutWStart, edgeCutWEnd, hasVerticalCut, colsRange,
    rowsFull, remH, edgeCutHStart, edgeCutHEnd, hasHorizontalCut,
    totalCols, totalRows, totalTiles,
    thinSliverWarning, sides, widthVariation, heightVariation,
    vertRedistributed, horizRedistributed, colTaper, rowTaper,
    effW, effH,
  };
}

// Horizontal offset (in inches) applied to a given row for offset patterns.
function rowOffset(pattern, rowIndex, effW) {
  if (pattern === 'brick') return (rowIndex % 2 === 1) ? effW / 2 : 0;
  if (pattern === 'third') return (rowIndex % 3) * (effW / 3);
  if (pattern === 'thirdMirrored') return (rowIndex % 2 === 0) ? effW / 3 : (2 * effW) / 3;
  return 0;
}

// Builds the list of tile/cut-piece widths for one row given a starting offset.
// Enforces MIN_CUT_IN: if the first or last piece would be too thin, it merges
// with the neighboring full tile instead of leaving a fragile sliver.
function buildRowColumns(effW, wallWidth, offset) {
  // Note: a cut piece can never legitimately be wider than one real tile
  // (effW) — you cut material away from a tile, you can't grow one. So thin
  // slivers (<MIN_CUT_IN) are reported as-is rather than folded into a
  // neighboring full tile, which would produce an impossible oversized
  // piece. thinSliverWarning downstream already flags this case for the
  // installer.
  const cols = [];
  let remaining = wallWidth;
  if (offset > 0.05) {
    const firstW = Math.min(effW - offset, wallWidth);
    cols.push({ width: firstW, cut: true });
    remaining -= firstW;
  }
  while (remaining > effW + 0.05) {
    cols.push({ width: effW, cut: false });
    remaining -= effW;
  }
  if (remaining > 0.05) {
    const isCut = remaining < effW - 0.05;
    cols.push({ width: remaining, cut: isCut });
  }
  return cols;
}

// Greedy bin-packing: given a list of cut-piece sizes and the real material
// size they're cut from (one tile's actual width or height — not
// tile+grout), estimates how many physical tiles are needed if two cuts
// that together fit within one tile get nested from the same piece instead
// of each consuming a separate whole tile. First-fit-decreasing: take the
// largest remaining piece, pair it with the largest other piece that still
// fits alongside it, repeat.
function packCuts(sizes, materialSize) {
  const sorted = sizes.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s);
  const used = new Array(sorted.length).fill(false);
  let tileCount = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    tileCount++;
    const remaining = materialSize - sorted[i].s;
    let bestJ = -1, bestSize = -1;
    for (let j = i + 1; j < sorted.length; j++) {
      if (used[j]) continue;
      if (sorted[j].s <= remaining + 0.02 && sorted[j].s > bestSize) {
        bestJ = j;
        bestSize = sorted[j].s;
      }
    }
    if (bestJ >= 0) used[bestJ] = true;
  }
  return tileCount;
}

// Walks the same row/column grid drawLayout renders, but just tallies
// pieces instead of drawing — full tiles, corner (double-cut) pieces that
// always need their own dedicated tile, and single-direction cut pieces
// whose offcut can potentially be reused for another cut from the same
// tile (per the user's rule: only pieces cut on ONE side are reuse
// candidates — a corner piece's leftover is an odd L-shape, not a clean
// reusable strip).
function computeMaterialStats(layout) {
  const sqft = (layout.wallWidth * layout.wallHeight) / 144;

  if (layout.diagonalMode) {
    // Triangular/pentagon offcuts from the 45° clip don't nest reliably the
    // same way — fall back to the existing waste-factor estimate.
    return { sqft, buyTiles: layout.totalTiles, optimized: false };
  }

  const rowsBU = [];
  let courseSeq = 0;
  if (layout.edgeCutHStart > 0.05) rowsBU.push({ height: layout.edgeCutHStart, edge: true, courseIdx: courseSeq++ });
  for (let i = 0; i < layout.rowsFull; i++) rowsBU.push({ height: layout.tileH, edge: false, courseIdx: courseSeq++ });
  if (layout.edgeCutHEnd > 0.05) rowsBU.push({ height: layout.edgeCutHEnd, edge: true, courseIdx: courseSeq++ });

  let fullCount = 0, cornerCount = 0;
  const widthCuts = [], heightCuts = [];

  for (const row of rowsBU) {
    let colWidths;
    if (layout.pattern === 'straight') {
      colWidths = [];
      if (layout.edgeCutWStart > 0.05) colWidths.push({ width: layout.edgeCutWStart, cut: true });
      for (let i = 0; i < layout.colsFull; i++) colWidths.push({ width: layout.tileW, cut: false });
      if (layout.edgeCutWEnd > 0.05) colWidths.push({ width: layout.edgeCutWEnd, cut: true });
    } else {
      const offset = rowOffset(layout.pattern, row.courseIdx, layout.effW);
      colWidths = buildRowColumns(layout.effW, layout.wallWidth, offset);
    }
    for (const col of colWidths) {
      const isCornerPiece = row.edge && col.cut;
      const isWidthCutOnly = col.cut && !row.edge;
      const isHeightCutOnly = row.edge && !col.cut;
      if (isCornerPiece) cornerCount++;
      else if (isWidthCutOnly) widthCuts.push(col.width);
      else if (isHeightCutOnly) heightCuts.push(row.height);
      else fullCount++;
    }
  }

  const buyTiles = fullCount + cornerCount
    + packCuts(widthCuts, layout.tileW)
    + packCuts(heightCuts, layout.tileH);

  return { sqft, buyTiles, optimized: true };
}

// Prints the space's own outer measurements along the diagram's edges —
// the actual wall/floor dimensions, not tile math. For a crooked space,
// each corner's real measured value is shown at that corner instead of one
// single (averaged) number, since that's the whole point of measuring a
// crooked space separately per corner.
function drawSpaceDimensionLabels(ctx, layout, scale, dpr, pad) {
  const gridW = layout.wallWidth * scale;
  const gridH = layout.wallHeight * scale;
  const left = pad, top = pad;

  ctx.save();
  ctx.fillStyle = '#B9B2A8';
  ctx.textBaseline = 'middle';

  if (layout.sides) {
    // Crooked space: show each of the 4 measured sides along its matching
    // edge, numbered ①-④ the same way as the illustration on the
    // measurements screen, instead of one averaged number per axis.
    ctx.font = `${11 * dpr}px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`① ${layout.sides.top.toFixed(1)}"`, left + gridW / 2, top - 14 * dpr);
    ctx.fillText(`③ ${layout.sides.bottom.toFixed(1)}"`, left + gridW / 2, top + gridH + 14 * dpr);
    ctx.save();
    ctx.translate(left - 10 * dpr, top + gridH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`④ ${layout.sides.left.toFixed(1)}"`, 0, 0);
    ctx.restore();
    ctx.save();
    ctx.translate(left + gridW + 10 * dpr, top + gridH / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillText(`② ${layout.sides.right.toFixed(1)}"`, 0, 0);
    ctx.restore();
    ctx.restore();
    return;
  }

  ctx.font = `${11 * dpr}px 'JetBrains Mono', monospace`;
  ctx.save();
  ctx.translate(left - 10 * dpr, top + gridH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText(`${layout.wallHeight.toFixed(1)}"`, 0, 0);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.fillText(`${layout.wallWidth.toFixed(1)}"`, left + gridW / 2, top - 14 * dpr);
  ctx.restore();
}

// Draws a technical dimension line: a straight line between two points with
// small perpendicular tick marks at each end (|———|, no arrowheads), plus
// the measurement centered above/beside it. This is how the exact cut size
// is marked on a piece — a line spanning the cut, not just a floating
// number, so it's clear which dimension the number refers to.
function drawDimensionMark(ctx, dpr, x1, y1, x2, y2, label, orientation, spanPx, sizeFactor) {
  sizeFactor = sizeFactor || 1;
  ctx.save();
  ctx.strokeStyle = '#F3E9DE';
  ctx.lineWidth = dpr;
  const tick = 5 * dpr * sizeFactor;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  if (orientation === 'horizontal') {
    ctx.moveTo(x1, y1 - tick / 2); ctx.lineTo(x1, y1 + tick / 2);
    ctx.moveTo(x2, y2 - tick / 2); ctx.lineTo(x2, y2 + tick / 2);
  } else {
    ctx.moveTo(x1 - tick / 2, y1); ctx.lineTo(x1 + tick / 2, y1);
    ctx.moveTo(x2 - tick / 2, y2); ctx.lineTo(x2 + tick / 2, y2);
  }
  ctx.stroke();

  ctx.fillStyle = '#F3E9DE';
  ctx.textAlign = 'center';
  let fontSize = Math.max(7 * dpr, tick * 1.4) * sizeFactor;
  ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;
  const maxTextW = Math.max(spanPx, 1);
  const w = ctx.measureText(label).width;
  if (w > maxTextW) fontSize *= maxTextW / w;
  fontSize = Math.max(fontSize, 6 * dpr);
  ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;

  if (orientation === 'horizontal') {
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, (x1 + x2) / 2, Math.min(y1, y2) - 3 * dpr);
  } else {
    ctx.save();
    ctx.translate((x1 + x2) / 2, (y1 + y2) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, 0, -tick / 2 - 3 * dpr);
    ctx.restore();
  }
  ctx.restore();
}

// Draws one tile cell (fill + stroke + either a dimension mark for a cut
// piece or a "FULL" label for an uncut one). Shared by the normal grid
// renderer and the tapered/crooked-space renderer so both stay consistent.
function drawTileCell(ctx, dpr, scale, xIn, yIn, wIn, hIn, isWidthCut, isHeightCut) {
  const cellX = xIn * scale, cellY = yIn * scale;
  const cellW = wIn * scale, cellH = hIn * scale;
  const isCut = isWidthCut || isHeightCut;

  ctx.fillStyle = isCut ? 'rgba(90,171,168,0.55)' : 'rgba(62,124,122,0.35)';
  ctx.fillRect(cellX, cellY, cellW, cellH);
  ctx.strokeStyle = '#EDEAE4';
  ctx.lineWidth = dpr;
  ctx.strokeRect(cellX, cellY, cellW, cellH);

  if (!isCut) {
    if (cellW > 30 * dpr && cellH > 16 * dpr) {
      ctx.save();
      ctx.fillStyle = 'rgba(243,233,222,0.55)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.beginPath();
      ctx.rect(cellX, cellY, cellW, cellH);
      ctx.clip();
      ctx.translate(cellX + cellW / 2, cellY + cellH / 2);
      let fontSize = Math.max(8 * dpr, Math.min(cellW, cellH) * 0.16);
      ctx.font = `600 ${fontSize}px 'JetBrains Mono', monospace`;
      const w = ctx.measureText('FULL').width;
      const maxTextW = cellW - 8 * dpr;
      if (w > maxTextW) fontSize *= maxTextW / w;
      fontSize = Math.max(fontSize, 6 * dpr);
      ctx.font = `600 ${fontSize}px 'JetBrains Mono', monospace`;
      ctx.fillText('FULL', 0, 0);
      ctx.restore();
    }
    return;
  }

  const margin = Math.min(cellW, cellH) * 0.18;
  ctx.save();
  ctx.beginPath();
  ctx.rect(cellX, cellY, cellW, cellH);
  ctx.clip();

  if (isWidthCut && isHeightCut) {
    const m = Math.min(cellW, cellH) * 0.16;
    if (cellW > 18 * dpr && cellH > 14 * dpr) {
      drawDimensionMark(ctx, dpr,
        cellX + m, cellY + cellH - m, cellX + cellW - m, cellY + cellH - m,
        `${wIn.toFixed(1)}"`, 'horizontal', cellW - m * 2, 0.85);
    }
    if (cellH > 18 * dpr && cellW > 14 * dpr) {
      drawDimensionMark(ctx, dpr,
        cellX + cellW - m, cellY + m, cellX + cellW - m, cellY + cellH - m,
        `${hIn.toFixed(1)}"`, 'vertical', cellH - m * 2, 0.85);
    }
  } else if (isHeightCut) {
    if (cellH > 16 * dpr && cellW > 8 * dpr) {
      drawDimensionMark(ctx, dpr,
        cellX + cellW / 2, cellY + margin, cellX + cellW / 2, cellY + cellH - margin,
        `${hIn.toFixed(1)}"`, 'vertical', cellH - margin * 2);
    }
  } else {
    if (cellW > 16 * dpr && cellH > 8 * dpr) {
      drawDimensionMark(ctx, dpr,
        cellX + margin, cellY + cellH / 2, cellX + cellW - margin, cellY + cellH / 2,
        `${wIn.toFixed(1)}"`, 'horizontal', cellW - margin * 2);
    }
  }
  ctx.restore();
}

function drawLayout(layout) {
  const canvas = document.getElementById('layoutCanvas');
  const dpr = window.devicePixelRatio || 1;
  // Render at the canvas's actual on-screen CSS width × device pixel ratio,
  // instead of a fixed 8px/inch that could be far larger than the display
  // width. Drawing oversized and letting the browser squeeze it down via
  // CSS was blurring/erasing the thin grout lines on cut rows/columns —
  // exactly where the corner detail matters most.
  const displayWidth = canvas.parentElement.clientWidth || Math.min(window.innerWidth - 48, 480);
  const padding = 34; // extra room for the width/height labels along the edges
  // With a tapered (crooked-space) layout, some columns/rows are taller or
  // wider than the average — size the canvas to the tallest/widest local
  // measurement so nothing gets clipped off.
  const drawWidth = layout.rowTaper ? Math.max(layout.wallWidth, ...layout.rowTaper.map(r => r.localWidth)) : layout.wallWidth;
  const drawHeight = layout.colTaper ? Math.max(layout.wallHeight, ...layout.colTaper.map(c => c.localHeight)) : layout.wallHeight;
  const scale = Math.max((displayWidth - padding * 2) / drawWidth, 2) * dpr;
  const pad = padding * dpr;
  // The wall itself is always the real rectangle — diamond mode never
  // rotates the wall, only the tile grid inside it. So canvas size always
  // matches the true wallWidth × wallHeight, never an expanded diagonal box.
  canvas.width = drawWidth * scale + pad * 2;
  canvas.height = drawHeight * scale + pad * 2;
  canvas.style.width = displayWidth + 'px';
  canvas.style.height = (canvas.height / dpr) + 'px';
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1a1918';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  // Clip to the true wall rectangle BEFORE rotating anything, so only the
  // tile pattern spins — pieces that cross the real wall edge get trimmed
  // by this clip into the natural triangular/pentagon corner shapes,
  // instead of the wall boundary itself appearing as a rotated diamond.
  ctx.beginPath();
  ctx.rect(-drawWidth * scale / 2, -drawHeight * scale / 2, drawWidth * scale, drawHeight * scale);
  ctx.clip();

  if (layout.diagonalMode) {
    // Diamond mode: tile a generously oversized, unrotated-internally grid
    // of full tiles, rotate the whole grid 45°, and let the clip above trim
    // it to the real wall shape. No per-row cut/offset bookkeeping needed
    // here — the clip alone produces the correct triangular edge pieces.
    ctx.rotate(Math.PI / 4);
    const span = layout.wallWidth + layout.wallHeight; // generous cover margin
    const nCols = Math.ceil(span / layout.effW) + 2;
    const nRows = Math.ceil(span / layout.effH) + 2;
    const gridW = nCols * layout.effW;
    const gridH = nRows * layout.effH;
    ctx.translate(-gridW * scale / 2, -gridH * scale / 2);
    ctx.strokeStyle = '#EDEAE4';
    ctx.lineWidth = dpr;
    for (let r = 0; r < nRows; r++) {
      for (let c = 0; c < nCols; c++) {
        const px = c * layout.tileW * scale;
        const py = r * layout.tileH * scale;
        ctx.fillStyle = 'rgba(62,124,122,0.35)';
        ctx.fillRect(px, py, layout.tileW * scale, layout.tileH * scale);
        ctx.strokeRect(px, py, layout.tileW * scale, layout.tileH * scale);
      }
    }
    ctx.restore();
    drawSpaceDimensionLabels(ctx, layout, scale, dpr, pad);
    return;
  }

  ctx.translate(-drawWidth * scale / 2, -drawHeight * scale / 2);

  if (layout.colTaper && layout.pattern === 'straight') {
    drawTaperedStraightLayout(ctx, layout, scale, dpr, drawWidth, drawHeight);
    ctx.restore();
    drawSpaceDimensionLabels(ctx, layout, scale, dpr, pad);
    return;
  }

  // Build rows bottom-to-top. Every row — cut or full — is a real course in
  // the running-bond sequence and gets its own sequential courseIdx, so the
  // offset keeps alternating right through a trimmed edge row instead of
  // "flatlining" to match its full-tile neighbor. That's how running bond
  // actually works on site: every course alternates, cut or not.
  const rowsBU = [];
  let courseSeq = 0;
  if (layout.edgeCutHStart > 0.05) rowsBU.push({ height: layout.edgeCutHStart, edge: true, courseIdx: courseSeq++ });
  for (let i = 0; i < layout.rowsFull; i++) rowsBU.push({ height: layout.tileH, edge: false, courseIdx: courseSeq++ });
  if (layout.edgeCutHEnd > 0.05) rowsBU.push({ height: layout.edgeCutHEnd, edge: true, courseIdx: courseSeq++ });

  let y = 0;
  for (let idx = rowsBU.length - 1; idx >= 0; idx--) {
    const row = rowsBU[idx];
    const rh = row.height;
    const isCutRow = row.edge;

    let colWidths;
    if (layout.pattern === 'straight') {
      colWidths = [];
      if (layout.edgeCutWStart > 0.05) colWidths.push({ width: layout.edgeCutWStart, cut: true });
      for (let i = 0; i < layout.colsFull; i++) colWidths.push({ width: layout.tileW, cut: false });
      if (layout.edgeCutWEnd > 0.05) colWidths.push({ width: layout.edgeCutWEnd, cut: true });
    } else {
      const offset = rowOffset(layout.pattern, row.courseIdx, layout.effW);
      colWidths = buildRowColumns(layout.effW, layout.wallWidth, offset);
    }

    let x = 0;
    for (const col of colWidths) {
      drawTileCell(ctx, dpr, scale, x, y, col.width, rh, col.cut, isCutRow);
      x += col.width;
    }
    y += rh;
  }

  ctx.restore();
  drawSpaceDimensionLabels(ctx, layout, scale, dpr, pad);
}

// Renders a crooked-space + straight-pattern layout, where the wall's real
// height/width tapers between the two measured sides on each axis. The
// full-tile block sits at one FIXED position (same for every column/row —
// that's what keeps the courses level), while each edge cut piece takes on
// its own real size at that specific column/row, computed in computeLayout
// as colTaper/rowTaper. This is the "diminishing course" technique
// installers use to keep the chosen reference side straight on an
// out-of-square wall.
function drawTaperedStraightLayout(ctx, layout, scale, dpr, drawWidth, drawHeight) {
  const { colTaper, rowTaper, rowsFull, colsFull, tileW, tileH } = layout;
  const xOffset = (drawWidth - layout.wallWidth) / 2;
  const yOffset = (drawHeight - layout.wallHeight) / 2;
  const xFullLeft = xOffset + layout.edgeCutWStart;
  const yFullTop = yOffset + layout.edgeCutHEnd;

  const hasLeftCut = layout.edgeCutWStart > 0.05;
  const hasRightCut = layout.edgeCutWEnd > 0.05;
  const hasTopCut = layout.edgeCutHEnd > 0.05;
  const hasBottomCut = layout.edgeCutHStart > 0.05;

  // colTaper/rowTaper are ordered [leftOrBottomCut?, ...full, rightOrTopCut?]
  // matching how they were built in computeLayout — map that directly to
  // slot indices here so full/cut cells line up with the right taper entry.
  const colSlots = []; // {kind: 'left'|'full'|'right', taper}
  let ci = 0;
  if (hasLeftCut) colSlots.push({ kind: 'left', taper: colTaper[ci++] });
  for (let i = 0; i < colsFull; i++) colSlots.push({ kind: 'full', taper: colTaper[ci++] });
  if (hasRightCut) colSlots.push({ kind: 'right', taper: colTaper[ci++] });

  const rowSlots = []; // bottom-up: {kind: 'bottom'|'full'|'top', taper}
  let ri = 0;
  if (hasBottomCut) rowSlots.push({ kind: 'bottom', taper: rowTaper[ri++] });
  for (let i = 0; i < rowsFull; i++) rowSlots.push({ kind: 'full', taper: rowTaper[ri++] });
  if (hasTopCut) rowSlots.push({ kind: 'top', taper: rowTaper[ri++] });

  // x positions for full columns are fixed left-to-right from xFullLeft.
  const colX = new Array(colSlots.length);
  const colW = new Array(colSlots.length);
  let xc = xFullLeft;
  for (let c = 0; c < colSlots.length; c++) {
    if (colSlots[c].kind === 'full') { colX[c] = xc; colW[c] = tileW; xc += tileW; }
  }
  const leftIdx = colSlots.findIndex(s => s.kind === 'left');
  if (leftIdx >= 0) { colX[leftIdx] = xFullLeft - layout.edgeCutWStart; colW[leftIdx] = layout.edgeCutWStart; }
  const rightIdx = colSlots.findIndex(s => s.kind === 'right');
  if (rightIdx >= 0) { colX[rightIdx] = xFullLeft + colsFull * tileW; colW[rightIdx] = layout.edgeCutWEnd; }

  // y positions for full rows are fixed, stacked from yFullTop downward.
  const rowY = new Array(rowSlots.length);
  const rowH = new Array(rowSlots.length);
  let yc = yFullTop;
  for (let r = rowSlots.length - 1; r >= 0; r--) {
    if (rowSlots[r].kind === 'full') { rowY[r] = yc; rowH[r] = tileH; yc += tileH; }
  }
  const bottomIdx = rowSlots.findIndex(s => s.kind === 'bottom');
  if (bottomIdx >= 0) { rowY[bottomIdx] = yFullTop + rowsFull * tileH; rowH[bottomIdx] = layout.edgeCutHStart; }
  const topIdx = rowSlots.findIndex(s => s.kind === 'top');
  if (topIdx >= 0) { rowY[topIdx] = yFullTop - layout.edgeCutHEnd; rowH[topIdx] = layout.edgeCutHEnd; }

  // Draw top-to-bottom (reverse of the bottom-up rowSlots order).
  for (let r = rowSlots.length - 1; r >= 0; r--) {
    const rowSlot = rowSlots[r];
    for (let c = 0; c < colSlots.length; c++) {
      const colSlot = colSlots[c];
      const isHeightCut = rowSlot.kind !== 'full';
      const isWidthCut = colSlot.kind !== 'full';

      let cellX, cellW;
      if (colSlot.kind === 'full') { cellX = colX[c]; cellW = colW[c]; }
      else {
        // Cut column: width comes from THIS row's own taper (varies per row).
        const w = colSlot.kind === 'left'
          ? (rowSlot.taper ? rowSlot.taper.edgeCutWStart : layout.edgeCutWStart)
          : (rowSlot.taper ? rowSlot.taper.edgeCutWEnd : layout.edgeCutWEnd);
        cellW = w;
        cellX = colSlot.kind === 'left' ? xFullLeft - w : xFullLeft + colsFull * tileW;
      }

      let cellY, cellH;
      if (rowSlot.kind === 'full') { cellY = rowY[r]; cellH = rowH[r]; }
      else {
        // Cut row: height comes from THIS column's own taper (varies per column).
        const h = rowSlot.kind === 'bottom'
          ? (colSlot.taper ? colSlot.taper.edgeCutHStart : layout.edgeCutHStart)
          : (colSlot.taper ? colSlot.taper.edgeCutHEnd : layout.edgeCutHEnd);
        cellH = h;
        cellY = rowSlot.kind === 'bottom' ? yFullTop + rowsFull * tileH : yFullTop - h;
      }

      if (cellW <= 0.05 || cellH <= 0.05) continue; // nothing to draw at this intersection
      drawTileCell(ctx, dpr, scale, cellX, cellY, cellW, cellH, isWidthCut, isHeightCut);
    }
  }
}
// Plain, no-decisions-required instructions. The horizontal (floor/ceiling)
// reference always follows vertAnchor. The vertical (side-wall) reference
// follows horizAnchor for the straight pattern; offset patterns (brick/1-3)
// keep measuring from the right wall, since the running pattern itself
// dictates where the cut falls.
// ---------- Installation start-point guide ----------
// Plain, no-decisions-required instructions. The horizontal (floor/ceiling)
// reference always follows vertAnchor. The vertical (side-wall) reference
// follows horizAnchor for the straight pattern; offset patterns (brick/1-3)
// keep measuring from the right wall, since the running pattern itself
// dictates where the cut falls.
function buildInstallGuide(layout) {
  if (layout.diagonalMode) {
    return `<p><strong>Linha central (45°):</strong> marque uma linha cruzando o espaço na diagonal, passando pelo centro. Comece a colocar os tiles a partir dela, alinhando os dois sentidos.</p>`;
  }

  if (layout.colTaper) {
    return `<p><strong>Espaço torto:</strong> comece pelas peças inteiras (marcadas "FULL" no desenho) — elas ficam todas no mesmo nível/prumo, começando do meio pra fora. Cada peça de corte nas bordas tem sua própria medida, mostrada diretamente nela no desenho acima — meça e corte peça por peça, não use uma medida única pra todas.</p>`;
  }

  let html;
  if (layout.edgeCutHStart > 0.05) {
    html = `<p><strong>Linha 1 (horizontal, a partir do chão):</strong> ${layout.edgeCutHStart}". Essa é a base — as próximas fileiras sobem a cada ${layout.effH.toFixed(2)}".</p>`;
  } else {
    html = `<p><strong>Linha 1 (horizontal):</strong> peça inteira encostada direto no chão, sem corte na base. As próximas fileiras sobem a cada ${layout.effH.toFixed(2)}".</p>`;
  }

  if (layout.pattern === 'straight') {
    if (layout.horizAnchor === 'left') {
      html += layout.edgeCutWEnd > 0.05
        ? `<p><strong>Linha vertical:</strong> peça inteira encostada na parede esquerda. O corte de ${layout.edgeCutWEnd}" fica na lateral direita.</p>`
        : `<p><strong>Linha vertical:</strong> peças inteiras de ponta a ponta — a largura fecha exata, sem corte lateral.</p>`;
    } else if (layout.horizAnchor === 'right') {
      html += layout.edgeCutWStart > 0.05
        ? `<p><strong>Linha vertical:</strong> peça inteira encostada na parede direita. O corte de ${layout.edgeCutWStart}" fica na lateral esquerda.</p>`
        : `<p><strong>Linha vertical:</strong> peças inteiras de ponta a ponta — a largura fecha exata, sem corte lateral.</p>`;
    } else {
      html += layout.edgeCutWStart > 0.05
        ? `<p><strong>Linha vertical:</strong> ${layout.edgeCutWStart}" de corte em cada lateral (esquerda e direita), peças inteiras no meio.</p>`
        : `<p><strong>Linha vertical:</strong> peças inteiras de ponta a ponta — a largura fecha exata, sem corte lateral.</p>`;
    }
    return html;
  }

  const rowTypeCount = { brick: 2, third: 3, thirdMirrored: 2 }[layout.pattern];
  const rowDistances = [];
  for (let t = 0; t < rowTypeCount; t++) {
    const offset = rowOffset(layout.pattern, t, layout.effW);
    const cols = buildRowColumns(layout.effW, layout.wallWidth, offset);
    const first = cols[0];
    const distFromRight = (first && first.cut) ? +first.width.toFixed(2) : 0;
    rowDistances.push(distFromRight);
  }

  html += `<p><strong>Linha(s) vertical(is), a partir da parede direita</strong> (padrões com deslocamento sempre usam a parede direita como referência — a "peça inteira encostada em" do passo 2 não se aplica aqui):</p><ul style="padding-left:20px; margin:6px 0;">`;
  if (rowTypeCount === 2) {
    html += `<li>Fileira 1, 3, 5...: ${rowDistances[0]}"</li>`;
    html += `<li>Fileira 2, 4, 6...: ${rowDistances[1]}"</li>`;
  } else {
    html += `<li>Fileira 1, 4, 7...: ${rowDistances[0]}"</li>`;
    html += `<li>Fileira 2, 5, 8...: ${rowDistances[1]}"</li>`;
    html += `<li>Fileira 3, 6, 9...: ${rowDistances[2]}"</li>`;
  }
  html += `</ul>`;

  return html;
}

async function runCalculation() {
  const layout = computeLayout();

  document.getElementById('loadingBox').style.display = 'flex';
  document.getElementById('resultContent').style.display = 'none';
  document.getElementById('errorBox').style.display = 'none';
  document.getElementById('resultSubtitle').textContent =
    'Calculando a melhor distribuição dos tiles no seu espaço...';

  document.getElementById('statCols').textContent = layout.colsRange || layout.totalCols;
  document.getElementById('statRows').textContent = layout.totalRows;
  document.getElementById('statTiles').textContent = layout.totalTiles;

  const materialStats = computeMaterialStats(layout);
  document.getElementById('statSqft').textContent = materialStats.sqft.toFixed(1);
  document.getElementById('statBuyTiles').textContent = materialStats.buyTiles
    + (materialStats.optimized ? '' : '*');
  document.getElementById('buyTilesNote').textContent = materialStats.optimized
    ? 'Já reaproveita sobras: 2 cortes de um lado só que cabem juntos numa peça só contam como 1 peça comprada (cantos cortados dos 2 lados não entram nesse reaproveitamento).'
    : '*Estimativa com 15% de folga — padrão diamante tem sobras triangulares que não reaproveitam de forma confiável.';
  drawLayout(layout);

  const orientationLabel = { horizontal: 'horizontal', vertical: 'vertical', diamond: 'diamante (45°)' }[layout.orientation];
  const patternLabel = { straight: 'reto', brick: 'amarração/brick', third: '1/3', thirdMirrored: '1/3 espelhado' }[layout.pattern];

  let note = `Orientação ${orientationLabel}, padrão ${patternLabel}. `;
  if (layout.diagonalMode) {
    note += `Em layout diamante, o cálculo já inclui cerca de 15% de material extra pra cobrir os cortes triangulares nas bordas — é uma estimativa; confirme o valor exato com quem for instalar.`;
  } else if (layout.colTaper) {
    // Crooked space + straight pattern: cuts are no longer one uniform
    // number — they're computed individually per column/row so the full
    // tiles stay level even though the wall itself tapers. Say so plainly
    // instead of reporting a single misleading "equal cuts" number.
    note += `O espaço é torto, então os cortes nas bordas não são todos iguais — cada peça de corte tem o tamanho exato calculado pra compensar a inclinação real da parede, mostrado peça por peça no desenho abaixo. As peças inteiras ficam todas no mesmo nível.`;
  } else if (layout.pattern === 'straight') {
    if (!layout.hasVerticalCut && !layout.hasHorizontalCut) {
      note += `Os tiles encaixam perfeitamente na largura e altura do espaço, sem cortes.`;
    } else {
      const parts = [];
      if ((layout.horizAnchor === 'center' || layout.horizRedistributed) && layout.hasVerticalCut) {
        parts.push(`cortes de ${layout.edgeCutWStart}" iguais nas duas laterais` + (layout.horizRedistributed ? ' (dividido pros dois lados pra evitar um corte fino demais só de um lado)' : ''));
      } else if (layout.hasVerticalCut) {
        const side = layout.horizAnchor === 'left' ? 'direita' : 'esquerda';
        parts.push(`corte de ${(layout.edgeCutWStart || layout.edgeCutWEnd).toFixed(2)}" só na lateral ${side} (peça inteira encostada na parede ${layout.horizAnchor === 'left' ? 'esquerda' : 'direita'})`);
      }
      if ((layout.vertAnchor === 'center' || layout.vertRedistributed) && layout.hasHorizontalCut) {
        parts.push(`cortes de ${layout.edgeCutHStart}" iguais em cima e embaixo` + (layout.vertRedistributed ? ' (dividido pros dois lados pra evitar um corte fino demais só de um lado)' : ''));
      } else if (layout.hasHorizontalCut) {
        const side = layout.vertAnchor === 'bottom' ? 'no topo' : 'na base';
        parts.push(`corte de ${(layout.edgeCutHStart || layout.edgeCutHEnd).toFixed(2)}" só ${side} (peça inteira encostada n${layout.vertAnchor === 'bottom' ? 'o chão' : 'o topo'})`);
      }
      note += parts.join(' e ') + `.`;
    }
  } else {
    note += `Cada fileira é deslocada horizontalmente (offset), então os cortes aparecem em pontos diferentes fileira a fileira — normal nesse tipo de padrão. O número de colunas varia entre ${layout.colsRange} por fileira.`;
  }
  if (layout.thinSliverWarning) {
    note += ` ⚠️ Mesmo puxando um tile a menos, não foi possível manter todos os cortes acima de ${MIN_CUT_IN}" — o espaço é pequeno demais em relação ao tamanho do tile escolhido. Considere um tile menor.`;
  }
  if (state.crooked && !layout.colTaper && (layout.heightVariation > 0.4 || layout.widthVariation > 0.4)) {
    const parts = [];
    if (layout.widthVariation > 0.4) parts.push(`a largura varia ${layout.widthVariation.toFixed(2)}" entre o topo e a base`);
    if (layout.heightVariation > 0.4) parts.push(`a altura varia ${layout.heightVariation.toFixed(2)}" entre a esquerda e a direita`);
    note += ` ${parts.join(', e ')}. Use nível a laser, comece a primeira fileira nivelada a partir do lado mais reto, e ajuste os cortes das bordas individualmente conforme a inclinação real.`;
  }
  document.getElementById('recommendationNote').textContent = note;

  document.getElementById('installGuideContent').innerHTML = buildInstallGuide(layout);
  document.getElementById('installGuideCard').style.display = 'block';

  document.getElementById('resultContent').style.display = 'flex';
  document.getElementById('resultSubtitle').textContent = 'Aqui está a distribuição calculada:';

  // Try AI image generation (optional — degrade gracefully if no key or fails)
  await tryGenerateImage(layout);
  document.getElementById('loadingBox').style.display = 'none';
}

async function tryGenerateImage(layout) {
  const apiKey = localStorage.getItem('openrouter_api_key');
  if (apiKey && state.wallDataUrl && state.tileDataUrl) {
    document.getElementById('loadingBox').style.display = 'flex';
    document.getElementById('errorBox').style.display = 'none';
    try {
      const imgUrl = await generateTiledImage(apiKey, layout);
      document.getElementById('aiResultImg').src = imgUrl;
      document.getElementById('aiImageCard').style.display = 'block';
    } catch (err) {
      document.getElementById('errorBox').style.display = 'block';
      document.getElementById('errorBox').textContent =
        'Não consegui gerar a imagem com IA (' + err.message + '). O diagrama acima com as medidas continua válido.';
    }
    document.getElementById('loadingBox').style.display = 'none';
  }
}

document.getElementById('regenBtn').addEventListener('click', () => {
  const layout = computeLayout();
  tryGenerateImage(layout);
});

// ---------- OpenRouter image editing (pay-as-you-go, $5 minimum) ----------
async function generateTiledImage(apiKey, layout) {
  const orientationLabel = { horizontal: 'na horizontal', vertical: 'na vertical', diamond: 'em diamante (45°)' }[layout.orientation];
  const patternLabel = { straight: 'em grade reta alinhada', brick: 'em amarração tipo brick (deslocamento de metade do tile a cada fileira)', third: 'com deslocamento de 1/3 (offset de um terço da largura do tile a cada fileira)', thirdMirrored: 'com deslocamento de 1/3 espelhado, alternando a cada fileira' }[layout.pattern];

  // Grab the already-computed layout diagram as a reference image so the
  // model can copy the exact grid/offset instead of guessing from text —
  // this was previously ignoring the chosen pattern and defaulting to straight.
  const diagramCanvas = document.getElementById('layoutCanvas');
  const diagramDataUrl = diagramCanvas.toDataURL('image/png');

  // Concrete numbers, not just adjectives — a model told "tile grande" can
  // still default to a generic small-subway-tile look. Anchoring the exact
  // column/row count and real inch sizes gives it something to actually
  // compute proportion against, instead of guessing scale from the photo.
  const prompt = `Tarefa de edição de imagem fotorrealista — siga com precisão literal, sem liberdade criativa e SEM interpretar ou estilizar. Você é uma ferramenta de overlay, não um designer.

Imagem 1 = a foto do espaço original (parede/piso), medindo ${layout.wallWidth.toFixed(0)}" × ${layout.wallHeight.toFixed(0)}" reais.
Imagem 2 = a foto real do tile a ser aplicado, medindo ${layout.tileW.toFixed(0)}" × ${layout.tileH.toFixed(0)}" reais — um tile GRANDE em relação à parede.
Imagem 3 = o diagrama exato do layout (grade + deslocamento entre fileiras) — é um blueprint literal a decalcar, não uma referência solta de estilo. NÃO reinterprete o padrão dela.

ESCALA (leia com atenção — erro comum é desenhar tiles pequenos demais):
- A grade tem exatamente ${layout.totalCols} coluna(s) e ${layout.totalRows} fileira(s) de tile cobrindo TODA a superfície.
- Cada tile individual ocupa aproximadamente 1/${layout.totalCols} da LARGURA da parede e 1/${layout.totalRows} da ALTURA da parede.
- Se a Imagem 3 mostra poucas peças grandes, a imagem final também deve mostrar poucas peças grandes — NÃO desenhe uma grade fina/miúda tipo subway tile. Cada peça individual deve claramente cobrir uma fração grande e visível da parede, do mesmo jeito que a Imagem 3 mostra.

PADRÃO (copie exatamente, não aproxime):
- A Imagem 3 usa o padrão: ${patternLabel}.
- Conte as colunas e o deslocamento fileira a fileira na Imagem 3 e replique essa contagem exata na imagem final — não substitua por uma grade reta nem por outro padrão de deslocamento.

MATERIAL:
- Cor, tom, textura e padrão do tile devem ser idênticos à Imagem 2 — não aproxime, não substitua por um tile "parecido" ou genérico.

CENA:
- Mantenha a perspectiva, o enquadramento, a iluminação e todos os outros elementos da foto original (móveis, porta, TV, objetos, teto, chão não revestido) inalterados. Não invente elementos que não estavam na foto.

Aplique os tiles orientados ${orientationLabel}, cobrindo toda a superfície, com linhas de rejunte finas e realistas seguindo exatamente a grade e o deslocamento da Imagem 3.`;

  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-image',
      modalities: ['image', 'text'],
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: state.wallDataUrl } },
          { type: 'image_url', image_url: { url: state.tileDataUrl } },
          { type: 'image_url', image_url: { url: diagramDataUrl } },
        ],
      }],
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`API retornou erro ${resp.status}: ${errText.slice(0, 150)}`);
  }

  const data = await resp.json();
  const images = data?.choices?.[0]?.message?.images;
  const imgUrl = images?.[0]?.image_url?.url;
  if (!imgUrl) throw new Error('a resposta não trouxe uma imagem');
  return imgUrl;
}

// ---------- Force update (dev convenience — wipes SW cache and reloads fresh) ----------
document.getElementById('forceUpdateBtn').addEventListener('click', async () => {
  const btn = document.getElementById('forceUpdateBtn');
  btn.textContent = '⏳ Atualizando...';
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch (e) {
    // Even if cleanup partially fails, still force a hard reload below.
  }
  // Cache-busting query param forces a true network fetch of index.html.
  // (App.js/style.css are separately versioned via ?v=vN in index.html,
  // which is the part that was actually going stale before.)
  window.location.replace(window.location.pathname + '?nocache=' + Date.now());
});
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
