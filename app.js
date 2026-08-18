// ---------- Version (bump this on every update — compare with what's on screen) ----------
const APP_VERSION = 'v14';
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

function computeLayout() {
  const wallWidth = parseFloat(document.getElementById('wallWidth').value);
  let wallHeight = parseFloat(document.getElementById('wallHeight').value);
  let tileW = parseFloat(document.getElementById('tileWidth').value);
  let tileH = parseFloat(document.getElementById('tileHeight').value);
  const groutIn = parseFloat(document.getElementById('groutWidth').value) || 0.125;
  const orientation = document.getElementById('tileOrientation').value; // horizontal | vertical | diamond
  const pattern = document.getElementById('tilePattern').value; // straight | brick | third | thirdMirrored

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
  const rowSplit = centeredSplit(wallHeight, effH, MIN_CUT_IN);
  const rowsFull = rowSplit.n;
  const remH = rowSplit.rem;
  const edgeCutH = rowSplit.edge;
  const hasHorizontalCut = remH > 0.05;
  const totalRows = rowsFull + (hasHorizontalCut ? 2 : 0);

  let colsFull, remW, edgeCutW, hasVerticalCut, totalCols, totalTiles, colsRange = null;

  if (pattern === 'straight' || diagonalMode) {
    // Centered grid: cuts split evenly on both edges, same for every row.
    const colSplit = centeredSplit(wallWidth, effW, MIN_CUT_IN);
    colsFull = colSplit.n;
    remW = colSplit.rem;
    edgeCutW = colSplit.edge;
    hasVerticalCut = remW > 0.05;
    totalCols = colsFull + (hasVerticalCut ? 2 : 0);
    totalTiles = Math.ceil(totalCols * totalRows * diagonalWaste);
  } else {
    // Running-bond style patterns: each row is offset horizontally, so the
    // cut pieces land in different spots row to row. Compute row by row.
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
    edgeCutW = +(remW / 2).toFixed(2);
    hasVerticalCut = true; // offset patterns virtually always produce edge cuts somewhere
    totalCols = maxCols;
    colsRange = minCols === maxCols ? `${minCols}` : `${minCols}–${maxCols}`;
    totalTiles = sumCols;
  }

  const thinSliverWarning = (hasVerticalCut && edgeCutW > 0 && edgeCutW < MIN_CUT_IN - 0.01) ||
                             (hasHorizontalCut && edgeCutH < MIN_CUT_IN - 0.01);

  return {
    wallWidth, wallHeight, tileW, tileH, groutIn,
    orientation, pattern, diagonalMode,
    colsFull, remW, edgeCutW, hasVerticalCut, colsRange,
    rowsFull, remH, edgeCutH, hasHorizontalCut,
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
  const scale = 8; // px per inch
  const padding = 20;
  canvas.width = layout.wallWidth * scale + padding * 2;
  canvas.height = layout.wallHeight * scale + padding * 2;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1a1918';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  if (layout.diagonalMode) ctx.rotate(Math.PI / 4);
  ctx.translate(-layout.wallWidth * scale / 2, -layout.wallHeight * scale / 2);

  // Build rows bottom-to-top. Edge (height-cut) rows are NOT their own
  // "course" in the offset cycle — they inherit the offset of the full-tile
  // course right next to them, so the vertical grout joints line up
  // continuously across the seam instead of jumping to a different offset.
  const hc = layout.hasHorizontalCut;
  const rowsBU = [];
  if (hc) rowsBU.push({ height: layout.edgeCutH, edge: true, courseIdx: 0 });
  for (let i = 0; i < layout.rowsFull; i++) rowsBU.push({ height: layout.tileH, edge: false, courseIdx: i });
  if (hc) rowsBU.push({ height: layout.edgeCutH, edge: true, courseIdx: Math.max(layout.rowsFull - 1, 0) });

  let y = 0;
  for (let idx = rowsBU.length - 1; idx >= 0; idx--) {
    const row = rowsBU[idx];
    const rh = row.height;
    const isCutRow = row.edge;

    let colWidths;
    if (layout.pattern === 'straight' || layout.diagonalMode) {
      colWidths = [];
      if (layout.hasVerticalCut) colWidths.push({ width: layout.edgeCutW, cut: true });
      for (let i = 0; i < layout.colsFull; i++) colWidths.push({ width: layout.tileW, cut: false });
      if (layout.hasVerticalCut) colWidths.push({ width: layout.edgeCutW, cut: true });
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
      ctx.lineWidth = 1;
      ctx.strokeRect(x * scale, y * scale, col.width * scale, rh * scale);
      x += col.width;
    }
    y += rh;
  }

  ctx.restore();
}

// ---------- Installation start-point guide ----------
// Plain, no-decisions-required instructions: exact snap-line distances from
// two fixed references (floor and right wall) — the app picks the
// reference, the installer just measures and marks.
function buildInstallGuide(layout) {
  if (layout.diagonalMode) {
    return `<p><strong>Linha central (45°):</strong> marque uma linha cruzando o espaço na diagonal, passando pelo centro. Comece a colocar os tiles a partir dela, alinhando os dois sentidos.</p>`;
  }

  const rowTypeCount = { straight: 1, brick: 2, third: 3, thirdMirrored: 2 }[layout.pattern];
  const rowDistances = [];
  for (let t = 0; t < rowTypeCount; t++) {
    const offset = rowOffset(layout.pattern, t, layout.effW);
    const cols = buildRowColumns(layout.effW, layout.wallWidth, offset);
    const first = cols[0];
    const distFromRight = (first && first.cut) ? +first.width.toFixed(2) : 0;
    rowDistances.push(distFromRight);
  }

  let html = `<p><strong>Linha 1 (horizontal, a partir do chão):</strong> ${layout.edgeCutH}". Essa é a base — as próximas fileiras sobem a cada ${layout.effH.toFixed(2)}".</p>`;

  html += `<p><strong>Linha(s) vertical(is), a partir da parede direita:</strong></p><ul style="padding-left:20px; margin:6px 0;">`;
  if (rowTypeCount === 1) {
    html += `<li>Todas as fileiras: ${rowDistances[0]}"</li>`;
  } else if (rowTypeCount === 2) {
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
      if (layout.hasVerticalCut) parts.push(`cortes de ${layout.edgeCutW}" nas bordas laterais (esquerda e direita)`);
      if (layout.hasHorizontalCut) parts.push(`cortes de ${layout.edgeCutH}" nas bordas de cima e baixo`);
      note += `Layout centralizado: ` + parts.join(' e ') + `. Os cortes ficam iguais dos dois lados, o que fica visualmente mais equilibrado do que jogar a sobra toda para um lado só.`;
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
  // Cache-busting query param forces a true network fetch of index.html/app.js.
  window.location.href = window.location.pathname + '?nocache=' + Date.now();
});
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
