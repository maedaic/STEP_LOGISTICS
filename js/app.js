/* =========================================================================
 * app.js — 配送レイアウトシステム メインロジック
 *
 * 設計の柱（SDS §10, §14）:
 *   荷台・商品はすべて実寸(mm)で state に保持する。
 *   画面は state を scale で px 変換して描画するだけ（可視化レイヤー）。
 * ======================================================================= */

'use strict';

const STORAGE_KEY = 'stepstudio_delivery_project';

/* ---------------------------------------------------------------------------
 * 状態
 * ------------------------------------------------------------------------- */
let state = {
  projectName: '新規案件',
  trucks: [],      // { instanceId, masterId, seq(業者4tのみ), viewMode }
  slips: [],       // アップロード伝票 { id, name, isImage, thumbUrl, items:[{code,qty}] }
  manual: [],      // 手入力 { id, code, qty, def:null|{name,width,depth,height,color} }
  products: [],    // ★導出（slips.items + manual を品番で集計）{ code, name, width, depth, height, qty, color }
  placements: [],  // { id, truckInstanceId, code, x, y, rotation }
  productModes: {},  // 折りたたみ対応商品の状態 { code: 'folded' | 'unfolded' }（③C24C等）
};

let pickedCode = null;   // クリック配置用に選択中の品番
let selectedPid = null;  // キャンバス上で選択中の配置（Deleteキー対象）
let accOpen = { step: false, gaisha: false }; // トラック一覧アコーディオンの開閉（グループ別）
let uidCounter = 1;
const uid = (p) => `${p}_${Date.now().toString(36)}_${uidCounter++}`;

/* ---------------------------------------------------------------------------
 * 起動
 * ------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  loadFromLocal();   // 保存済みがあれば復元。無ければ空（トラック0台）で開始（Ver1.1 §5）

  bindGlobalControls();
  renderAll();
  initAutoSave();

  // リサイズで scale が変わるため再描画（連打を間引く）
  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => renderCanvases(), 120);
  });
});

/* ---------------------------------------------------------------------------
 * 参照ヘルパー
 * ------------------------------------------------------------------------- */
function truckDims(truckInstance) {
  // 外部委託などマスター名変更に強いよう、常にマスターから寸法を引く
  const m = getTruckMaster(truckInstance.masterId);
  return m;
}
/** 荷台ブロック/PDFに表示する名称。業者4tは 業者4t-1, -2… と枝番を付ける */
function truckLabel(truckInstance) {
  const m = truckDims(truckInstance);
  return truckInstance.seq ? `${m.name}-${truckInstance.seq}` : m.name;
}
function placedCount(code) {
  // 二段積みは stack ぶん数量を消費する（C6等）
  return state.placements.filter(p => p.code === code).reduce((n, p) => n + (p.stack || 1), 0);
}
function remaining(product) {
  return product.qty - placedCount(product.code);
}
/** この商品は二段積み可能か（商品マスター参照）CENTER-003 */
function canStack(info) {
  return !!(info && info.stackable) && (info.maxStack || 1) > 1;
}
/** 商品コードから描画情報（サイズ・色）を取得。products優先→なければマスター */
function productInfo(code) {
  return state.products.find(p => p.code === code) || getProductMaster(code);
}
/** 回転を考慮したフットプリント(mm)。lenX=長さ方向, lenY=幅方向 */
function footprint(info, rotation) {
  return rotation === 90
    ? { lenX: info.depth, lenY: info.width }
    : { lenX: info.width, lenY: info.depth };
}

/* ---------------------------------------------------------------------------
 * 描画：全体
 * ------------------------------------------------------------------------- */
function renderAll() {
  document.getElementById('projectName').value = state.projectName;
  renderTruckMasterList();
  renderTruckAccordions();
  renderUploads();
  renderManualSlipOptions();
  renderProductList();
  renderCanvases();
  saveToLocal();
}

/* 2グループ（STEP車両 / 業者トラック）のアコーディオン開閉・選択台数を反映 */
function renderTruckAccordions() {
  [['step', 'stepAccHead', 'stepAccBody', 'stepAccCount'],
   ['gaisha', 'gaishaAccHead', 'gaishaAccBody', 'gaishaAccCount']].forEach(([g, headId, bodyId, countId]) => {
    const head = document.getElementById(headId);
    const body = document.getElementById(bodyId);
    if (!head || !body) return;
    const open = accOpen[g];
    head.setAttribute('aria-expanded', open ? 'true' : 'false');
    head.querySelector('.acc-caret').textContent = open ? '▼' : '▶';
    body.hidden = !open;
    const n = state.trucks.filter(t => (getTruckMaster(t.masterId) || {}).group === g).length;
    document.getElementById(countId).textContent = n > 0 ? `${n}台 選択中` : '';
  });
}

/* ---------- 左：トラックマスター一覧 ---------- */
function truckSvgIcon(active) {
  const c = active ? 'var(--blue)' : 'currentColor';
  return `<svg width="40" height="26" viewBox="0 0 40 26" fill="none" stroke="${c}" stroke-width="1.6">
    <rect x="1" y="6" width="22" height="13" rx="1.5"/>
    <path d="M23 10 h7 l6 5 v4 h-13 z"/>
    <circle cx="9" cy="21" r="2.4" fill="${c}"/><circle cx="30" cy="21" r="2.4" fill="${c}"/>
  </svg>`;
}
/** 荷台内寸を D/W/H 表記で返す（左・中央・PDFで統一）。§LEFT-003/CENTER-002 */
function cargoDWH(m) {
  return `D ${m.cargoLength}　W ${m.cargoWidth}　H ${m.cargoHeight}`;
}

function renderTruckMasterList() {
  renderTruckGroup('step', document.getElementById('truckListStep'));
  renderTruckGroup('gaisha', document.getElementById('truckListGaisha'));
}

function renderTruckGroup(group, host) {
  if (!host) return;
  host.innerHTML = '';
  TRUCK_MASTER.filter(m => m.group === group).forEach((m) => {
    const count = state.trucks.filter(t => t.masterId === m.id).length;
    const selected = count > 0;
    const card = document.createElement('button');
    card.className = 'truck-card'
      + (selected ? ' is-selected' : '')
      + (m.external ? ' is-external' : '')
      + (m.placeholder ? ' is-placeholder' : '');

    if (m.placeholder) {
      // 「その他」＝将来追加枠（選択不可）
      card.innerHTML = `
        <span class="truck-icon">${truckSvgIcon(false)}</span>
        <span class="truck-info">
          <span class="truck-name">${m.name}</span>
          <div class="truck-later">（将来追加予定）</div>
        </span>`;
    } else if (m.external) {
      card.innerHTML = `
        <span class="truck-icon">${truckSvgIcon(selected)}</span>
        <span class="truck-info">
          <span class="truck-name">${m.name}</span>
          <div class="truck-dims">${cargoDWH(m)}${m.estimated ? '（暫定）' : ''}</div>
          <div class="truck-later">${count > 0 ? `現在 ${count} 台` : '（複数追加可）'}</div>
        </span>
        <span class="truck-check">${count > 0 ? count : '＋'}</span>`;
    } else {
      card.innerHTML = `
        <span class="truck-icon">${truckSvgIcon(selected)}</span>
        <span class="truck-info">
          <span class="truck-name">${m.name}</span>
          <div class="truck-dims">${cargoDWH(m)}${m.estimated ? '（暫定）' : ''}</div>
        </span>
        <span class="truck-check">✓</span>`;
    }
    card.addEventListener('click', () => addTruck(m.id));
    host.appendChild(card);
  });
}

/**
 * 手入力(state.manual)に同一品番の行が複数あれば1行へ統合する（自己修復）。
 * 追加時のマージ漏れ（旧バージョンで作られたデータ含む）を都度解消し、
 * 「手入力」グループに同じ品番が2行以上並ぶ状態を残さない。
 */
function mergeManualDuplicates() {
  const seen = new Map();   // code -> merged entry
  const merged = [];
  state.manual.forEach(m => {
    const cur = seen.get(m.code);
    if (cur) {
      cur.qty += m.qty;
      if (!cur.def && m.def) cur.def = m.def;
    } else {
      const copy = { ...m };
      seen.set(m.code, copy);
      merged.push(copy);
    }
  });
  state.manual = merged;
}

/* ---------------------------------------------------------------------------
 * 商品一覧の集計（Ver1.2 §3）
 *   商品一覧 = アップロード伝票(slips)のOCR結果 ＋ 手入力(manual) を品番で合算。
 *   これにより「複数伝票で同じ品番」も自動集計され、伝票を削除すれば数量も戻る。
 * ------------------------------------------------------------------------- */
/**
 * 展開/折りたたみを切替可能な商品（③C24C等）の現在の実寸を返す。
 * 初期値は「折りたたみ」。state.productModes[code] === 'unfolded' のときのみ展開寸を使う。
 */
function effectiveMasterDims(master) {
  if (!master.folded) return { width: master.width, depth: master.depth, height: master.height };
  const mode = state.productModes[master.code] || 'folded';
  return mode === 'unfolded'
    ? { width: master.width, depth: master.depth, height: master.height }
    : { width: master.folded.width, depth: master.folded.depth, height: master.folded.height };
}

function rebuildProducts() {
  mergeManualDuplicates();   // 過去に分かれて保存された同一品番の手入力行を統合（自己修復）

  const agg = new Map();   // code -> { qty, def }
  const add = (code, qty, def) => {
    const cur = agg.get(code) || { qty: 0, def: null };
    cur.qty += qty;
    if (!cur.def && def) cur.def = def;
    agg.set(code, cur);
  };
  state.slips.forEach(s => (s.items || []).forEach(it => add(it.code, it.qty, null)));
  state.manual.forEach(m => add(m.code, m.qty, m.def));

  let ci = 0;
  const products = [];
  agg.forEach((v, code) => {
    const master = getProductMaster(code);
    if (master) {
      const dims = effectiveMasterDims(master);
      products.push({ code, name: master.name, width: dims.width, depth: dims.depth, height: dims.height, qty: v.qty, color: master.color, stackable: master.stackable, maxStack: master.maxStack, foldable: !!master.folded });
    } else if (v.def) {
      products.push({ code, name: v.def.name, width: v.def.width, depth: v.def.depth, height: v.def.height, qty: v.qty, color: v.def.color, stackable: null, maxStack: 1 });
    } else {
      products.push({ code, name: code, width: 400, depth: 400, height: 400, qty: v.qty, color: pickColor(ci), stackable: null, maxStack: 1 });
    }
    ci++;
  });
  state.products = products;
  trimExcessPlacements();
}

/** ③展開⇄折りたたみを切り替える（C24C等）。既存の配置も見た目に反映される */
function setFoldMode(code, mode) {
  if (state.productModes[code] === mode) return;
  state.productModes[code] = mode;
  rebuildProducts();
  renderProductList();
  renderCanvases();
  saveToLocal();
}

/** 集計後、数量が配置数(段数含む)を下回った品番は新しい配置/段から取り消す（伝票削除時の整合） */
function trimExcessPlacements() {
  const codes = [...new Set(state.placements.map(p => p.code))];
  codes.forEach(code => {
    const prod = state.products.find(p => p.code === code);
    const allowed = prod ? prod.qty : 0;
    let over = placedCount(code) - allowed;
    // 新しい配置から段を減らし、段が0になったら配置ごと削除
    for (let i = state.placements.length - 1; i >= 0 && over > 0; i--) {
      const pl = state.placements[i];
      if (pl.code !== code) continue;
      while ((pl.stack || 1) > 1 && over > 0) { pl.stack--; over--; }
      if (over > 0) { state.placements.splice(i, 1); over--; }
    }
  });
}

/* ---------- 左：アップロード伝票サムネイル一覧（Ver1.2 §2） ---------- */
function renderUploads() {
  const host = document.getElementById('slipList');
  if (!host) return;
  host.innerHTML = '';
  state.slips.forEach((s, idx) => {
    const row = document.createElement('div');
    row.className = 'slip-row';
    const itemsText = (s.items || []).map(it => `${it.code}×${it.qty}`).join('・') || '読取なし';
    const thumb = s.isImage && s.thumbUrl
      ? `<span class="slip-thumb"><img src="${s.thumbUrl}" alt=""></span>`
      : `<span class="slip-thumb">📄</span>`;
    row.innerHTML = `
      ${thumb}
      <span class="slip-info">
        <span class="slip-label">伝票${idx + 1}</span>
        <div class="slip-name">${s.name}</div>
        <div class="slip-items">${itemsText}</div>
      </span>
      <button class="slip-del" title="この伝票を削除">削除</button>`;
    row.querySelector('.slip-del').addEventListener('click', () => removeSlip(s.id));
    host.appendChild(row);
  });
}

function removeSlip(id) {
  const s = state.slips.find(x => x.id === id);
  if (s && s.thumbUrl) { try { URL.revokeObjectURL(s.thumbUrl); } catch (_) {} }
  state.slips = state.slips.filter(x => x.id !== id);
  rebuildProducts();
  renderUploads();
  renderManualSlipOptions();
  renderProductList();
  renderCanvases();
  saveToLocal();
}

/** 品番の残数（全ソース合算 − 配置済み）。表示は伝票単位でも在庫は内部集計（RIGHT-002） */
function remainingByCode(code) {
  const prod = state.products.find(p => p.code === code);
  return (prod ? prod.qty : 0) - placedCount(code);
}

/** 配置用の商品行（伝票・手入力グループ内で共通利用） */
function buildProductRow(code, qtyInSource) {
  const info = productInfo(code);
  const rem = remainingByCode(code);
  const row = document.createElement('div');
  row.className = 'product-row' + (pickedCode === code ? ' is-picked' : '');
  row.setAttribute('draggable', 'true');
  row.dataset.code = code;

  // ③展開⇄折りたたみトグル（対応商品のみ・初期値は折りたたみ）
  const isFoldable = !!(info.foldable || info.folded);
  const foldMode = state.productModes[code] || 'folded';
  const foldToggle = isFoldable ? `
    <div class="pr-fold">
      <button class="fold-btn ${foldMode === 'folded' ? 'is-on' : ''}" data-fold="folded">折りたたみ</button>
      <button class="fold-btn ${foldMode === 'unfolded' ? 'is-on' : ''}" data-fold="unfolded">展開</button>
    </div>` : '';

  row.innerHTML = `
    <div class="pr-top">
      <span class="pr-code">${code}</span>
      <span class="pr-qty">×${qtyInSource}</span>
    </div>
    <div class="pr-name">${info.name}　${info.width}×${info.depth}×${info.height}</div>
    ${foldToggle}
    <div class="pr-remain ${rem <= 0 ? 'is-zero' : ''}">残${rem}</div>`;
  row.addEventListener('click', () => {
    pickedCode = (pickedCode === code) ? null : code;
    renderProductList();
  });
  row.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', code);
    e.dataTransfer.effectAllowed = 'copy';
  });
  if (isFoldable) {
    row.querySelectorAll('.fold-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();   // 行のクリック（品番選択）を誘発しない
        setFoldMode(code, btn.dataset.fold);
      });
    });
  }
  return row;
}

/* ---------- 右：商品一覧（伝票単位で表示・在庫は内部集計）RIGHT-002 ---------- */
function renderProductList() {
  const host = document.getElementById('productList');
  const autoBtn = document.getElementById('btnAutoPlace');
  host.innerHTML = '';

  if (state.slips.length === 0 && state.manual.length === 0) {
    host.innerHTML = `<div class="product-empty">
      <b>まだ商品がありません</b>
      左側から<div class="empty-types"><span class="chip">写真</span><span class="chip">PDF</span></div>
      をアップロードしてください。<br>（手入力でも追加できます）
    </div>`;
    if (autoBtn) autoBtn.hidden = true;
    return;
  }
  if (autoBtn) autoBtn.hidden = false;

  // 伝票ごとにグループ表示（同一品番でも合算せず伝票単位を維持）
  state.slips.forEach((s, idx) => {
    const group = document.createElement('div');
    group.className = 'ocr-group';
    const head = document.createElement('div');
    head.className = 'ocr-group-head';
    head.innerHTML = `<span class="ocr-group-title">伝票${idx + 1}</span>
      <span class="ocr-group-name">${s.name}</span>
      <button class="ocr-group-place" title="この伝票だけ自動配置">伝票のみ反映</button>
      <button class="ocr-group-del" title="この伝票を削除">削除</button>`;
    head.querySelector('.ocr-group-place').addEventListener('click', () => autoPlaceSlip(s.id));
    head.querySelector('.ocr-group-del').addEventListener('click', () => removeSlip(s.id));
    group.appendChild(head);
    if ((s.items || []).length === 0) {
      const none = document.createElement('div');
      none.className = 'ocr-empty';
      none.textContent = '読取結果なし';
      group.appendChild(none);
    }
    (s.items || []).forEach(it => group.appendChild(buildProductRow(it.code, it.qty)));
    host.appendChild(group);
  });

  // 手入力グループ
  if (state.manual.length > 0) {
    const group = document.createElement('div');
    group.className = 'ocr-group';
    group.innerHTML = `<div class="ocr-group-head"><span class="ocr-group-title">手入力</span></div>`;
    state.manual.forEach(m => {
      const row = buildProductRow(m.code, m.qty);
      const del = document.createElement('button');
      del.className = 'pr-del';
      del.textContent = '削除';
      del.title = 'この手入力を削除';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        state.manual = state.manual.filter(x => x.id !== m.id);
        rebuildProducts();
        renderProductList();
        renderCanvases();
        saveToLocal();
      });
      row.appendChild(del);
      group.appendChild(row);
    });
    host.appendChild(group);
  }
}

/* ---------------------------------------------------------------------------
 * 描画：荷台キャンバス
 * ------------------------------------------------------------------------- */
function renderCanvases() {
  const host = document.getElementById('truckCanvases');
  host.innerHTML = '';
  if (state.trucks.length === 0) {
    host.innerHTML = `<div class="empty-hint"><b>トラックが選択されていません</b><br>左側からトラックを選択してください</div>`;
    return;
  }
  state.trucks.forEach((t, idx) => {
    const m = truckDims(t);
    const mode = t.viewMode || 'top';
    const truckPlacements = state.placements.filter(p => p.truckInstanceId === t.instanceId);
    const hasPlace = truckPlacements.length > 0;
    const hasOOB = truckPlacements.some(p => isPlacementOOB(p, m));   // ②はみ出し警告
    const block = document.createElement('div');
    block.className = 'truck-block';
    block.innerHTML = `
      <div class="tb-head">
        <span class="tb-tag">トラック${idx + 1}</span>
        <span class="tb-name">${truckLabel(t)}</span>
        <span class="tb-actions">
          <button class="tb-btn ${mode === 'top' ? 'is-on' : ''}" data-view="top">上面図</button>
          <button class="tb-btn ${mode === 'side' ? 'is-on' : ''}" data-view="side">側面図</button>
          <button class="tb-btn tb-clear" data-clear="1" ${hasPlace ? '' : 'disabled'}>配置消去</button>
          <button class="tb-btn tb-del" data-del="1">削除</button>
        </span>
      </div>
      <div class="tb-dims">
        荷台内寸: <b>${cargoDWH(m)} mm</b>
        ${m.estimated ? '<span class="tb-est">※暫定値</span>' : ''}
      </div>
      ${hasOOB ? '<div class="tb-oob-warning">⚠ 商品が荷台からはみ出しています。配置を確認してください。</div>' : ''}
      <div class="dir-note">◀ 前方（運転席）：この向きが進行方向</div>
      <div class="canvas-wrap">
        <div class="truck-cab" title="前方（運転席）">
          <div class="cab-glass"></div>
          <span class="cab-label">前</span>
        </div>
        <div class="cargo"></div>
      </div>
      <div class="canvas-note">ドラッグ／クリックで配置（重ねられません・荷台外は不可）。ダブルクリックで90°回転／選択してDeleteで削除。</div>`;

    block.querySelector('[data-view="top"]').addEventListener('click', () => { t.viewMode = 'top'; renderCanvases(); });
    block.querySelector('[data-view="side"]').addEventListener('click', () => { t.viewMode = 'side'; renderCanvases(); });
    block.querySelector('[data-clear="1"]').addEventListener('click', () => clearTruckPlacements(t.instanceId));
    block.querySelector('[data-del="1"]').addEventListener('click', () => removeTruck(t.instanceId));

    host.appendChild(block);
    layoutCargo(block, t, mode);
  });
}

/**
 * 荷台とその上の商品を実寸→px変換して配置する。
 * canvas-wrap の実測幅から scale を決めるため、DOM挿入後に呼ぶ。
 */
function layoutCargo(block, truckInstance, mode) {
  const m = truckDims(truckInstance);
  const wrap = block.querySelector('.canvas-wrap');
  const cargo = block.querySelector('.cargo');

  // canvas-wrap の左パディング(48px=キャビン分)を除いた内容幅にフィットさせる（実寸比率は維持）
  const availPx = Math.max(200, wrap.clientWidth - 48);
  const worldW = m.cargoLength;                       // 横軸=長さ方向(常に)
  const worldH = (mode === 'side') ? m.cargoHeight : m.cargoWidth;
  const scale = availPx / worldW;

  cargo.style.width = availPx + 'px';
  cargo.style.height = (worldH * scale) + 'px';
  cargo.dataset.scale = scale;
  cargo.dataset.mode = mode;
  cargo.dataset.truck = truckInstance.instanceId;

  // 目盛・グリッドは廃止（CENTER-005）: 荷台はシンプル表示

  // 商品配置
  const placements = state.placements.filter(p => p.truckInstanceId === truckInstance.instanceId);
  if (mode === 'side') {
    renderSideView(cargo, placements, m, scale);          // CENTER-009: 専用の側面図描画
  } else {
    placements.forEach(p => cargo.appendChild(buildPlacementEl(p, m, scale)));
  }

  // 配置操作（クリック配置 / ドロップ / ドラッグ移動）
  attachCargoHandlers(cargo, truckInstance, m);
}

/** 1つの配置商品DOM（上面図）を作る */
function buildPlacementEl(p, truck, scale) {
  const info = productInfo(p.code);
  const fp = footprint(info, p.rotation);
  const el = document.createElement('div');
  const oob = isPlacementOOB(p, truck);   // ②自動配置改善：はみ出し配置を視覚的に明示
  el.className = 'placement' + (selectedPid === p.id ? ' is-selected' : '') + (oob ? ' out-of-bounds' : '');
  if (oob) el.title = '荷台からはみ出しています';
  el.dataset.pid = p.id;

  const wpx = fp.lenX * scale;
  const hpx = fp.lenY * scale;
  el.style.width = wpx + 'px';
  el.style.height = hpx + 'px';
  el.style.left = (p.x * scale) + 'px';
  el.style.top = (p.y * scale) + 'px';
  el.style.borderColor = info.color;
  el.style.background = hexToRgba(info.color, 0.10);
  el.style.color = info.color;

  const stackBadge = (p.stack || 1) > 1 ? `<span class="p-stack">${p.stack}段</span>` : '';
  el.innerHTML = `${stackBadge}
    <span class="p-remove" title="配置を取り消す">×</span>
    <span class="p-code">${p.code}</span>
    <span class="p-size">${fp.lenX}×${fp.lenY}</span>`;
  return el;
}

/**
 * 側面図の描画（CENTER-009）
 *  ・側面図は幅(Y)方向を表現できないため、同じ長さ位置(x)に幅違いで複数置かれた商品は
 *    そのまま描くと同一座標へ重なって見える（＝重複表示の不具合）。
 *    同一の長さ位置・品番・向きでグルーピングし、重複描画を防ぐ。
 *  ・グループ内の段数は「最大値」を使う（＝合算しない）。横に並ぶ別々の配置は
 *    物理的に積み上がっているわけではないため、合算すると実際より高く描画され
 *    荷台からはみ出してしまう。側面から見える高さは「その位置で一番高いもの」。
 *  ・二段積み（stack）は「上段へ表示・下段上段を明確に分離」するため、
 *    段数ぶんのブロックを実際の積載高さで下から上へ積み重ねて描く。
 */
function renderSideView(cargo, placements, truck, scale) {
  const groups = new Map();
  placements.forEach(p => {
    const fp = footprint(productInfo(p.code), p.rotation);
    const bucket = Math.round(p.x / 50) * 50;   // 自動配置のSTEP(50mm)に合わせて束ねる
    const key = `${p.code}_${p.rotation}_${bucket}`;
    if (!groups.has(key)) groups.set(key, { code: p.code, x: bucket, lenX: fp.lenX, ids: [], stackCount: 0 });
    const g = groups.get(key);
    g.ids.push(p.id);
    g.stackCount = Math.max(g.stackCount, p.stack || 1);   // 合算ではなく最大値（実際の積載高さ）
  });
  groups.forEach(g => cargo.appendChild(buildSidePlacementEl(g, truck, scale)));
}

/** 側面図：1グループ（同一長さ位置・品番）を段数ぶん積み重ねたDOMを作る */
function buildSidePlacementEl(g, truck, scale) {
  const info = productInfo(g.code);
  const el = document.createElement('div');
  const isSelected = selectedPid && g.ids.includes(selectedPid);
  el.className = 'placement placement-stack' + (isSelected ? ' is-selected' : '');
  el.dataset.pid = g.ids[0];

  const wpx = g.lenX * scale;
  const tierPx = info.height * scale;
  const totalPx = tierPx * g.stackCount;
  el.style.width = wpx + 'px';
  el.style.height = totalPx + 'px';
  el.style.left = (g.x * scale) + 'px';
  el.style.top = (truck.cargoHeight * scale - totalPx) + 'px';   // 底面に接地
  el.style.color = info.color;

  // 上段から順にDOMへ追加＝flex縦積みで視覚的にも上段が上に来る（下段・上段を明確に分離）
  let tiers = '';
  for (let i = g.stackCount - 1; i >= 0; i--) {
    tiers += `<div class="placement-tier" style="height:${tierPx}px;border-color:${info.color};background:${hexToRgba(info.color, 0.10)}">
      <span class="p-code">${g.code}</span>
      <span class="p-size">${g.stackCount > 1 ? (i + 1) + '段目' : g.lenX + '×' + info.height}</span>
    </div>`;
  }
  el.innerHTML = `<span class="p-remove" title="配置を取り消す">×</span>${tiers}`;
  return el;
}

/* ---------------------------------------------------------------------------
 * 配置操作
 * ------------------------------------------------------------------------- */
function attachCargoHandlers(cargo, truckInstance, m) {
  const getScale = () => parseFloat(cargo.dataset.scale);

  // ドロップ（商品一覧からのHTML5ドラッグ）
  cargo.addEventListener('dragover', (e) => { e.preventDefault(); cargo.classList.add('drop-hint'); });
  cargo.addEventListener('dragleave', () => cargo.classList.remove('drop-hint'));
  cargo.addEventListener('drop', (e) => {
    e.preventDefault();
    cargo.classList.remove('drop-hint');
    if (cargo.dataset.mode === 'side') { toast('配置は上面図で行ってください'); return; }
    const code = e.dataTransfer.getData('text/plain');
    if (!code) return;
    const rect = cargo.getBoundingClientRect();
    dropProductAt(code, truckInstance, m, (e.clientX - rect.left) / getScale(), (e.clientY - rect.top) / getScale());
  });

  // クリック配置（pickedCode を置く）
  cargo.addEventListener('click', (e) => {
    if (e.target.closest('.placement')) return;   // 既存商品クリックは無視
    if (!pickedCode) return;
    if (cargo.dataset.mode === 'side') { toast('配置は上面図で行ってください'); return; }
    const rect = cargo.getBoundingClientRect();
    dropProductAt(pickedCode, truckInstance, m, (e.clientX - rect.left) / getScale(), (e.clientY - rect.top) / getScale());
  });

  // 既存商品の選択 / ドラッグ移動 / 回転 / 削除
  cargo.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.placement');
    if (!el) { if (selectedPid) { selectedPid = null; renderCanvases(); } return; }
    if (e.target.classList.contains('p-remove')) {   // ❌ボタンで削除（CENTER-008）
      removePlacement(el.dataset.pid);
      return;
    }
    // クリックで選択（Deleteキー対象）。ハイライト更新
    if (selectedPid !== el.dataset.pid) {
      selectedPid = el.dataset.pid;
      document.querySelectorAll('.placement.is-selected').forEach(x => x.classList.remove('is-selected'));
      el.classList.add('is-selected');
    }
    startBoxDrag(e, el, cargo, truckInstance, m);
  });
  cargo.addEventListener('dblclick', (e) => {
    const el = e.target.closest('.placement');
    if (el) rotatePlacement(el.dataset.pid);
  });
}

/** 実寸(mm)座標に商品を新規配置 */
function dropProductAt(code, truckInstance, m, mmX, mmY) {
  const prod = state.products.find(p => p.code === code);
  if (!prod) return;
  if (remaining(prod) <= 0) { flashNoStock(code); toast(`${code} は残りがありません`); return; }

  const info = productInfo(code);

  // 二段積み: 同一品番の上へドロップしたら段を重ねる（C6のみ / maxStackまで）CENTER-003
  if (canStack(info)) {
    const onTop = state.placements.find(p =>
      p.truckInstanceId === truckInstance.instanceId && p.code === code && (p.stack || 1) < (info.maxStack || 1) &&
      rectsOverlap({ x: mmX, y: mmY, w: 1, h: 1 }, boxRect(p)));
    if (onTop) {
      onTop.stack = (onTop.stack || 1) + 1;
      pickedCode = null;
      renderProductList(); renderCanvases(); saveToLocal();
      return;
    }
  }

  const fp = footprint(info, 0);
  // クリック位置を中心に置く（荷台内へクランプ＝荷台外には出さない §6）
  let x = mmX - fp.lenX / 2;
  let y = mmY - fp.lenY / 2;
  ({ x, y } = clampToCargo(x, y, fp, m));

  // 当たり判定: 重なる位置には置けない（§6）
  if (collides(truckInstance.instanceId, { x, y, w: fp.lenX, h: fp.lenY })) {
    toast('他の商品と重なるため配置できません');
    return;
  }

  state.placements.push({ id: uid('p'), truckInstanceId: truckInstance.instanceId, code, x: Math.round(x), y: Math.round(y), rotation: 0, stack: 1 });
  pickedCode = null;
  renderProductList();
  renderCanvases();
  saveToLocal();
}

/** 荷台内に収める（上面図の幅方向のみクランプ。側面図は移動対象外） */
function clampToCargo(x, y, fp, m) {
  x = Math.max(0, Math.min(x, Math.max(0, m.cargoLength - fp.lenX)));
  y = Math.max(0, Math.min(y, Math.max(0, m.cargoWidth - fp.lenY)));
  return { x, y };
}

/* -------- 当たり判定（Ver1.1 §6）: 商品同士は重ねられない -------- */
/** 配置の占有矩形(mm)を返す */
function boxRect(p) {
  const fp = footprint(productInfo(p.code), p.rotation);
  return { x: p.x, y: p.y, w: fp.lenX, h: fp.lenY };
}
/** 2矩形が重なるか（辺の接触は許容） */
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
/** 同一荷台内で rect が既存商品と重なるか（excludePid は判定から除外） */
function collides(truckInstanceId, rect, excludePid) {
  return state.placements.some(p =>
    p.truckInstanceId === truckInstanceId && p.id !== excludePid && rectsOverlap(rect, boxRect(p)));
}
/** 荷台をはみ出さないか */
function insideCargo(rect, m) {
  return rect.x >= -0.5 && rect.y >= -0.5 &&
    rect.x + rect.w <= m.cargoLength + 0.5 && rect.y + rect.h <= m.cargoWidth + 0.5;
}

/**
 * 空き長方形ベースの配置（AUTO-001/002・MaxRects方式）
 *  グリッド走査＋接触スコアでは、局所的には良さそうでも全体では中途半端な穴を残すことがあった。
 *  荷台の「空きスペースの形」そのものを長方形の集合として正確に管理し、
 *  商品は必ずどこかの空き長方形の前方・左端（＝Tetrisの床に落とすイメージ）へ詰めることで、
 *  浮いた隙間を作らない。縦横の向きは固定せず、空きへ最も無駄なくフィットする方を選ぶ。
 */

/** rectA から rectB（占有領域）を差し引いた残りの長方形群を返す（ギロチン分割） */
function subtractRect(freeRect, occ) {
  if (!rectsOverlap(freeRect, occ)) return [freeRect];
  const out = [];
  if (occ.x > freeRect.x) out.push({ x: freeRect.x, y: freeRect.y, w: occ.x - freeRect.x, h: freeRect.h });
  if (occ.x + occ.w < freeRect.x + freeRect.w) out.push({ x: occ.x + occ.w, y: freeRect.y, w: (freeRect.x + freeRect.w) - (occ.x + occ.w), h: freeRect.h });
  if (occ.y > freeRect.y) out.push({ x: freeRect.x, y: freeRect.y, w: freeRect.w, h: occ.y - freeRect.y });
  if (occ.y + occ.h < freeRect.y + freeRect.h) out.push({ x: freeRect.x, y: occ.y + occ.h, w: freeRect.w, h: (freeRect.y + freeRect.h) - (occ.y + occ.h) });
  return out.filter(r => r.w > 0.5 && r.h > 0.5);
}

/** 他の長方形に完全に含まれる長方形を除去する（重複した空き領域の整理） */
function pruneContainedRects(rects) {
  return rects.filter((a, i) => !rects.some((b, j) => i !== j &&
    a.x >= b.x - 0.5 && a.y >= b.y - 0.5 &&
    a.x + a.w <= b.x + b.w + 0.5 && a.y + a.h <= b.y + b.h + 0.5 &&
    (a.w * a.h < b.w * b.h || (a.w * a.h === b.w * b.h && i > j))));
}

/**
 * そのトラックの現在の空き長方形群を、既存の配置を差し引いて算出する。
 * extraLen/extraWid を指定すると、荷台の実サイズより広い仮想領域で計算する
 * （②自動配置改善：本来のスペースでは入らない商品を、はみ出し許容で置くためのフォールバック用）。
 */
function computeFreeRects(t, m, extraLen = 0, extraWid = 0) {
  let free = [{ x: 0, y: 0, w: m.cargoLength + extraLen, h: m.cargoWidth + extraWid }];
  state.placements.filter(p => p.truckInstanceId === t.instanceId).forEach(p => {
    const occ = boxRect(p);
    let next = [];
    free.forEach(r => next.push(...subtractRect(r, occ)));
    free = pruneContainedRects(next);
  });
  return free;
}

/**
 * 空き長方形群の中から商品(0°/90°)を置く場所を選ぶ（AUTO-001/002/008）。
 * 優先順位は仕様の「配置優先順位」に対応：
 *   ① 前方(小x)を最優先 → ② 前面を埋める(小y)を次点 → ③ 同じ位置なら最もフィットする向き
 * 積載率の最大化より、前方から順に詰まっていく分かりやすさを優先する。
 */
function bestFreeRectFit(freeRects, fp0, fp90) {
  let best = null;
  freeRects.forEach(r => {
    let bestForRect = null;
    [[fp0, 0], [fp90, 90]].forEach(([fp, rot]) => {
      if (fp.lenX > r.w + 0.5 || fp.lenY > r.h + 0.5) return;
      const shortSide = Math.min(r.w - fp.lenX, r.h - fp.lenY);
      if (!bestForRect || shortSide < bestForRect.shortSide) bestForRect = { rot, fp, shortSide };
    });
    if (!bestForRect) return;
    if (!best || r.x < best.x - 0.5 ||
        (Math.abs(r.x - best.x) <= 0.5 && r.y < best.y - 0.5) ||
        (Math.abs(r.x - best.x) <= 0.5 && Math.abs(r.y - best.y) <= 0.5 && bestForRect.shortSide < best.shortSide)) {
      best = { x: r.x, y: r.y, rot: bestForRect.rot, fp: bestForRect.fp, shortSide: bestForRect.shortSide };
    }
  });
  return best;
}

/** 配置が荷台からはみ出しているか（②自動配置改善：はみ出し警告のため） */
function isPlacementOOB(p, m) {
  const r = boxRect(p);
  return r.x < -0.5 || r.y < -0.5 || r.x + r.w > m.cargoLength + 0.5 || r.y + r.h > m.cargoWidth + 0.5;
}

/* -------- 配置不可トースト -------- */
let toastTimer = null;
function toast(msg) {
  let t = document.getElementById('appToast');
  if (!t) { t = document.createElement('div'); t.id = 'appToast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1400);
}

function startBoxDrag(e, el, cargo, truckInstance, m) {
  const mode = cargo.dataset.mode;
  if (mode === 'side') return;                 // 側面図では移動不可（高さは接地固定）
  const scale = parseFloat(cargo.dataset.scale);
  const p = state.placements.find(x => x.id === el.dataset.pid);
  if (!p) return;

  const info = productInfo(p.code);
  const fp = footprint(info, p.rotation);
  const startX = e.clientX, startY = e.clientY;
  const origX = p.x, origY = p.y;
  let lastValid = { x: origX, y: origY };   // 最後に重ならなかった位置
  el.classList.add('dragging');
  el.setPointerCapture(e.pointerId);

  const move = (ev) => {
    let nx = origX + (ev.clientX - startX) / scale;
    let ny = origY + (ev.clientY - startY) / scale;
    ({ x: nx, y: ny } = clampToCargo(nx, ny, fp, m));   // 荷台外へは出さない
    // カーソルには追従しつつ、重なる位置は赤枠で「置けない」を明示
    el.style.left = (nx * scale) + 'px';
    el.style.top = (ny * scale) + 'px';
    if (collides(truckInstance.instanceId, { x: nx, y: ny, w: fp.lenX, h: fp.lenY }, p.id)) {
      el.classList.add('collide');
    } else {
      el.classList.remove('collide');
      lastValid = { x: nx, y: ny };
    }
  };
  const up = () => {
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.classList.remove('dragging');
    el.classList.remove('collide');
    // 重なる位置で離した場合は、直近の有効位置へスナップバック
    p.x = Math.round(lastValid.x);
    p.y = Math.round(lastValid.y);
    el.style.left = (p.x * scale) + 'px';
    el.style.top = (p.y * scale) + 'px';
    saveToLocal();
  };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
}

function removePlacement(pid) {
  state.placements = state.placements.filter(p => p.id !== pid);
  renderProductList();
  renderCanvases();
  saveToLocal();
}
function rotatePlacement(pid) {
  const p = state.placements.find(x => x.id === pid);
  if (!p) return;
  const m = truckDims(state.trucks.find(t => t.instanceId === p.truckInstanceId));
  const newRot = (p.rotation === 90) ? 0 : 90;
  const fp = footprint(productInfo(p.code), newRot);
  // 回転後に荷台からはみ出す分は押し戻す
  const pos = clampToCargo(p.x, p.y, fp, m);
  // 回転で他商品と重なるなら回転を取り消す（§6）
  if (collides(p.truckInstanceId, { x: pos.x, y: pos.y, w: fp.lenX, h: fp.lenY }, p.id)) {
    toast('回転すると他の商品と重なります');
    return;
  }
  p.rotation = newRot;
  p.x = pos.x; p.y = pos.y;
  renderCanvases();
  saveToLocal();
}

function flashNoStock(code) {
  const rows = document.querySelectorAll('.product-row');
  rows.forEach(r => {
    if (r.dataset.code === code) {
      const rem = r.querySelector('.pr-remain');
      rem.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 260 });
    }
  });
}

/* ---------------------------------------------------------------------------
 * 自動配置「トラックへ積む」（Ver1.2 §8）
 *
 *  シンプルな配置ロジック（AI最適化ではない）:
 *   ・読み込んだ全商品の残数を対象
 *   ・大きい商品から順に、各トラックの左上→右→下へ走査して最初の空きへ置く
 *   ・当たり判定（既存・新規とも重複禁止）／荷台外禁止／残数更新
 *  既存の手動配置は残したまま、空きスペースへ積み増す。
 * ------------------------------------------------------------------------- */
/**
 * 配置コア（CENTER-004 / AUTO-001 / AUTO-002）— フェーズ構成は仕様の algorithm セクションに対応
 *
 *  phase1: 高さ(H)降順にソート（同高はフットプリント大きい順）
 *          → 高い商品を先に処理することで、高さが近い商品同士が処理順的に隣接しやすくなる
 *  phase2〜4: トラックは前方から埋める（先頭トラックが埋まるまで次のトラックへ進まない）。
 *          各トラック内では、空き長方形（computeFreeRects）の中から商品が最もフィットする
 *          ものを選び、その空き領域の前方・左端（Tetrisの床に落とすイメージ）へ詰める。
 *          縦置き・横置きは決め打ちせず、隙間なく収まる向きを機械的に選ぶ。
 *  phase5: 二段積み可能品（C6等）は新規フットプリントを使わず、前方の既存プレースへ積み増す
 *          （＝隙間を作らず上段へ乗せる。§CENTER-003）
 *
 * ②自動配置改善: 荷台内に収まる場所が本当にどこにもない場合、配置を諦めるのではなく
 *   はみ出しを許容して先頭トラックへ置く（商品は必ず置かれる）。はみ出した配置は
 *   renderCanvases側でトラックごとに警告バナーを表示する（isPlacementOOB）。
 *
 * units: 積む品番の配列（呼び出し側が在庫内に収める）
 */
function placeUnits(units) {
  if (state.trucks.length === 0) { toast('先にトラックを選択してください'); return { placed: 0, failed: 0, noTruck: true }; }

  // phase1: 高さ降順 → 同高はフットプリント大きい順
  units.sort((a, b) => {
    const ia = productInfo(a), ib = productInfo(b);
    return (ib.height - ia.height) || (ib.width * ib.depth - ia.width * ia.depth);
  });

  let placed = 0, failed = 0, overflowed = 0;

  units.forEach(code => {
    const info = productInfo(code);

    // phase5: 二段積み可能品は前方の既存プレースへ積み増す（新しい床面積を使わない）
    if (canStack(info)) {
      const target = frontmostStackable(code, info.maxStack || 1);
      if (target) { target.stack = (target.stack || 1) + 1; placed++; return; }
    }

    // phase2〜4: トラックを前方（先頭）から順に試し、そのトラックの空き長方形の中から
    //            最もフィットする場所へ詰める（＝隙間を残さない配置を優先）
    const fp0 = footprint(info, 0);
    const fp90 = footprint(info, 90);
    let placedHere = false;

    for (const t of state.trucks) {
      const m = truckDims(t);
      const free = computeFreeRects(t, m);
      const best = bestFreeRectFit(free, fp0, fp90);

      if (best) {
        state.placements.push({ id: uid('p'), truckInstanceId: t.instanceId, code, x: Math.round(best.x), y: Math.round(best.y), rotation: best.rot, stack: 1 });
        placed++; placedHere = true;
        break;   // このトラックに置けたので次のトラックは試さない（前方＝先頭トラックから埋める）
      }
    }

    // ②フォールバック: どのトラックにも収まる場所が無ければ、先頭トラックへ
    // はみ出しを許容して置く（配置を諦めない。警告表示は描画側で行う）
    if (!placedHere && state.trucks.length > 0) {
      const t = state.trucks[0];
      const m = truckDims(t);
      const margin = Math.max(fp0.lenX, fp0.lenY, fp90.lenX, fp90.lenY) + 50;
      const free = computeFreeRects(t, m, margin, margin);
      const best = bestFreeRectFit(free, fp0, fp90);
      if (best) {
        state.placements.push({ id: uid('p'), truckInstanceId: t.instanceId, code, x: Math.round(best.x), y: Math.round(best.y), rotation: best.rot, stack: 1 });
        placed++; placedHere = true; overflowed++;
      }
    }
    if (!placedHere) failed++;
  });

  renderProductList();
  renderCanvases();
  saveToLocal();
  return { placed, failed, overflowed };
}

/** 同一品番で積み余地がある配置のうち最も前方(小x)のものを返す */
function frontmostStackable(code, maxStack) {
  let best = null;
  state.placements.forEach(p => {
    if (p.code === code && (p.stack || 1) < maxStack) {
      if (!best || p.x < best.x) best = p;
    }
  });
  return best;
}

/** placeUnits の結果を伝えるトースト文言（②はみ出し許容の注記を含む） */
function placeResultToast(prefix, r) {
  if (r.overflowed > 0) {
    toast(`${prefix}${r.placed}個を配置（うち${r.overflowed}個ははみ出しあり・要確認）`);
  } else if (r.failed > 0) {
    toast(`${prefix}${r.placed}個を配置。${r.failed}個は配置できませんでした`);
  } else {
    toast(`${prefix}${r.placed}個を配置しました`);
  }
}

/** 全体を自動配置（残数ぶん） */
function autoPlaceAll() {
  const units = [];
  state.products.forEach(p => { for (let i = 0; i < remaining(p); i++) units.push(p.code); });
  if (units.length === 0) { toast('配置する残数がありません'); return; }
  const r = placeUnits(units);
  if (r.noTruck) return;
  placeResultToast('', r);
}

/** 指定した伝票のみ自動配置（RIGHT-004）。在庫(残)の範囲で積む */
function autoPlaceSlip(slipId) {
  const s = state.slips.find(x => x.id === slipId);
  if (!s) return;
  const units = [];
  const used = {};
  (s.items || []).forEach(it => {
    const cap = remainingByCode(it.code) - (used[it.code] || 0);
    const n = Math.min(it.qty, Math.max(0, cap));
    for (let i = 0; i < n; i++) units.push(it.code);
    used[it.code] = (used[it.code] || 0) + n;
  });
  if (units.length === 0) { toast('この伝票に積める残数がありません'); return; }
  const r = placeUnits(units);
  if (r.noTruck) return;
  placeResultToast('伝票から', r);
}

/* ---------------------------------------------------------------------------
 * トラック 追加 / 削除
 * ------------------------------------------------------------------------- */
/**
 * トラック選択（Ver1.1 §4）
 *  ・STEP車両: ON/OFFトグル。既にあれば削除、なければ追加（重複表示なし）
 *  ・業者4t  : クリックのたびに 業者4t-1, -2, -3… と枝番付きで追加
 */
function addTruck(masterId) {
  const master = getTruckMaster(masterId);
  if (!master) return;
  if (master.placeholder) { toast('「その他」の業者トラックは将来追加予定です'); return; }

  if (master.external) {
    // 業者トラック: クリックのたびに枝番付きで追加（削除後も番号が重複しないように）
    const maxSeq = state.trucks.filter(t => t.masterId === masterId)
      .reduce((mx, t) => Math.max(mx, t.seq || 0), 0);
    state.trucks.push({ instanceId: uid('t'), masterId, seq: maxSeq + 1, viewMode: 'top' });
    renderAll();
    return;
  }
  // STEP車両: ON/OFFトグル（同じ車両は複数表示しない）
  const exist = state.trucks.find(t => t.masterId === masterId);
  if (exist) { removeTruck(exist.instanceId, true); return; }
  state.trucks.push({ instanceId: uid('t'), masterId, viewMode: 'top' });
  renderAll();
}

function removeTruck(instanceId, fromToggle) {
  const t = state.trucks.find(x => x.instanceId === instanceId);
  if (!t) return;
  const hasPlacements = state.placements.some(p => p.truckInstanceId === instanceId);
  // 配置がある荷台を消すときだけ確認（空なら即トグルOFFで軽快に）
  if (hasPlacements && !confirm(`「${truckLabel(t)}」を削除しますか？\n（この荷台の配置商品も削除され、残数は戻ります）`)) return;
  state.trucks = state.trucks.filter(x => x.instanceId !== instanceId);
  state.placements = state.placements.filter(p => p.truckInstanceId !== instanceId);
  renderAll();
}

/* ---------------------------------------------------------------------------
 * グローバル操作（ヘッダー・ステップ・トグル・モーダル）
 * ------------------------------------------------------------------------- */
function bindGlobalControls() {
  document.getElementById('projectName').addEventListener('input', (e) => { state.projectName = e.target.value; saveToLocal(); updateAutoSaveUI(); });

  // ヘッダーボタン（TOP-001/002）: 全消去=配置のみ初期化、PDF出力
  document.getElementById('btnClearAll').addEventListener('click', clearAllPlacements);
  document.getElementById('btnPdf').addEventListener('click', outputPdf);

  // Deleteキーで選択中の配置を削除（CENTER-008）
  document.addEventListener('keydown', onGlobalKeydown);

  // トラック一覧アコーディオン開閉（STEP車両 / 業者トラック）§LEFT-001/004
  document.getElementById('stepAccHead').addEventListener('click', () => { accOpen.step = !accOpen.step; renderTruckAccordions(); });
  document.getElementById('gaishaAccHead').addEventListener('click', () => { accOpen.gaisha = !accOpen.gaisha; renderTruckAccordions(); });

  // 中央「＋ トラック追加」→ トラックピッカー
  document.getElementById('btnAddTruckDashed').addEventListener('click', openTruckPicker);

  // 右「＋ 伝票を追加読込」→ ファイル選択（OCR追加読込）§RIGHT-001
  document.getElementById('btnAddOcr').addEventListener('click', () => document.getElementById('fileSlip').click());

  // 手入力（伝票選択・品番・数量）で商品を追加（OCRできない商品用）LEFT-005
  document.getElementById('btnManualAdd').addEventListener('click', addProductManual);
  document.getElementById('manCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') addProductManual(); });
  document.getElementById('manQty').addEventListener('keydown', (e) => { if (e.key === 'Enter') addProductManual(); });

  // 「トラックへ積む」自動配置
  document.getElementById('btnAutoPlace').addEventListener('click', autoPlaceAll);

  // 商品アップロード（OCRスタブ・複数画像対応）
  document.getElementById('uploadBox').addEventListener('click', () => document.getElementById('fileSlip').click());
  document.getElementById('fileSlip').addEventListener('change', handleSlipUpload);

  // 自動保存（案件名.json へ書き込み）
  document.getElementById('btnAutoSave').addEventListener('click', toggleAutoSave);
}

/* ---------------------------------------------------------------------------
 * 品番の柔軟正規化（LEFT-006）: 大小文字・全半角・空白・ハイフン有無を吸収
 *   c6→C6 / c８→C8 / c-6→C6 / Ｃ６→C6
 * ------------------------------------------------------------------------- */
function toHalfWidth(s) {
  return String(s).replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
}
function normalizeCode(raw) {
  return toHalfWidth(raw).replace(/\s+/g, '').toUpperCase();
}
/** 正規化してマスターの正式品番に解決。見つからなければ正規化文字列を返す */
function resolveProductCode(raw) {
  const n = normalizeCode(raw);
  if (!n) return '';
  let m = PRODUCT_MASTER.find(p => p.code.toUpperCase() === n);
  if (m) return m.code;
  const nh = n.replace(/-/g, '');                 // ハイフン有無を吸収
  m = PRODUCT_MASTER.find(p => p.code.toUpperCase().replace(/-/g, '') === nh);
  return m ? m.code : n;
}

/* 手入力で商品追加。選択した伝票（またはOCR外の「手入力」）へ品番・数量を追加 LEFT-005/006 */
function addProductManual() {
  const codeEl = document.getElementById('manCode');
  const qtyEl = document.getElementById('manQty');
  const slipSel = document.getElementById('manSlip');
  const code = resolveProductCode(codeEl.value);
  const qty = Math.max(1, parseInt(qtyEl.value, 10) || 1);
  if (!code) { toast('品番を入力してください'); codeEl.focus(); return; }

  const target = slipSel ? slipSel.value : 'manual';
  if (target !== 'manual') {
    // 選択した伝票の明細へ加算（同一品番はまとめる）
    const s = state.slips.find(x => x.id === target);
    if (s) {
      const it = s.items.find(i => i.code === code);
      if (it) it.qty += qty; else s.items.push({ code, qty });
    }
  } else {
    // 手入力グループへ。同一品番は既存行へ加算し、行が重複しないようにする
    const exist = state.manual.find(x => x.code === code);
    if (exist) {
      exist.qty += qty;
    } else {
      const master = getProductMaster(code);
      const def = master ? null : { name: code, width: 400, depth: 400, height: 400, color: pickColor(state.products.length) };
      if (!master) toast(`「${code}」はマスター未登録のため仮サイズ(400)で追加しました`);
      state.manual.push({ id: uid('m'), code, qty, def });
    }
  }

  rebuildProducts();
  codeEl.value = '';
  qtyEl.value = '1';
  codeEl.focus();
  renderUploads();
  renderProductList();
  saveToLocal();
}

/** 手入力の「追加先の伝票」セレクトを再構築 */
function renderManualSlipOptions() {
  const sel = document.getElementById('manSlip');
  if (!sel) return;
  const prev = sel.value;
  const opts = ['<option value="manual">手入力（伝票なし）</option>']
    .concat(state.slips.map((s, i) => `<option value="${s.id}">伝票${i + 1}（${s.name}）</option>`));
  sel.innerHTML = opts.join('');
  if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
}

/* 全消去（TOP-003）: トラック配置・OCR結果・伝票・手入力商品を全て削除し、画面を初期状態へ戻す */
function clearAllPlacements() {
  const isEmpty = state.trucks.length === 0 && state.slips.length === 0 &&
    state.manual.length === 0 && state.placements.length === 0;
  if (isEmpty) { toast('削除するデータがありません'); return; }

  confirmDanger(
    'すべて削除しますか？',
    'トラック配置・OCR結果・伝票・手入力商品を全て削除します。<br>この操作は元に戻せません。',
    '全て削除',
    () => {
      state.slips.forEach(s => { if (s.thumbUrl) { try { URL.revokeObjectURL(s.thumbUrl); } catch (_) {} } });
      state.trucks = [];
      state.slips = [];
      state.manual = [];
      state.products = [];
      state.placements = [];
      state.productModes = {};
      pickedCode = null;
      selectedPid = null;
      renderAll();
    }
  );
}

/* トラック毎に配置消去（CENTER-006）: そのトラックの配置だけ初期化 */
function clearTruckPlacements(instanceId) {
  const t = state.trucks.find(x => x.instanceId === instanceId);
  if (!t || !state.placements.some(p => p.truckInstanceId === instanceId)) return;
  if (!confirm(`「${truckLabel(t)}」の配置を消去しますか？（残数は戻ります）`)) return;
  state.placements = state.placements.filter(p => p.truckInstanceId !== instanceId);
  selectedPid = null;
  renderProductList();
  renderCanvases();
  saveToLocal();
}

/* Deleteキーで選択中の配置を削除（CENTER-008） */
function onGlobalKeydown(e) {
  if (e.key !== 'Delete' && e.key !== 'Backspace') return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;  // フォーム入力中は無視
  if (!selectedPid) return;
  e.preventDefault();
  removePlacement(selectedPid);
  selectedPid = null;
}

/* ---------------------------------------------------------------------------
 * OCRスタブ（SDS §11）
 *   本番: 写真/PDF → OCRエンジン → 品番・数量抽出 → 商品マスター照合
 *   MVP : アップロードUIとプレビューを提供し、読取結果を手入力/確認できる形にする。
 *         下の runOcrStub() を実OCR呼び出しに差し替えれば本番化できる。
 * ------------------------------------------------------------------------- */
function handleSlipUpload(e) {
  const files = Array.from(e.target.files || []);
  if (files.length === 0) return;

  // 追加した伝票をスリップとして蓄積（既存は消さない＝複数枚を積み増し）。§2/§3
  files.forEach(file => {
    const isImage = file.type.startsWith('image/');
    const slip = {
      id: uid('s'),
      name: file.name,
      isImage,
      thumbUrl: isImage ? URL.createObjectURL(file) : null,
      items: runOcrStub(state.slips.length),   // ★一括OCRのスタブ結果（伝票ごと）
    };
    state.slips.push(slip);
  });

  rebuildProducts();     // 全伝票＋手入力を品番で集計
  renderUploads();
  renderManualSlipOptions();
  renderProductList();
  saveToLocal();
  e.target.value = '';   // 同じファイルの再選択も検知できるようリセット
}

/**
 * ★OCRスタブ：実エンジン接続時はここで {code, qty} 配列を返すよう差し替える。
 * デモでは伝票ごとに別内容を返し、同一品番の自動集計を確認できるようにしている
 * （伝票1: C6×8,C8N×3 ／ 伝票2: C6×8,C9×4 → C6は16に集計）。全て実在コード。
 */
function runOcrStub(slipIndex) {
  const sets = [
    [{ code: 'C6', qty: 8 }, { code: 'C8N', qty: 3 }],
    [{ code: 'C6', qty: 8 }, { code: 'C9', qty: 4 }],
    [{ code: 'C2C', qty: 4 }, { code: 'C90C', qty: 2 }],
  ];
  return sets[slipIndex % sets.length].map(x => ({ ...x }));
}

/* ---------------------------------------------------------------------------
 * モーダル：トラック追加ピッカー
 * ------------------------------------------------------------------------- */
function openTruckPicker() {
  const label = { step: 'STEP車両', gaisha: '業者トラック' };
  const opts = TRUCK_MASTER
    .filter(m => !m.placeholder)
    .map(m => `<option value="${m.id}">［${label[m.group] || ''}］${m.name}（D${m.cargoLength} W${m.cargoWidth} H${m.cargoHeight}）</option>`).join('');
  openModal('トラックを追加', `
    <div class="field">
      <label>車両を選択</label>
      <select id="mdlTruck">${opts}</select>
    </div>`, () => {
    addTruck(document.getElementById('mdlTruck').value);
    return true;
  });
}

/* 汎用モーダル */
function openModal(title, bodyHtml, onOk, okLabel) {
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML = `
    <div class="modal">
      <h3>${title}</h3>
      ${bodyHtml}
      <div class="modal-actions">
        <button class="btn" data-cancel>キャンセル</button>
        <button class="btn btn-primary" data-ok>${okLabel || '追加'}</button>
      </div>
    </div>`;
  const close = () => mask.remove();
  mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
  mask.querySelector('[data-cancel]').addEventListener('click', close);
  mask.querySelector('[data-ok]').addEventListener('click', () => { if (onOk() !== false) close(); });
  document.body.appendChild(mask);
}

/** 破壊的操作用の確認ダイアログ（キャンセル / 危険な操作ボタン）。confirm()の代わりに使う */
function confirmDanger(title, message, dangerLabel, onConfirm) {
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML = `
    <div class="modal">
      <h3>${title}</h3>
      <p class="modal-message">${message}</p>
      <div class="modal-actions">
        <button class="btn" data-cancel>キャンセル</button>
        <button class="btn btn-danger" data-ok>${dangerLabel}</button>
      </div>
    </div>`;
  const close = () => mask.remove();
  mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
  mask.querySelector('[data-cancel]').addEventListener('click', close);
  mask.querySelector('[data-ok]').addEventListener('click', () => { onConfirm(); close(); });
  document.body.appendChild(mask);
}

/* ---------------------------------------------------------------------------
 * 保存 / 読込（JSONファイル + localStorage）
 * ------------------------------------------------------------------------- */
function serialize() {
  // thumbUrl(ObjectURL) は再読込で無効になるため保存しない。products は導出なので保存不要。
  return {
    version: 2,
    savedAt: new Date().toISOString(),
    projectName: state.projectName,
    trucks: state.trucks,
    slips: state.slips.map(s => ({ id: s.id, name: s.name, isImage: s.isImage, items: s.items })),
    manual: state.manual,
    placements: state.placements,
    productModes: state.productModes,   // ③展開/折りたたみの選択状態
  };
}
function saveToLocal() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize())); } catch (_) { /* file:// 等で不可でも無視 */ }
  scheduleAutoSave();   // 自動保存ONなら案件名.jsonへ書き出し（デバウンス）
}
function loadFromLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    hydrate(JSON.parse(raw));
    return true;
  } catch (_) { return false; }
}
function hydrate(obj) {
  state.projectName = obj.projectName || '新規案件';
  state.trucks = (obj.trucks || []).map(t => ({ instanceId: t.instanceId || uid('t'), masterId: t.masterId, seq: t.seq, viewMode: t.viewMode || 'top' }));
  state.slips = (obj.slips || []).map(s => ({
    id: s.id || uid('s'), name: s.name || '伝票', isImage: !!s.isImage, thumbUrl: null,
    items: (s.items || []).map(it => ({ code: it.code, qty: it.qty })),
  }));
  state.manual = (obj.manual || []).map(m => ({ id: m.id || uid('m'), code: m.code, qty: m.qty, def: m.def || null }));
  // 旧形式（products直保存・slips/manualなし）の移行: products を手入力ソースへ変換
  if (!obj.slips && !obj.manual && Array.isArray(obj.products)) {
    state.manual = obj.products.map(p => ({
      id: uid('m'), code: p.code, qty: p.qty,
      def: getProductMaster(p.code) ? null : { name: p.name, width: p.width, depth: p.depth, height: p.height, color: p.color || pickColor(0) },
    }));
  }
  state.placements = (obj.placements || []).map(p => ({
    id: p.id || uid('p'), truckInstanceId: p.truckInstanceId, code: p.code,
    x: p.x || 0, y: p.y || 0, rotation: p.rotation || 0, stack: p.stack || 1,
  }));
  state.productModes = obj.productModes || {};
  rebuildProducts();
}
function saveProjectFile() {
  saveToLocal();
  const blob = new Blob([JSON.stringify(serialize(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(state.projectName || 'project').replace(/[\\/:*?"<>|]/g, '_')}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
function openProjectFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try { hydrate(JSON.parse(reader.result)); pickedCode = null; renderAll(); }
    catch (_) { alert('ファイルを読み込めませんでした（JSON形式が不正です）'); }
  };
  reader.readAsText(file);
  e.target.value = '';
}

/* ---------------------------------------------------------------------------
 * 自動保存：File System Access API で「案件名.json」へ書き込む
 *
 *   ・一度だけ保存フォルダを選ぶ → 以降は操作のたびに <案件名>.json を自動上書き
 *   ・フォルダのハンドルは IndexedDB に保存し、再訪時は許可を再確認して再開
 *   ・要件: Chrome/Edge かつ localhost または https（file:// は不可）
 * ------------------------------------------------------------------------- */
let dirHandle = null;
let autoSaveOn = false;
let autoSaveTimer = null;
let lastSavedAt = '';

const IDB_NAME = 'stepstudio_fs';
const IDB_STORE = 'handles';
function idbOpen() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(IDB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbSet(key, val) {
  const db = await idbOpen();
  await new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(val, key);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
  db.close();
}
async function idbGet(key) {
  const db = await idbOpen();
  const val = await new Promise((res, rej) => {
    const rq = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
  });
  db.close();
  return val;
}

const fsSupported = () => typeof window.showDirectoryPicker === 'function';
function currentFileName() {
  return (state.projectName || 'project').replace(/[\\/:*?"<>|]/g, '_') + '.json';
}

async function initAutoSave() {
  updateAutoSaveUI();
  if (!fsSupported()) return;
  try {
    const h = await idbGet('dir');
    if (!h) return;
    dirHandle = h;
    // 再訪時、権限が保持されていれば自動で再開（クリック不要のこともある）
    const perm = await h.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') { autoSaveOn = true; await writeAutoSave(); }
    updateAutoSaveUI();
  } catch (_) { /* 未対応/権限失効は無視 */ }
}

async function toggleAutoSave() {
  if (!fsSupported()) {
    alert('このブラウザは自動保存（ファイルシステムAPI）に未対応です。\nChrome / Edge で、http://localhost または https で開いてください。');
    return;
  }
  if (autoSaveOn) { autoSaveOn = false; updateAutoSaveUI(); return; }
  try {
    if (!dirHandle) dirHandle = await window.showDirectoryPicker({ id: 'stepstudio', mode: 'readwrite' });
    let perm = await dirHandle.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') perm = await dirHandle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') { alert('保存フォルダへの書き込みが許可されませんでした。'); return; }
    await idbSet('dir', dirHandle);
    autoSaveOn = true;
    await writeAutoSave();       // 即時に1回書き出す
    updateAutoSaveUI();
  } catch (e) {
    if (e.name !== 'AbortError') alert('フォルダの選択に失敗しました: ' + e.message);
  }
}

async function writeAutoSave() {
  if (!autoSaveOn || !dirHandle) return;
  try {
    const perm = await dirHandle.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') { autoSaveOn = false; updateAutoSaveUI(); return; }
    const fh = await dirHandle.getFileHandle(currentFileName(), { create: true });
    const w = await fh.createWritable();
    await w.write(JSON.stringify(serialize(), null, 2));
    await w.close();
    lastSavedAt = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    updateAutoSaveUI();
  } catch (e) {
    console.warn('自動保存に失敗:', e);
  }
}

/** 連続操作（ドラッグ等）でのディスク書き込みを間引く */
function scheduleAutoSave() {
  if (!autoSaveOn) return;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(writeAutoSave, 600);
}

function updateAutoSaveUI() {
  const btn = document.getElementById('btnAutoSave');
  const st = document.getElementById('autoSaveStatus');
  if (!btn || !st) return;
  if (autoSaveOn) {
    btn.textContent = '自動保存 ON';
    btn.classList.add('btn-primary');
    const folder = dirHandle ? dirHandle.name + '/' : '';
    st.textContent = folder + currentFileName() + (lastSavedAt ? `（${lastSavedAt} 保存）` : '');
  } else {
    btn.textContent = '自動保存 OFF';
    btn.classList.remove('btn-primary');
    st.textContent = dirHandle ? 'クリックで再開' : (fsSupported() ? '' : '未対応ブラウザ');
  }
}

/* ---------------------------------------------------------------------------
 * PDF出力（A4横・印刷レイアウト）（SDS §12）
 * ------------------------------------------------------------------------- */
function outputPdf() {
  const area = document.getElementById('printArea');
  const today = new Date().toLocaleDateString('ja-JP');

  let trucksHtml = '';
  state.trucks.forEach((t, idx) => {
    const m = truckDims(t);
    trucksHtml += renderPrintTruck(t, m, idx + 1);
  });

  const productsHtml = state.products.map(p => {
    const rem = remaining(p);
    return `<tr>
      <td style="font-weight:700">${p.code}</td>
      <td>${p.name}</td>
      <td style="text-align:center">${p.width}×${p.depth}×${p.height}</td>
      <td style="text-align:center">${p.qty}</td>
      <td style="text-align:center;font-weight:700;${rem <= 0 ? 'color:#c0392b' : ''}">${rem}</td>
    </tr>`;
  }).join('');

  area.innerHTML = `
    <div style="font-family:sans-serif;color:#1f2430">
      <div style="display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid #1e6fe0;padding-bottom:6px;margin-bottom:12px">
        <div><b style="font-size:18px">配送積載レイアウト</b> ／ 案件名：${state.projectName || '(未設定)'}</div>
        <div style="font-size:12px;color:#666">出力日：${today}　STEP Studio</div>
      </div>
      ${trucksHtml || '<div>トラックが登録されていません</div>'}
      <div style="margin-top:14px">
        <b>商品一覧・残数</b>
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:6px">
          <thead><tr style="background:#eef4fd">
            <th style="border:1px solid #ccc;padding:4px">品番</th>
            <th style="border:1px solid #ccc;padding:4px">商品名</th>
            <th style="border:1px solid #ccc;padding:4px">寸法(mm)</th>
            <th style="border:1px solid #ccc;padding:4px">数量</th>
            <th style="border:1px solid #ccc;padding:4px">残</th>
          </tr></thead>
          <tbody>${productsHtml}</tbody>
        </table>
      </div>
      <div style="margin-top:14px;font-size:11px;color:#888">※ 現場での指示は本紙に手書きで追記してください。</div>
    </div>`;

  // テーブルセルに枠線を付与
  area.querySelectorAll('tbody td').forEach(td => { td.style.border = '1px solid #ccc'; td.style.padding = '4px'; });

  window.print();
}

/** 印刷用の1トラック（上面図を固定scaleで描画） */
function renderPrintTruck(truckInstance, m, no) {
  const PRINT_W = 640;                          // px（印刷でも実寸比率を保つ）
  const scale = PRINT_W / m.cargoLength;
  const h = m.cargoWidth * scale;

  let boxes = '';
  state.placements.filter(p => p.truckInstanceId === truckInstance.instanceId).forEach(p => {
    const info = productInfo(p.code);
    const fp = footprint(info, p.rotation);
    boxes += `<div style="position:absolute;left:${p.x * scale}px;top:${p.y * scale}px;
      width:${fp.lenX * scale}px;height:${fp.lenY * scale}px;
      border:1.5px solid ${info.color};background:${hexToRgba(info.color, .12)};color:${info.color};
      font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;box-sizing:border-box;border-radius:3px">
      ${p.code}</div>`;
  });

  return `<div style="margin-bottom:14px;break-inside:avoid">
    <div style="font-size:13px;margin-bottom:4px">
      <b>トラック${no}：${truckLabel(truckInstance)}</b>
      <span style="color:#666"> 荷台内寸 D${m.cargoLength} W${m.cargoWidth} H${m.cargoHeight}mm</span>
    </div>
    <div style="position:relative;width:${PRINT_W}px;height:${h}px;border:2px solid #cfd6e0;border-radius:3px">${boxes}</div>
  </div>`;
}

/* ---------------------------------------------------------------------------
 * ユーティリティ
 * ------------------------------------------------------------------------- */
function hexToRgba(hex, a) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
const PALETTE = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#dc2626', '#0891b2', '#ca8a04', '#4f46e5'];
function pickColor(i) { return PALETTE[i % PALETTE.length]; }
function escapeHtml(s) { return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
