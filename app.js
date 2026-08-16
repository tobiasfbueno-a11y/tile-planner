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
  state.wallDataUrl = await fileToDataUrl(file);
  wallSlot.innerHTML = `<img src="${state.wallDataUrl}" alt="Foto da parede">`;
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
  state.tileDataUrl = await fileToDataUrl(file);
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
    alert('Preencha largura e altura da parede.');
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
  const tileW = parseFloat(document.getElementById('tileWidth').value);
  const tileH = parseFloat(document.getElementById('tileHeight').value);
  const groutMm = parseFloat(document.getElementById('groutWidth').value) || 3;
  const groutCm = groutMm / 10;

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

  const effW = tileW + groutCm;
  const effH = tileH + groutCm;

  const colsFull = Math.floor(wallWidth / effW);
  const remW = +(wallWidth - colsFull * effW).toFixed(1);
  const edgeCutW = +(remW / 2).toFixed(1);

  const rowsFull = Math.floor(wallHeight / effH);
  const remH = +(wallHeight - rowsFull * effH).toFixed(1);
  const edgeCutH = +(remH / 2).toFixed(1);

  const hasVerticalCut = remW > 0.5;
  const hasHorizontalCut = remH > 0.5;

  const totalCols = colsFull + (hasVerticalCut ? 2 : 0);
  const totalRows = rowsFull + (hasHorizontalCut ? 2 : 0);
  const totalTiles = totalCols * totalRows;

  const thinSliverWarning = (hasVerticalCut && edgeCutW < tileW * 0.25) ||
                             (hasHorizontalCut && edgeCutH < tileH * 0.25);

  return {
    wallWidth, wallHeight, tileW, tileH, groutCm,
    colsFull, remW, edgeCutW, hasVerticalCut,
    rowsFull, remH, edgeCutH, hasHorizontalCut,
    totalCols, totalRows, totalTiles,
    thinSliverWarning, corners, heightVariation,
  };
}

function drawLayout(layout) {
  const canvas = document.getElementById('layoutCanvas');
  const scale = 3.2; // px per cm
  const padding = 20;
  canvas.width = layout.wallWidth * scale + padding * 2;
  canvas.height = layout.wallHeight * scale + padding * 2;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1a1918';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(padding, padding);

  const colWidths = [];
  if (layout.hasVerticalCut) colWidths.push(layout.edgeCutW);
  for (let i = 0; i < layout.colsFull; i++) colWidths.push(layout.tileW);
  if (layout.hasVerticalCut) colWidths.push(layout.edgeCutW);

  const rowHeights = [];
  if (layout.hasHorizontalCut) rowHeights.push(layout.edgeCutH);
  for (let i = 0; i < layout.rowsFull; i++) rowHeights.push(layout.tileH);
  if (layout.hasHorizontalCut) rowHeights.push(layout.edgeCutH);

  let y = 0;
  for (let r = 0; r < rowHeights.length; r++) {
    let x = 0;
    const rh = rowHeights[r];
    const isCutRow = layout.hasHorizontalCut && (r === 0 || r === rowHeights.length - 1);
    for (let c = 0; c < colWidths.length; c++) {
      const cw = colWidths[c];
      const isCutCol = layout.hasVerticalCut && (c === 0 || c === colWidths.length - 1);
      const isCut = isCutRow || isCutCol;

      ctx.fillStyle = isCut ? 'rgba(181,103,58,0.35)' : 'rgba(62,124,122,0.35)';
      ctx.fillRect(x * scale, y * scale, cw * scale, rh * scale);
      ctx.strokeStyle = '#EDEAE4';
      ctx.lineWidth = 1;
      ctx.strokeRect(x * scale, y * scale, cw * scale, rh * scale);

      x += cw;
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
    'Calculando a melhor distribuição dos tiles na sua parede...';

  document.getElementById('statCols').textContent = layout.totalCols;
  document.getElementById('statRows').textContent = layout.totalRows;
  document.getElementById('statTiles').textContent = layout.totalTiles;
  drawLayout(layout);

  let note = `Layout centralizado: `;
  if (!layout.hasVerticalCut && !layout.hasHorizontalCut) {
    note += `os tiles encaixam perfeitamente na largura e altura da parede, sem cortes.`;
  } else {
    const parts = [];
    if (layout.hasVerticalCut) parts.push(`cortes de ${layout.edgeCutW} cm nas bordas laterais (esquerda e direita)`);
    if (layout.hasHorizontalCut) parts.push(`cortes de ${layout.edgeCutH} cm nas bordas de cima e baixo`);
    note += parts.join(' e ') + `. Os cortes ficam iguais dos dois lados, o que fica visualmente mais equilibrado do que jogar a sobra toda para um lado só.`;
  }
  if (layout.thinSliverWarning) {
    note += ` ⚠️ Atenção: uma das tiras de corte ficou bem fina, o que é frágil e feio. Considere ajustar o ponto de partida (começar meio tile mais cedo) ou usar um tile de tamanho diferente.`;
  }
  if (state.crooked && layout.heightVariation > 1) {
    note += ` A parede varia ${layout.heightVariation.toFixed(1)} cm de altura entre os cantos — use nível a laser, comece a primeira fileira nivelada a partir do canto mais alto, e ajuste os cortes da última fileira individualmente conforme a inclinação real do teto/chão.`;
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
  const prompt = `Renderização fotorrealista da parede de banheiro (primeira imagem) revestida com o padrão do tile de referência (segunda imagem). Respeite a perspectiva original, incluindo paredes tortas ou fora de esquadro. Use um layout com aproximadamente ${layout.totalCols} colunas e ${layout.totalRows} linhas, com rejunte fino e realista. Mantenha piso, teto, box e metais inalterados, sem adicionar elementos novos.`;

  const form = new FormData();
  form.append('image', dataUrlToBlob(state.wallDataUrl), 'parede.jpg');
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
