// ---------- Version (bump this on every update — compare with what's on screen) ----------
const APP_VERSION = 'v19';
document.getElementById('appVersion').textContent = APP_VERSION;

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
});

document.getElementById('toStep3').addEventListener('click', () => {
  const w = parseFloat(document.getElementById('wallWidth').value);
  const h = parseFloat(document.getElementById('wallHeight').value);
  if (!w || !h) {
    alert('Preencha largura e altura do espaço.');
    return;
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

['tileWidth', 'tileHeight'].forEach(id => {
  document.getElementById(id).addEventListener('input', checkStep3Ready);
});
function checkStep3Ready() {
  const tw = parseFloat(document.getElementById('tileWidth').value);
  const th = parseFloat(document.getElementById('tileHeight').value);
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
  let n = Math.floor(total / unit);
  let rem = +(total - n * unit).toFixed(3);
  let guard = 0;
  while (rem > 0.01 && rem < minCut && n > 0 && guard < 20) {
    n -= 1;
    rem = +(total - n * unit).toFixed(3);
    guard++;
  }
  return {
    n, rem,
    edgeStart: anchor === 'end' ? rem : 0,
    edgeEnd: anchor === 'start' ? rem : 0,
    anchor,
  };
}

function computeLayout() {
  const wallWidth = parseFloat(document.getElementById('wallWidth').value);
  let wallHeight = parseFloat(document.getElementById('wallHeight').value);
  let tileW = parseFloat(document.getElementById('tileWidth').value);
  let tileH = parseFloat(document.getElementById('tileHeight').value);
  const groutIn = parseFloat(document.getElementById('groutWidth').value) || 0.125;
  const orientation = document.getElementById('tileOrientation').value; // horizontal | vertical | diamond
  const pattern = document.getElementById('tilePattern').value; // straight | brick | third | thirdMirrored
  const horizAnchor = document.getElementById('horizAnchor').value; // left | right | center
  const vertAnchor = document.getElementById('vertAnchor').value; // bottom | top | center

  let corners = null;
  let heightVariation = 0;
  if (state.crooked) {
    const tl = parseFloat(document.getElementById('cornerTL').value) || wallHeight;
    const tr = parseFloat(document.getElementById('cornerTR').value) || wallHeight;
    const bl = parseFloat(document.getElementById('cornerBL').value) || wallHeight;
    const br = parseFloat(document.getElementById('cornerBR').value) || wallHeight;
    corners = { tl, tr, bl, br };
    const heights = [tl, tr, bl, br];
    wallHeight = heights.reduce((a, b) => a + b, 0) / heights.length;
    heightVariation = Math.max(...heights) - Math.min(...heights);
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
  const totalRows = rowsFull + (edgeCutHStart > 0.05 ? 1 : 0) + (edgeCutHEnd > 0.05 ? 1 : 0);

  let colsFull, remW, edgeCutWStart, edgeCutWEnd, hasVerticalCut, totalCols, totalTiles, colsRange = null;

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
    totalCols = colsFull + (edgeCutWStart > 0.05 ? 1 : 0) + (edgeCutWEnd > 0.05 ? 1 : 0);
    totalTiles = Math.ceil(totalCols * totalRows * diagonalWaste);
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
    thinSliverWarning, corners, heightVariation,
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
  const cols = [];
  let remaining = wallWidth;
  if (offset > 0.05) {
    let firstW = Math.min(effW - offset, wallWidth);
    if (firstW < MIN_CUT_IN && remaining > effW) {
      firstW += effW; // fold the next full tile into this cut piece
    }
    cols.push({ width: firstW, cut: true });
    remaining -= firstW;
  }
  while (remaining > effW + 0.05) {
    cols.push({ width: effW, cut: false });
    remaining -= effW;
  }
  if (remaining > 0.05) {
    const isCut = remaining < effW - 0.05;
    if (isCut && remaining < MIN_CUT_IN && cols.length > 0) {
      // Merge this thin trailing piece into the previous full tile.
      const prev = cols[cols.length - 1];
      if (!prev.cut) {
        prev.width += remaining;
        prev.cut = false;
        remaining = 0;
      }
    }
    if (remaining > 0.05) cols.push({ width: remaining, cut: isCut });
  }
  return cols;
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
  const padding = 20;
  const scale = Math.max((displayWidth - padding * 2) / layout.wallWidth, 2) * dpr;
  const pad = padding * dpr;
  canvas.width = layout.wallWidth * scale + pad * 2;
  canvas.height = layout.wallHeight * scale + pad * 2;
  canvas.style.width = displayWidth + 'px';
  canvas.style.height = (canvas.height / dpr) + 'px';
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1a1918';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  if (layout.diagonalMode) ctx.rotate(Math.PI / 4);
  ctx.translate(-layout.wallWidth * scale / 2, -layout.wallHeight * scale / 2);

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
    if (layout.pattern === 'straight' || layout.diagonalMode) {
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
      const isCut = isCutRow || col.cut;
      ctx.fillStyle = isCut ? 'rgba(181,103,58,0.35)' : 'rgba(62,124,122,0.35)';
      ctx.fillRect(x * scale, y * scale, col.width * scale, rh * scale);
      ctx.strokeStyle = '#EDEAE4';
      ctx.lineWidth = dpr; // ~1 CSS pixel, crisp regardless of screen density
      ctx.strokeRect(x * scale, y * scale, col.width * scale, rh * scale);

      // Print the exact cut size on every cut piece — corners are exactly
      // where a purely visual read of a thin sliver is easiest to misjudge,
      // so the number removes any ambiguity regardless of how small it draws.
      if (isCut) {
        const cellW = col.width * scale;
        const cellH = rh * scale;
        const isCorner = isCutRow && col.cut;
        if (cellW > 14 * dpr && cellH > 10 * dpr) {
          ctx.save();
          ctx.fillStyle = '#F3E9DE';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.beginPath();
          ctx.rect(x * scale, y * scale, cellW, cellH);
          ctx.clip();
          const cx = x * scale + cellW / 2, cy = y * scale + cellH / 2;
          const maxTextW = cellW - 6 * dpr;

          if (isCorner) {
            // Corner piece: cut in both directions — stack width over height
            // instead of one long "W×H" string, which is what was
            // overflowing narrow corner cells.
            const wLabel = `${col.width.toFixed(1)}"`;
            const hLabel = `${rh.toFixed(1)}"`;
            let fontSize = Math.min(cellW, cellH) * 0.26;
            ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;
            const widest = Math.max(ctx.measureText(wLabel).width, ctx.measureText(hLabel).width);
            if (widest > maxTextW) fontSize *= maxTextW / widest;
            fontSize = Math.max(fontSize, 6 * dpr);
            ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;
            const lineH = fontSize * 1.2;
            ctx.fillText(wLabel, cx, cy - lineH / 2);
            ctx.fillText(hLabel, cx, cy + lineH / 2);
          } else {
            const label = isCutRow ? `${rh.toFixed(1)}"` : `${col.width.toFixed(1)}"`;
            let fontSize = Math.max(9 * dpr, Math.min(cellW, cellH) * 0.22);
            ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;
            const w = ctx.measureText(label).width;
            if (w > maxTextW) fontSize *= maxTextW / w;
            fontSize = Math.max(fontSize, 6 * dpr);
            ctx.font = `${fontSize}px 'JetBrains Mono', monospace`;
            ctx.fillText(label, cx, cy);
          }
          ctx.restore();
        }
      }
      x += col.width;
    }
    y += rh;
  }

  ctx.restore();
}

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
  drawLayout(layout);

  const orientationLabel = { horizontal: 'horizontal', vertical: 'vertical', diamond: 'diamante (45°)' }[layout.orientation];
  const patternLabel = { straight: 'reto', brick: 'amarração/brick', third: '1/3', thirdMirrored: '1/3 espelhado' }[layout.pattern];

  let note = `Orientação ${orientationLabel}, padrão ${patternLabel}. `;
  if (layout.diagonalMode) {
    note += `Em layout diamante, o cálculo já inclui cerca de 15% de material extra pra cobrir os cortes triangulares nas bordas — é uma estimativa; confirme o valor exato com quem for instalar.`;
  } else if (layout.pattern === 'straight') {
    if (!layout.hasVerticalCut && !layout.hasHorizontalCut) {
      note += `Os tiles encaixam perfeitamente na largura e altura do espaço, sem cortes.`;
    } else {
      const parts = [];
      if (layout.horizAnchor === 'center' && layout.hasVerticalCut) {
        parts.push(`cortes de ${layout.edgeCutWStart}" iguais nas duas laterais`);
      } else if (layout.hasVerticalCut) {
        const side = layout.horizAnchor === 'left' ? 'direita' : 'esquerda';
        parts.push(`corte de ${(layout.edgeCutWStart || layout.edgeCutWEnd).toFixed(2)}" só na lateral ${side} (peça inteira encostada na parede ${layout.horizAnchor === 'left' ? 'esquerda' : 'direita'})`);
      }
      if (layout.vertAnchor === 'center' && layout.hasHorizontalCut) {
        parts.push(`cortes de ${layout.edgeCutHStart}" iguais em cima e embaixo`);
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
  if (state.crooked && layout.heightVariation > 0.4) {
    note += ` O espaço varia ${layout.heightVariation.toFixed(2)}" entre os cantos — use nível a laser, comece a primeira fileira nivelada a partir do ponto mais alto, e ajuste os cortes da última fileira individualmente conforme a inclinação real.`;
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
  const patternLabel = { straight: 'em grade reta alinhada', brick: 'em amarração tipo brick (deslocamento de metade do tile a cada fileira)', third: 'com deslocamento progressivo de 1/3 a cada fileira', thirdMirrored: 'com deslocamento de 1/3 espelhado, alternando a cada fileira' }[layout.pattern];

  // Grab the already-computed layout diagram as a reference image so the
  // model can copy the exact grid/offset instead of guessing from text —
  // this was previously ignoring the chosen pattern and defaulting to straight.
  const diagramCanvas = document.getElementById('layoutCanvas');
  const diagramDataUrl = diagramCanvas.toDataURL('image/png');

  const prompt = `Tarefa de edição de imagem fotorrealista — siga com precisão literal, sem liberdade criativa.

Imagem 1 = a foto do espaço original (parede/piso).
Imagem 2 = a foto real do tile a ser aplicado.
Imagem 3 = o diagrama exato do layout de instalação (linhas de rejunte e deslocamento entre fileiras) que você DEVE reproduzir — não é decoração, é a grade literal a copiar.

Regras, na ordem de importância:
1. O PADRÃO da grade de rejunte na imagem final deve seguir exatamente a Imagem 3: ${patternLabel}. Se a Imagem 3 mostra fileiras deslocadas horizontalmente entre si, a imagem final também precisa mostrar esse deslocamento — NÃO gere uma grade reta se a Imagem 3 não é reta.
2. A cor, o tom, a textura e o padrão do tile devem ser idênticos à Imagem 2 — não aproxime, não substitua por um tile "parecido" ou genérico.
3. Mantenha a perspectiva, o enquadramento, a iluminação e todos os outros elementos da foto original (móveis, porta, TV, objetos, teto, chão não revestido) inalterados. Não invente elementos que não estavam na foto.

Aplique os tiles orientados ${orientationLabel}, cobrindo toda a superfície, com linhas de rejunte finas e realistas seguindo o deslocamento exato da Imagem 3.`;

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
