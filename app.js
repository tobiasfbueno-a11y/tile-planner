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
  document.getElementById('stepTag').textContent = `${idx + 1} / ${steps.length}`;
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

['tileWidth', 'tileHeight'].forEach(id => {
  document.getElementById(id).addEventListener('input', checkStep3Ready);
});
function checkStep3Ready() {
  const tw = parseFloat(document.getElementById('tileWidth').value);
  const th = parseFloat(document.getElementById('tileHeight').value);
  document.getElementById('toStep4').disabled = !(tw && th && state.tileDataUrl);
}

document.getElementById('toStep4').addEventListener('click', () => {
  const saved = localStorage.getItem('pollinations_api_key');
  if (saved) document.getElementById('apiKey').value = saved;
  goTo('screen-key');
});

document.getElementById('toStep5').addEventListener('click', () => {
  const key = document.getElementById('apiKey').value.trim();
  if (key) localStorage.setItem('pollinations_api_key', key);
  goTo('screen-result');
  runCalculation();
});

document.getElementById('restartBtn').addEventListener('click', () => {
  location.reload();
});

// ---------- Layout algorithm ----------
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
  const rowsFull = Math.floor(wallHeight / effH);
  const remH = +(wallHeight - rowsFull * effH).toFixed(2);
  const edgeCutH = +(remH / 2).toFixed(2);
  const hasHorizontalCut = remH > 0.05;
  const totalRows = rowsFull + (hasHorizontalCut ? 2 : 0);

  let colsFull, remW, edgeCutW, hasVerticalCut, totalCols, totalTiles, colsRange = null;

  if (pattern === 'straight' || diagonalMode) {
    // Centered grid: cuts split evenly on both edges, same for every row.
    colsFull = Math.floor(wallWidth / effW);
    remW = +(wallWidth - colsFull * effW).toFixed(2);
    edgeCutW = +(remW / 2).toFixed(2);
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

  const thinSliverWarning = (hasVerticalCut && edgeCutW > 0 && edgeCutW < tileW * 0.25) ||
                             (hasHorizontalCut && edgeCutH < tileH * 0.25);

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
function buildRowColumns(effW, wallWidth, offset) {
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
    cols.push({ width: remaining, cut: remaining < effW - 0.05 });
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

  const rowHeights = [];
  if (layout.hasHorizontalCut) rowHeights.push(layout.edgeCutH);
  for (let i = 0; i < layout.rowsFull; i++) rowHeights.push(layout.tileH);
  if (layout.hasHorizontalCut) rowHeights.push(layout.edgeCutH);

  let y = 0;
  for (let r = 0; r < rowHeights.length; r++) {
    const rh = rowHeights[r];
    const isCutRow = layout.hasHorizontalCut && (r === 0 || r === rowHeights.length - 1);

    let colWidths;
    if (layout.pattern === 'straight' || layout.diagonalMode) {
      colWidths = [];
      if (layout.hasVerticalCut) colWidths.push({ width: layout.edgeCutW, cut: true });
      for (let i = 0; i < layout.colsFull; i++) colWidths.push({ width: layout.tileW, cut: false });
      if (layout.hasVerticalCut) colWidths.push({ width: layout.edgeCutW, cut: true });
    } else {
      const offset = rowOffset(layout.pattern, r, layout.effW);
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
    note += ` ⚠️ Atenção: uma das tiras de corte ficou bem fina, o que é frágil e feio. Considere ajustar o ponto de partida ou usar um tile de tamanho diferente.`;
  }
  if (state.crooked && layout.heightVariation > 0.4) {
    note += ` O espaço varia ${layout.heightVariation.toFixed(2)}" entre os cantos — use nível a laser, comece a primeira fileira nivelada a partir do ponto mais alto, e ajuste os cortes da última fileira individualmente conforme a inclinação real.`;
  }
  document.getElementById('recommendationNote').textContent = note;

  document.getElementById('resultContent').style.display = 'flex';
  document.getElementById('resultSubtitle').textContent = 'Aqui está a distribuição calculada:';

  // Try AI image generation (optional — degrade gracefully if no key or fails)
  const apiKey = localStorage.getItem('pollinations_api_key');
  if (apiKey && state.wallDataUrl && state.tileDataUrl) {
    document.getElementById('loadingBox').style.display = 'flex';
    try {
      const imgUrl = await generateTiledImage(apiKey, layout);
      document.getElementById('aiResultImg').src = imgUrl;
      document.getElementById('aiImageCard').style.display = 'block';
    } catch (err) {
      document.getElementById('errorBox').style.display = 'block';
      document.getElementById('errorBox').textContent =
        'Não consegui gerar a imagem com IA (' + err.message + '). O diagrama acima com as medidas continua válido.';
    }
  }
  document.getElementById('loadingBox').style.display = 'none';
}

// ---------- Pollinations.ai image editing (free tier) ----------
function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',');
  const mime = header.substring(5, header.indexOf(';'));
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function generateTiledImage(apiKey, layout) {
  const orientationLabel = { horizontal: 'na horizontal', vertical: 'na vertical', diamond: 'em diamante (45°)' }[layout.orientation];
  const patternLabel = { straight: 'em grade reta alinhada', brick: 'em amarração tipo brick (deslocamento de metade do tile a cada fileira)', third: 'com deslocamento progressivo de 1/3 a cada fileira', thirdMirrored: 'com deslocamento de 1/3 espelhado, alternando a cada fileira' }[layout.pattern];

  const prompt = `Imagem 1: foto real de um espaço (parede ou piso) de banheiro.
Imagem 2: foto real de um tile/revestimento que deve ser aplicado nesse espaço.
Gere uma versão fotorrealista da Imagem 1 com a superfície completamente coberta pelo padrão, cor e textura exatos da Imagem 2 — use a Imagem 2 como referência literal, não invente outro tile.
Respeite a perspectiva original da foto, incluindo superfícies tortas ou fora de esquadro.
Aplique os tiles orientados ${orientationLabel}, ${patternLabel}, usando um layout com aproximadamente ${layout.totalCols} colunas e ${layout.totalRows} linhas, com linhas de rejunte finas e realistas.
Mantenha todo o resto da foto original (piso, teto, box, metais, iluminação, enquadramento) inalterado. Não adicione elementos que não estavam na foto original.`;

  const form = new FormData();
  form.append('image', dataUrlToBlob(state.wallDataUrl), 'espaco.jpg');
  form.append('image', dataUrlToBlob(state.tileDataUrl), 'tile.jpg');
  form.append('prompt', prompt);
  form.append('model', 'nanobanana');

  const resp = await fetch('https://gen.pollinations.ai/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`API retornou erro ${resp.status}: ${errText.slice(0, 150)}`);
  }

  const data = await resp.json();
  const item = data?.data?.[0];
  if (!item) throw new Error('a resposta não trouxe uma imagem');
  if (item.url) return item.url;
  if (item.b64_json) return `data:image/png;base64,${item.b64_json}`;
  throw new Error('formato de resposta inesperado');
}

// ---------- Service worker (offline shell) ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
