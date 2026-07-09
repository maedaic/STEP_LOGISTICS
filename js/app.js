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
  materialIncluded: {},  // 部材（型式A等）を積載対象に含めるか { code: true }。既定は対象外
};

let pickedCode = null;   // クリック配置用に選択中の品番
let selectedPid = null;  // キャンバス上で選択中の配置（Deleteキー対象）
let accOpen = { step: false, gaisha: false, pm: false }; // トラック一覧・商品マスターアコーディオンの開閉
let pmFilterUnknownOnly = true;   // 商品マスター一覧：未入力（積み重ね不明）のみ表示するか
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
/**
 * 個別の配置(placement)の描画情報を取得。折りたたみ対応商品はplacement自身が持つ
 * foldMode（無ければ商品一覧の既定値）を見て、その配置ごとに独立した実寸を返す。
 * これにより同じ商品でも「これは折りたたみ、これは展開」を個別に選べる。
 */
function placementInfo(p) {
  const master = getProductMaster(p.code);
  if (master && master.folded) {
    const mode = p.foldMode || state.productModes[p.code] || 'folded';
    const dims = mode === 'unfolded'
      ? { width: master.width, depth: master.depth, height: master.height }
      : { width: master.folded.width, depth: master.folded.depth, height: master.folded.height };
    return { ...master, ...dims };
  }
  return productInfo(p.code);
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
  renderProductMasterAccordion();
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

/* ---------- 左：商品マスター一覧（詳細不明部分を後から記入） ---------- */
function renderProductMasterAccordion() {
  const head = document.getElementById('pmAccHead');
  const body = document.getElementById('pmAccBody');
  if (!head || !body) return;
  const open = accOpen.pm;
  head.setAttribute('aria-expanded', open ? 'true' : 'false');
  head.querySelector('.acc-caret').textContent = open ? '▼' : '▶';
  body.hidden = !open;
  const unknown = PRODUCT_MASTER.filter(m => {
    const eff = getProductMaster(m.code);
    return eff.stackable == null;
  }).length;
  document.getElementById('pmAccCount').textContent = unknown > 0 ? `未入力 ${unknown}件` : '入力済み';
  if (open) renderProductMasterList();
}

/** 商品マスター1件ぶんの編集行（既存マスター品・新規登録品の両方で共用）を組み立てる（指示書①） */
function buildProductMasterRow(base, isCustom) {
  const m = getProductMaster(base.code);
  const row = document.createElement('div');
  row.className = 'pm-row';

  const info = document.createElement('span');
  info.className = 'pm-info';
  info.innerHTML = `<span class="pm-code">${m.code}</span>`;
  row.appendChild(info);

  const nameField = document.createElement('label');
  nameField.className = 'pm-field pm-field-name';
  nameField.innerHTML = `<span>商品名</span>`;
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = m.name || '';
  nameInput.addEventListener('change', () => {
    setProductOverride(m.code, 'name', nameInput.value.trim() || null);
    renderProductMasterAccordion();
  });
  nameField.appendChild(nameInput);
  row.appendChild(nameField);

  [['width', '幅W'], ['depth', '奥行D'], ['height', '高さH']].forEach(([field, label]) => {
    const f = document.createElement('label');
    f.className = 'pm-field pm-field-dim';
    f.innerHTML = `<span>${label}</span>`;
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.placeholder = '不明';
    input.value = m[field] != null ? m[field] : '';
    input.addEventListener('change', () => {
      const v = input.value.trim();
      setProductOverride(m.code, field, v === '' ? null : Math.max(0, parseFloat(v)));
      renderProductMasterAccordion();
    });
    f.appendChild(input);
    row.appendChild(f);
  });

  {
    const stackField = document.createElement('label');
    stackField.className = 'pm-field';
    stackField.innerHTML = `<span>積み重ね</span>`;
    const stackSelect = document.createElement('select');
    stackSelect.innerHTML = `
      <option value="">不明</option>
      <option value="true">可</option>
      <option value="false">不可</option>`;
    stackSelect.value = m.stackable === true ? 'true' : m.stackable === false ? 'false' : '';
    stackSelect.addEventListener('change', () => {
      const v = stackSelect.value;
      setProductOverride(m.code, 'stackable', v === '' ? null : v === 'true');
      renderProductMasterAccordion();
    });
    stackField.appendChild(stackSelect);
    row.appendChild(stackField);

    const maxStackField = document.createElement('label');
    maxStackField.className = 'pm-field';
    maxStackField.innerHTML = `<span>最大段数</span>`;
    const maxStackInput = document.createElement('input');
    maxStackInput.type = 'number';
    maxStackInput.min = '1';
    maxStackInput.placeholder = '不明';
    maxStackInput.value = m.maxStack != null ? m.maxStack : '';
    maxStackInput.disabled = m.stackable !== true;
    maxStackInput.addEventListener('change', () => {
      const v = maxStackInput.value.trim();
      setProductOverride(m.code, 'maxStack', v === '' ? null : Math.max(1, parseInt(v, 10) || 1));
      renderProductMasterAccordion();
    });
    maxStackField.appendChild(maxStackInput);
    row.appendChild(maxStackField);
  }

  // 手入力へ1個追加して、商品一覧・実際の積載で見た目とサイズを確認できるようにする
  const testBtn = document.createElement('button');
  testBtn.className = 'pm-test-btn';
  testBtn.textContent = '手入力へ追加';
  testBtn.title = 'この商品を手入力へ1個追加し、商品一覧・積載で確認する';
  testBtn.addEventListener('click', () => {
    addItemToTarget('manual', m.code, 1);
    toast(`「${m.code}」を手入力へ追加しました`);
  });
  row.appendChild(testBtn);

  if (isCustom) {
    const delBtn = document.createElement('button');
    delBtn.className = 'pm-del-btn';
    delBtn.textContent = '削除';
    delBtn.title = 'この新規登録商品をマスターから削除する';
    delBtn.addEventListener('click', () => {
      removeCustomProduct(m.code);
      renderProductMasterAccordion();
    });
    row.appendChild(delBtn);
  }

  return row;
}

function renderProductMasterList() {
  const host = document.getElementById('productMasterList');
  if (!host) return;
  host.innerHTML = '';

  // 未入力（積み重ね不明）のみ表示 / 全件表示の切替
  const filterRow = document.createElement('label');
  filterRow.className = 'pm-filter-row';
  filterRow.innerHTML = `<input type="checkbox" ${pmFilterUnknownOnly ? 'checked' : ''}> 未入力のみ表示（入力済みは一旦非表示）`;
  filterRow.querySelector('input').addEventListener('change', (e) => {
    pmFilterUnknownOnly = e.target.checked;
    renderProductMasterList();
  });
  host.appendChild(filterRow);

  let lastCategory = null;
  let shown = 0;
  PRODUCT_MASTER.forEach((base) => {
    const m = getProductMaster(base.code);
    if (pmFilterUnknownOnly && m.stackable != null) return;   // 入力済みは一旦非表示
    if (m.category !== lastCategory) {
      lastCategory = m.category;
      const cat = document.createElement('div');
      cat.className = 'pm-cat';
      cat.textContent = m.category || '未分類';
      host.appendChild(cat);
    }
    host.appendChild(buildProductMasterRow(base, false));
    shown++;
  });
  if (pmFilterUnknownOnly && shown === 0) {
    const done = document.createElement('div');
    done.className = 'pm-all-done';
    done.textContent = '未入力の商品はありません（すべて入力済みです）';
    host.appendChild(done);
  }

  // 新規登録した商品（マスター未収録の型式・指示書②）
  const customCodes = customProductCodes();
  if (customCodes.length > 0) {
    const cat = document.createElement('div');
    cat.className = 'pm-cat';
    cat.textContent = '新規登録した商品';
    host.appendChild(cat);
    customCodes.forEach(code => host.appendChild(buildProductMasterRow({ code }, true)));
  }

  // 新しい商品を登録するフォーム（指示書②：マスター未登録・サイズ未登録の商品をここから登録）
  const addForm = document.createElement('div');
  addForm.className = 'pm-add-form';
  addForm.innerHTML = `
    <div class="pm-add-title">＋ 新しい商品を登録</div>
    <div class="pm-add-row">
      <input class="pm-add-code" type="text" placeholder="型式（例: C99）">
      <input class="pm-add-name" type="text" placeholder="商品名">
    </div>
    <div class="pm-add-row">
      <input class="pm-add-w" type="number" min="0" placeholder="幅W">
      <input class="pm-add-d" type="number" min="0" placeholder="奥行D">
      <input class="pm-add-h" type="number" min="0" placeholder="高さH">
    </div>
    <div class="pm-add-row">
      <select class="pm-add-stack">
        <option value="">積み重ね：不明</option>
        <option value="true">積み重ね：可</option>
        <option value="false">積み重ね：不可</option>
      </select>
      <input class="pm-add-maxstack" type="number" min="1" placeholder="最大段数">
    </div>
    <button class="btn btn-primary pm-add-btn">登録する</button>`;
  addForm.querySelector('.pm-add-btn').addEventListener('click', () => {
    const code = addForm.querySelector('.pm-add-code').value;
    const name = addForm.querySelector('.pm-add-name').value.trim();
    const width = parseFloat(addForm.querySelector('.pm-add-w').value);
    const depth = parseFloat(addForm.querySelector('.pm-add-d').value);
    const height = parseFloat(addForm.querySelector('.pm-add-h').value);
    const stackVal = addForm.querySelector('.pm-add-stack').value;
    const maxStackVal = addForm.querySelector('.pm-add-maxstack').value;
    const result = registerCustomProduct(code, {
      name, width, depth, height,
      stackable: stackVal === '' ? null : stackVal === 'true',
      maxStack: maxStackVal ? Math.max(1, parseInt(maxStackVal, 10)) : 1,
    });
    if (!result.ok) { toast(result.error); return; }
    toast(`「${result.code}」を商品マスターへ登録しました`);
    rebuildProducts();
    renderProductMasterAccordion();
    renderProductList();
    renderCanvases();
  });
  host.appendChild(addForm);

  // 保存ボタン（編集内容は入力のたびに自動保存済み。押すと「確定」として一覧を閉じる）
  const saveRow = document.createElement('div');
  saveRow.className = 'pm-save-row';
  saveRow.innerHTML = `
    <button class="btn" id="pmExportBtn">上書き内容をエクスポート</button>
    <button class="btn btn-primary" id="pmSaveBtn">保存</button>`;
  saveRow.querySelector('#pmExportBtn').addEventListener('click', openProductOverridesExportModal);
  saveRow.querySelector('#pmSaveBtn').addEventListener('click', () => {
    accOpen.pm = false;
    renderProductMasterAccordion();
    toast('商品マスターを保存しました');
  });
  host.appendChild(saveRow);
}

/** 現在のPRODUCT_OVERRIDES（この端末での編集差分）をJSONで表示し、コピーできるようにする */
function openProductOverridesExportModal() {
  const json = JSON.stringify(PRODUCT_OVERRIDES, null, 2);
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML = `
    <div class="modal relayout-modal">
      <h3>上書き内容のエクスポート</h3>
      <p class="modal-message">この端末で商品マスターに加えた編集差分（PRODUCT_OVERRIDES）です。コピーして共有してください。</p>
      <textarea class="pm-export-textarea" readonly>${json}</textarea>
      <div class="modal-actions">
        <button class="btn" data-cancel>閉じる</button>
        <button class="btn btn-primary" data-copy>コピー</button>
      </div>
    </div>`;
  const close = () => mask.remove();
  mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
  mask.querySelector('[data-cancel]').addEventListener('click', close);
  mask.querySelector('[data-copy]').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(json);
      toast('クリップボードにコピーしました');
    } catch (_) {
      mask.querySelector('.pm-export-textarea').select();
      toast('選択済みです。Cmd+C（Ctrl+C）でコピーしてください');
    }
  });
  document.body.appendChild(mask);
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

/**
 * 伝票上の「型式」がこれらの値のときは実在の商品コードではなく部材（ガラス等）を指す。
 * 型式は画面に表示せず商品名のみ表示し、デフォルトではトラック積載対象外にする（Logistics改善指示書 §1）。
 * 商品マスター照合は行わない（OCRが読み取った商品名をそのまま使う）。
 */
const MATERIAL_TYPE_CODES = ['A'];
function isMaterialType(code) {
  return MATERIAL_TYPE_CODES.includes(String(code).trim().toUpperCase());
}
/** 部材（型式A等）専用の指定色。実商品の巡回パレットとは別に、常にこの色で統一表示する */
const MATERIAL_COLOR = '#94a3b8';

function rebuildProducts() {
  mergeManualDuplicates();   // 過去に分かれて保存された同一品番の手入力行を統合（自己修復）

  const agg = new Map();   // code -> { qty, def }
  const add = (code, qty, def) => {
    const cur = agg.get(code) || { qty: 0, def: null };
    cur.qty += qty;
    if (!cur.def && def) cur.def = def;
    agg.set(code, cur);
  };
  state.slips.forEach(s => (s.items || []).forEach(it => add(it.code, it.qty, it.def)));
  state.manual.forEach(m => add(m.code, m.qty, m.def));

  let ci = 0;
  const products = [];
  agg.forEach((v, code) => {
    const isMaterial = isMaterialType(code);
    if (isMaterial) {
      // 部材（型式A等）: 商品マスター照合はせず、OCR/手入力の名称をそのまま使う
      const name = (v.def && v.def.name) || code;
      products.push({
        code, name, isMaterial: true,
        width: (v.def && v.def.width) || 400, depth: (v.def && v.def.depth) || 400, height: (v.def && v.def.height) || 400,
        qty: v.qty, color: (v.def && v.def.color) || MATERIAL_COLOR, stackable: null, maxStack: 1,
      });
      ci++;
      return;
    }
    const master = getProductMaster(code);
    if (master) {
      const dims = effectiveMasterDims(master);
      products.push({ code, name: master.name, width: dims.width, depth: dims.depth, height: dims.height, qty: v.qty, color: master.color, stackable: master.stackable, maxStack: master.maxStack, foldable: !!master.folded });
    } else if (v.def) {
      const hasDims = v.def.width && v.def.depth && v.def.height;
      products.push({
        code, name: v.def.name,
        width: v.def.width || 400, depth: v.def.depth || 400, height: v.def.height || 400,
        qty: v.qty, color: v.def.color || pickColor(ci), stackable: null, maxStack: 1,
        sizeUnknown: !hasDims || !!v.def.sizeUnknown,
      });
    } else {
      // マスター未登録・サイズ未登録（指示書②③）。400は暫定の仮サイズで、実寸ではないことを明示する
      products.push({ code, name: code, width: 400, depth: 400, height: 400, qty: v.qty, color: pickColor(ci), stackable: null, maxStack: 1, sizeUnknown: true });
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
    const itemsText = (s.items || [])
      .map(it => `${isMaterialType(it.code) ? ((it.def && it.def.name) || '部材') : it.code}×${it.qty}`)
      .join('・') || '読取なし';
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
function buildProductRow(code, qtyInSource, matchInfo) {
  const info = productInfo(code);
  const rem = remainingByCode(code);
  const row = document.createElement('div');
  const included = !!state.materialIncluded[code];
  const loadable = !info.isMaterial || included;
  row.className = 'product-row' + (pickedCode === code ? ' is-picked' : '') + (info.isMaterial ? ' is-material' : '');
  row.setAttribute('draggable', loadable ? 'true' : 'false');
  row.dataset.code = code;

  // ③展開⇄折りたたみトグル（対応商品のみ・初期値は折りたたみ）
  const isFoldable = !!(info.foldable || info.folded);
  const foldMode = state.productModes[code] || 'folded';
  const foldToggle = isFoldable ? `
    <div class="pr-fold">
      <button class="fold-btn ${foldMode === 'folded' ? 'is-on' : ''}" data-fold="folded">折りたたみ</button>
      <button class="fold-btn ${foldMode === 'unfolded' ? 'is-on' : ''}" data-fold="unfolded">展開</button>
    </div>` : '';

  // OCR商品マスター照合バッジ（品番が読めず商品名だけで補正された行のみ表示）§5
  const ocrBadge = (matchInfo && matchInfo.method === 'name')
    ? `<div class="pr-ocr-match" title="OCR「${matchInfo.rawName || ''}」を商品マスターの近似一致で「${info.name}」へ補正">
        商品マスター照合：一致率${Math.round((matchInfo.confidence || 0) * 100)}%</div>`
    : (matchInfo && matchInfo.method === 'none')
      ? `<div class="pr-ocr-nomatch" title="商品マスターに一致候補が見つかりませんでした。品番をご確認ください">
          ⚠ 商品マスター未一致（要確認）</div>`
      : '';

  if (info.isMaterial) {
    // 部材（型式A等）: 型式は表示せず商品名のみ。既定ではトラック積載対象外（Logistics改善指示書 §1）
    row.innerHTML = `
      <div class="pr-top">
        <span class="pr-name">${info.name}</span>
        <span class="pr-qty">×${qtyInSource}</span>
      </div>
      <label class="pr-material-toggle" data-stop>
        <input type="checkbox" ${included ? 'checked' : ''}> トラックへ積む
      </label>
      <div class="pr-remain ${rem <= 0 ? 'is-zero' : ''}">残${rem}</div>`;
    row.querySelector('.pr-material-toggle input').addEventListener('click', (e) => {
      e.stopPropagation();
      state.materialIncluded[code] = e.target.checked;
      renderProductList();
      renderCanvases();
      saveToLocal();
    });
  } else {
    row.innerHTML = `
      <div class="pr-top">
        <span class="pr-code">${code}</span>
        <span class="pr-qty">×${qtyInSource}</span>
      </div>
      <div class="pr-name">${info.name}　${info.sizeUnknown ? '<span class="pr-size-unknown">サイズ未設定</span>' : `${info.width}×${info.depth}×${info.height}`}</div>
      ${ocrBadge}
      ${foldToggle}
      <div class="pr-remain ${rem <= 0 ? 'is-zero' : ''}">残${rem}</div>`;
  }
  row.addEventListener('click', () => {
    if (!loadable) { toast('部材はデフォルトで積載対象外です。「トラックへ積む」をONにしてください'); return; }
    pickedCode = (pickedCode === code) ? null : code;
    renderProductList();
  });
  row.addEventListener('dragstart', (e) => {
    if (!loadable) { e.preventDefault(); toast('部材はデフォルトで積載対象外です。「トラックへ積む」をONにしてください'); return; }
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
  // host.innerHTML の総入れ替えでフォーカス中の要素が消えると、ブラウザが
  // ページ最上部へ自動スクロールしてしまうことがある（Safari等）。
  // スクロール位置を保存し、再描画後に復元してこの「引き戻り」を防ぐ。
  const scrollX = window.scrollX, scrollY = window.scrollY;
  const rightPanel = document.querySelector('.panel-right');
  const rightScrollTop = rightPanel ? rightPanel.scrollTop : 0;
  if (document.activeElement && host.contains(document.activeElement)) document.activeElement.blur();

  try {
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
    // 配置先トラックが削除済み/未設定なら先頭トラックへ自動修復（§4）
    if (!state.trucks.find(t => t.instanceId === s.targetTruckId)) {
      s.targetTruckId = (state.trucks[0] && state.trucks[0].instanceId) || null;
    }
    const group = document.createElement('div');
    group.className = 'ocr-group';
    const head = document.createElement('div');
    head.className = 'ocr-group-head';
    head.innerHTML = `<span class="ocr-group-title">伝票${idx + 1}</span>
      <span class="ocr-group-name">${s.name}</span>
      <button class="ocr-group-del" title="この伝票を削除">削除</button>`;
    head.querySelector('.ocr-group-del').addEventListener('click', () => removeSlip(s.id));
    group.appendChild(head);

    // 配置先トラック選択＋トラック配置ボタン（見出しとは別行に分けて折り返しを防ぐ）§4
    const truckOpts = state.trucks.map(t => `<option value="${t.instanceId}" ${t.instanceId === s.targetTruckId ? 'selected' : ''}>${truckLabel(t)}</option>`).join('');
    const placeRow = document.createElement('div');
    placeRow.className = 'ocr-group-placerow';
    placeRow.innerHTML = `
      ${state.trucks.length > 1 ? `<select class="ocr-group-truck" title="この伝票の配置先トラック">${truckOpts}</select>` : ''}
      <button class="ocr-group-place" title="この伝票の商品だけを配置先トラックへ積む" ${state.trucks.length === 0 ? 'disabled' : ''}>トラック配置</button>`;
    const truckSelectEl = placeRow.querySelector('.ocr-group-truck');
    if (truckSelectEl) truckSelectEl.addEventListener('change', (e) => { s.targetTruckId = e.target.value; saveToLocal(); });
    placeRow.querySelector('.ocr-group-place').addEventListener('click', () => autoPlaceSlip(s.id));
    group.appendChild(placeRow);
    if ((s.items || []).length === 0) {
      const none = document.createElement('div');
      none.className = 'ocr-empty';
      none.textContent = '読取結果なし';
      group.appendChild(none);
    }
    (s.items || []).forEach(it => group.appendChild(buildProductRow(it.code, it.qty, it)));

    // この伝票へ直接、品番を手入力で追加できる小フォーム（各伝票の下部分）
    const addRow = document.createElement('div');
    addRow.className = 'ocr-group-addrow';
    addRow.innerHTML = `
      <input class="ocr-add-code" type="text" placeholder="品番を追加">
      <input class="ocr-add-qty" type="number" value="1" min="1">
      <button class="ocr-add-btn">追加</button>`;
    const codeEl = addRow.querySelector('.ocr-add-code');
    const qtyEl = addRow.querySelector('.ocr-add-qty');
    const doAdd = () => {
      addItemToSlip(s.id, codeEl.value, Math.max(1, parseInt(qtyEl.value, 10) || 1));
      codeEl.value = ''; qtyEl.value = '1';
      codeEl.focus();
    };
    addRow.querySelector('.ocr-add-btn').addEventListener('click', doAdd);
    codeEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); });
    group.appendChild(addRow);

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
  } finally {
    window.scrollTo(scrollX, scrollY);
    if (rightPanel) rightPanel.scrollTop = rightScrollTop;
  }
}

/* ---------------------------------------------------------------------------
 * 描画：荷台キャンバス
 * ------------------------------------------------------------------------- */
function renderCanvases() {
  const host = document.getElementById('truckCanvases');
  // host.innerHTML の総入れ替えでフォーカス中の要素（回転/折/削除ボタンなど）が消えると、
  // ブラウザがページ最上部へ自動スクロールしてしまうことがある（Safari等）。
  // スクロール位置を保存し、再描画後に復元してこの「引き戻り」を防ぐ。
  const scrollX = window.scrollX, scrollY = window.scrollY;
  const rightPanel = document.querySelector('.panel-right');
  const rightScrollTop = rightPanel ? rightPanel.scrollTop : 0;
  if (document.activeElement && host.contains(document.activeElement)) document.activeElement.blur();

  try {
  host.innerHTML = '';
  if (state.trucks.length === 0) {
    host.innerHTML = `<div class="empty-hint"><b>トラックが選択されていません</b><br>左側からトラックを選択してください</div>`;
    return;
  }

  // 積み残し（未配置の残数）を中央UI上部に常時表示（指示書：モーダルを閉じても状況が分かるように）。
  // 部材（型式A等）は既定でトラック積載対象外＝そもそも積む前提ではないため、積み残し扱いにはしない。
  // 伝票上の表記（商品一覧の行）としては引き続き表示する。
  const residual = state.products
    .filter(p => !p.isMaterial)
    .map(p => ({ label: p.code, rem: remaining(p) }))
    .filter(x => x.rem > 0);
  if (residual.length > 0) {
    const banner = document.createElement('div');
    banner.className = 'residual-banner';
    banner.innerHTML = `⚠ 積み残しがあります：${residual.map(x => `${x.label} ×${x.rem}`).join('、')}`;
    host.appendChild(banner);
  }

  // サイズ未設定の商品がある場合の警告（指示書③：商品マスター改善）
  const sizeUnknownCodes = state.products.filter(p => p.sizeUnknown).map(p => p.code);
  if (sizeUnknownCodes.length > 0) {
    const banner = document.createElement('div');
    banner.className = 'residual-banner';
    banner.innerHTML = `⚠ サイズ未設定の商品があります：${sizeUnknownCodes.join('、')}（左の「商品マスター」から登録してください）`;
    host.appendChild(banner);
  }

  state.trucks.forEach((t, idx) => {
    const m = truckDims(t);
    const mode = t.viewMode || 'top';
    const truckPlacements = state.placements.filter(p => p.truckInstanceId === t.instanceId);
    const hasPlace = truckPlacements.length > 0;
    const hasOOB = truckPlacements.some(p => isPlacementOOB(p, m));   // ②はみ出し警告
    const hasCollision = truckPlacements.some(p => collides(t.instanceId, boxRect(p), p.id));   // 干渉警告（指示書Ver.2 §8）
    const block = document.createElement('div');
    block.className = 'truck-block';
    block.innerHTML = `
      <div class="tb-head">
        <span class="tb-tag">トラック${idx + 1}</span>
        <span class="tb-name">${truckLabel(t)}</span>
        <span class="tb-actions">
          <button class="tb-btn ${mode === 'top' ? 'is-on' : ''}" data-view="top">上面図</button>
          <button class="tb-btn ${mode === 'side' ? 'is-on' : ''}" data-view="side">側面図</button>
          <button class="tb-btn" data-relayout="1" ${hasPlace ? '' : 'disabled'}>再配置</button>
          <button class="tb-btn tb-clear" data-clear="1" ${hasPlace ? '' : 'disabled'}>配置消去</button>
          <button class="tb-btn tb-del" data-del="1">削除</button>
        </span>
      </div>
      <div class="tb-dims">
        荷台内寸: <b>${cargoDWH(m)} mm</b>
        ${m.estimated ? '<span class="tb-est">※暫定値</span>' : ''}
      </div>
      ${hasOOB ? '<div class="tb-oob-warning">⚠ 商品が荷台からはみ出しています。配置を確認してください。</div>' : ''}
      ${hasCollision ? '<div class="tb-oob-warning">⚠ 商品同士が干渉しています。位置を調整してください。</div>' : ''}
      <div class="dir-note"><span class="dir-arrow">◀</span> 前方（運転席）：この向きが進行方向</div>
      <div class="canvas-wrap">
        <div class="truck-cab" title="前方（運転席）">
          <div class="cab-roof"></div>
          <div class="cab-glass"></div>
          <span class="cab-label">前</span>
          <div class="cab-wheel"></div>
        </div>
        <div class="cab-boundary"></div>
        <div class="cargo"></div>
      </div>
      <div class="canvas-note">ドラッグ／クリックで配置（重ねられません・荷台外は不可）。ダブルクリックで90°回転／選択してDeleteで削除。</div>`;

    block.querySelector('[data-view="top"]').addEventListener('click', () => { t.viewMode = 'top'; renderCanvases(); });
    block.querySelector('[data-view="side"]').addEventListener('click', () => { t.viewMode = 'side'; renderCanvases(); });
    block.querySelector('[data-relayout="1"]').addEventListener('click', () => openRelayoutModal(t.instanceId));
    block.querySelector('[data-clear="1"]').addEventListener('click', () => clearTruckPlacements(t.instanceId));
    block.querySelector('[data-del="1"]').addEventListener('click', () => removeTruck(t.instanceId));

    host.appendChild(block);
    layoutCargo(block, t, mode);
  });
  } finally {
    window.scrollTo(scrollX, scrollY);
    if (rightPanel) rightPanel.scrollTop = rightScrollTop;
  }
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
  const info = placementInfo(p);
  const fp = footprint(info, p.rotation);
  const el = document.createElement('div');
  const oob = isPlacementOOB(p, truck);   // ②自動配置改善：はみ出し配置を視覚的に明示
  const interfering = collides(p.truckInstanceId, boxRect(p), p.id);   // 干渉中の商品を赤枠で明示（指示書Ver.2 §8）
  el.className = 'placement' + (selectedPid === p.id ? ' is-selected' : '') + (oob ? ' out-of-bounds' : '') + (interfering ? ' collide' : '');
  if (oob) el.title = '荷台からはみ出しています';
  else if (interfering) el.title = '他の商品と干渉しています';
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
  const isFoldable = !!info.folded;
  const foldMode = p.foldMode || state.productModes[p.code] || 'folded';
  const foldBadge = isFoldable
    ? `<button class="p-fold-toggle" title="クリックで折りたたみ⇄展開を切替（この1個だけ）">${foldMode === 'folded' ? '折' : '展'}</button>` : '';
  el.innerHTML = `${stackBadge}
    <span class="p-remove" title="配置を取り消す">×</span>
    ${foldBadge}
    <span class="p-code">${info.isMaterial ? info.name : p.code}</span>
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
      <span class="p-code">${info.isMaterial ? info.name : g.code}</span>
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
  /** クリック位置(mm座標)に重なっている、このトラック内の配置一覧を返す */
  const overlappingAt = (e) => {
    const rect = cargo.getBoundingClientRect();
    const scale = parseFloat(cargo.dataset.scale);
    const mmX = (e.clientX - rect.left) / scale;
    const mmY = (e.clientY - rect.top) / scale;
    return state.placements.filter(p =>
      p.truckInstanceId === truckInstance.instanceId &&
      rectsOverlap({ x: mmX, y: mmY, w: 1, h: 1 }, boxRect(p)));
  };

  cargo.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.placement');
    if (!el) { if (selectedPid) { selectedPid = null; renderCanvases(); } return; }
    if (e.target.classList.contains('p-remove')) {   // ❌ボタンで削除（CENTER-008）
      removePlacement(el.dataset.pid);
      return;
    }
    if (e.target.classList.contains('p-fold-toggle')) {   // 折/展ボタンでこの1個だけ切替
      toggleFoldPlacement(el.dataset.pid);
      return;
    }

    // 干渉で重なった商品が複数ある場合、同じ場所を続けてクリックすると奥の商品へ
    // 選択が順送りされる（重なって隠れた商品にも手が届くように）
    let target = el;
    const candidates = overlappingAt(e);
    if (candidates.length > 1) {
      const curIdx = candidates.findIndex(p => p.id === selectedPid);
      if (curIdx !== -1) {
        const next = candidates[(curIdx + 1) % candidates.length];
        const nextEl = cargo.querySelector(`.placement[data-pid="${next.id}"]`);
        if (nextEl) target = nextEl;
      }
    }

    // クリックで選択（Deleteキー対象）。ハイライト更新
    if (selectedPid !== target.dataset.pid) {
      selectedPid = target.dataset.pid;
      document.querySelectorAll('.placement.is-selected').forEach(x => x.classList.remove('is-selected'));
      target.classList.add('is-selected');
    }
    startBoxDrag(e, target, cargo, truckInstance, m);
  });
  cargo.addEventListener('dblclick', (e) => {
    const el = e.target.closest('.placement');
    if (!el) return;
    // 選択中の商品がこの位置の重なりに含まれていれば、それを優先して回転する
    // （クリックで奥の商品へ選択を切り替え済みの場合はその選択を尊重する）
    const candidates = overlappingAt(e);
    const preferred = candidates.find(p => p.id === selectedPid);
    rotatePlacement(preferred ? preferred.id : el.dataset.pid);
  });
}

/** 実寸(mm)座標に商品を新規配置 */
function dropProductAt(code, truckInstance, m, mmX, mmY) {
  const prod = state.products.find(p => p.code === code);
  if (!prod) return;
  if (prod.isMaterial && !state.materialIncluded[code]) { toast('部材はデフォルトで積載対象外です。「トラックへ積む」をONにしてください'); return; }
  if (remaining(prod) <= 0) { flashNoStock(code); toast(`${code} は残りがありません`); return; }

  const info = productInfo(code);

  // 二段積み: 同一品番の上へドロップしたら段を重ねる（商品マスターのstackable/maxStackに従う）CENTER-003
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
  // クリック位置を中心に置く（荷台内へクランプ＝荷台外には出さない）
  let x = mmX - fp.lenX / 2;
  let y = mmY - fp.lenY / 2;
  ({ x, y } = clampToCargo(x, y, fp, m));
  // 近くの商品や壁に磁石のように吸着させる（手動配置でも自然に隙間なく並べられるように）
  ({ x, y } = snapPosition({ x, y, w: fp.lenX, h: fp.lenY }, truckInstance.instanceId, null, m));

  // 他商品との重なりは配置自体を拒否せず許可する。干渉は警告バナーで示し、ユーザーが後で調整する（指示書Ver.2 §8）
  const master = getProductMaster(code);
  const foldMode = (master && master.folded) ? (state.productModes[code] || 'folded') : undefined;
  state.placements.push({ id: uid('p'), truckInstanceId: truckInstance.instanceId, code, x: Math.round(x), y: Math.round(y), rotation: 0, stack: 1, foldMode });
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

const SNAP_THRESHOLD = 25;   // mm: この距離以内なら磁石のように吸着させる
/**
 * rect(x,y,w,h)を、同じトラック内の他商品の辺や荷台の壁に磁石のように吸着させた座標へ補正する。
 * X軸・Y軸それぞれ独立に、最も近い吸着候補（相手の辺に接する／端をそろえる／壁に接する）を選ぶ。
 * 新規配置（手入力での最初の設置）・既存配置のドラッグ移動の両方で使う。
 */
function snapPosition(rect, truckInstanceId, excludePid, m) {
  const others = state.placements
    .filter(p => p.truckInstanceId === truckInstanceId && p.id !== excludePid)
    .map(boxRect);

  const xCandidates = [0, m.cargoLength - rect.w];
  const yCandidates = [0, m.cargoWidth - rect.h];
  others.forEach(o => {
    xCandidates.push(o.x - rect.w, o.x + o.w, o.x, o.x + o.w - rect.w);
    yCandidates.push(o.y - rect.h, o.y + o.h, o.y, o.y + o.h - rect.h);
  });

  let snapX = rect.x, bestDx = SNAP_THRESHOLD;
  xCandidates.forEach(cx => { const d = Math.abs(cx - rect.x); if (d < bestDx) { bestDx = d; snapX = cx; } });
  let snapY = rect.y, bestDy = SNAP_THRESHOLD;
  yCandidates.forEach(cy => { const d = Math.abs(cy - rect.y); if (d < bestDy) { bestDy = d; snapY = cy; } });

  return { x: snapX, y: snapY };
}

/* -------- 当たり判定（Ver1.1 §6）: 商品同士は重ねられない -------- */
/** 配置の占有矩形(mm)を返す */
function boxRect(p) {
  const fp = footprint(placementInfo(p), p.rotation);
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

/** placements配列（stateとは限らない任意の配置リスト）から空き長方形群を算出する共通処理 */
function computeFreeRectsFromList(placements, m, extraLen = 0, extraWid = 0) {
  let free = [{ x: 0, y: 0, w: m.cargoLength + extraLen, h: m.cargoWidth + extraWid }];
  placements.forEach(p => {
    const occ = boxRect(p);
    let next = [];
    free.forEach(r => next.push(...subtractRect(r, occ)));
    free = pruneContainedRects(next);
  });
  return free;
}

/**
 * そのトラックの現在の空き長方形群を、既存の配置を差し引いて算出する。
 * extraLen/extraWid を指定すると、荷台の実サイズより広い仮想領域で計算する
 * （②自動配置改善：本来のスペースでは入らない商品を、はみ出し許容で置くためのフォールバック用）。
 */
function computeFreeRects(t, m, extraLen = 0, extraWid = 0) {
  return computeFreeRectsFromList(state.placements.filter(p => p.truckInstanceId === t.instanceId), m, extraLen, extraWid);
}

/**
 * 空き長方形群の中から商品(0°/90°)を置く場所を選ぶ（AUTO-001/002/008）。
 * 優先順位（指示書Ver.2 §9・積載効率を最優先）：
 *   ① 最も無駄なくフィットする向き・空き（shortSideが最小＝空きスペースを最小化）を最優先
 *   ② 同程度のフィットなら前方(小x)→前面(小y)の順で選ぶ（同点時のみ見た目を考慮）
 * 「同じ商品を綺麗に並べる」見た目の分かりやすさより、積載率の最大化を優先する。
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
    if (!best || bestForRect.shortSide < best.shortSide - 0.5 ||
        (Math.abs(bestForRect.shortSide - best.shortSide) <= 0.5 && r.x < best.x - 0.5) ||
        (Math.abs(bestForRect.shortSide - best.shortSide) <= 0.5 && Math.abs(r.x - best.x) <= 0.5 && r.y < best.y - 0.5)) {
      best = { x: r.x, y: r.y, rot: bestForRect.rot, fp: bestForRect.fp, shortSide: bestForRect.shortSide };
    }
  });
  return best;
}

/**
 * bestFreeRectFitの「前方優先」版（再配置の比較案で使用）。
 * 優先順位: ① 前方(小x) → ② 前面(小y) → ③ 最もフィットする向き。
 * 積載効率よりも、前から順に詰まっていく見やすさを優先する（Ver.2以前の既定ロジック）。
 */
function bestFreeRectFitFront(freeRects, fp0, fp90) {
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

  const info = placementInfo(p);
  const fp = footprint(info, p.rotation);
  const startX = e.clientX, startY = e.clientY;
  const origX = p.x, origY = p.y;
  let curX = origX, curY = origY;
  let dragging = false;
  const DRAG_THRESHOLD = 4;   // px: これを超えて動くまでは「クリック／ダブルクリック」として扱う

  // ドラッグ中は荷台外へ出ることも他商品との重なりも一時的に許可する（指示書Ver.2 §7/§8）。
  // 位置調整のしやすさを優先し、可否判定は指を離した「配置確定」の瞬間にのみ行う。
  // 実際に動くまで setPointerCapture しないのは、単純なクリック／ダブルクリック（回転）が
  // ポインタキャプチャの影響でブラウザのdblclick判定を妨げないようにするため。
  const move = (ev) => {
    const dx = ev.clientX - startX, dy = ev.clientY - startY;
    if (!dragging) {
      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
      dragging = true;
      el.classList.add('dragging');
      el.setPointerCapture(e.pointerId);
    }
    const rawX = origX + dx / scale, rawY = origY + dy / scale;
    // 近くの商品や壁に磁石のように吸着させる（指示書：アイテム同士がくっつきやすいように）
    ({ x: curX, y: curY } = snapPosition({ x: rawX, y: rawY, w: fp.lenX, h: fp.lenY }, truckInstance.instanceId, p.id, m));
    el.style.left = (curX * scale) + 'px';
    el.style.top = (curY * scale) + 'px';
    const rect = { x: curX, y: curY, w: fp.lenX, h: fp.lenY };
    el.classList.toggle('collide', collides(truckInstance.instanceId, rect, p.id));
    el.classList.toggle('oob-drag', !insideCargo(rect, m));
  };
  const up = () => {
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    if (!dragging) return;   // 実際には動いていない＝単なるクリック。位置はそのまま
    el.classList.remove('dragging', 'collide', 'oob-drag');

    const rect = { x: curX, y: curY, w: fp.lenX, h: fp.lenY };
    if (insideCargo(rect, m)) {
      // 荷台内であれば、他商品と重なっていてもそのまま確定する（干渉は警告バナーで表示）
      p.x = Math.round(curX);
      p.y = Math.round(curY);
    } else {
      // 荷台外での確定は不可 → 元の位置へ戻す
      toast('荷台外のため配置できません');
      p.x = origX;
      p.y = origY;
    }
    renderCanvases();   // はみ出し／干渉の警告バナーを再評価
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
  const fp = footprint(placementInfo(p), newRot);
  // 回転後に荷台からはみ出す分は押し戻す（荷台外には出さない）
  const pos = clampToCargo(p.x, p.y, fp, m);
  // 縦横の切替は他商品と重なっていても常に許可する。干渉は警告バナーで示すのみ（指示書Ver.2 §6/§8）
  p.rotation = newRot;
  p.x = pos.x; p.y = pos.y;
  renderCanvases();
  saveToLocal();
}

/** 折りたたみ対応商品の、この配置1個だけの折/展を切替える（商品一覧の既定値には影響しない） */
function toggleFoldPlacement(pid) {
  const p = state.placements.find(x => x.id === pid);
  if (!p) return;
  const master = getProductMaster(p.code);
  if (!master || !master.folded) return;
  const current = p.foldMode || state.productModes[p.code] || 'folded';
  p.foldMode = current === 'folded' ? 'unfolded' : 'folded';
  const m = truckDims(state.trucks.find(t => t.instanceId === p.truckInstanceId));
  const fp = footprint(placementInfo(p), p.rotation);
  // 寸法が変わるぶん、荷台からはみ出す分は押し戻す（他商品との重なりは警告バナーで示すのみ）
  const pos = clampToCargo(p.x, p.y, fp, m);
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
/**
 * 商品コード配列(units)をトラックへ自動配置する。
 * targetTruckId を指定すると、そのトラック1台だけに配置する（伝票単位の「トラック配置」§4）。
 * 省略時は従来どおり全トラックを前方（先頭）から順に試す（全体自動配置）。
 */
function placeUnits(units, targetTruckId) {
  if (state.trucks.length === 0) { toast('先にトラックを選択してください'); return { placed: 0, failed: 0, noTruck: true }; }
  const pool = targetTruckId ? state.trucks.filter(t => t.instanceId === targetTruckId) : state.trucks;
  if (pool.length === 0) { toast('配置先のトラックが見つかりません'); return { placed: 0, failed: 0, noTruck: true }; }

  // phase1: 高さ降順 → 同高はフットプリント大きい順
  units.sort((a, b) => {
    const ia = productInfo(a), ib = productInfo(b);
    return (ib.height - ia.height) || (ib.width * ib.depth - ia.width * ia.depth);
  });

  const failedByCode = {};   // 積み切れなかった商品を品番ごとに集計（指示書Ver.2 §10）

  let placed = 0, failed = 0;

  units.forEach(code => {
    const info = productInfo(code);

    // phase5: 二段積み可能品は前方の既存プレースへ積み増す（新しい床面積を使わない・配置先候補内のみ）
    if (canStack(info)) {
      const target = frontmostStackable(code, info.maxStack || 1, targetTruckId);
      if (target) { target.stack = (target.stack || 1) + 1; placed++; return; }
    }

    // phase2〜4: 配置先候補（全トラック or 指定トラックのみ）を前方から順に試し、
    //            その中の空き長方形から最もフィットする場所へ詰める（＝隙間を残さない配置を優先）
    const fp0 = footprint(info, 0);
    const fp90 = footprint(info, 90);
    let placedHere = false;

    for (const t of pool) {
      const m = truckDims(t);
      const free = computeFreeRects(t, m);
      const best = bestFreeRectFit(free, fp0, fp90);

      if (best) {
        const foldMode = info.folded ? (state.productModes[code] || 'folded') : undefined;
        state.placements.push({ id: uid('p'), truckInstanceId: t.instanceId, code, x: Math.round(best.x), y: Math.round(best.y), rotation: best.rot, stack: 1, foldMode });
        placed++; placedHere = true;
        break;   // 置けたので次の候補トラックは試さない（前方＝先頭から埋める）
      }
    }

    // 荷台の実寸内に収まらない場合は、はみ出させて無理に置かない。積まずに残し、
    // 「商品が残っています」として一覧で警告する（指示書Ver.2追記：はみ出し配置の廃止）
    if (!placedHere) { failed++; failedByCode[code] = (failedByCode[code] || 0) + 1; }
  });

  renderProductList();
  renderCanvases();
  saveToLocal();
  return { placed, failed, failedByCode };
}

/** 同一品番で積み余地がある配置のうち最も前方(小x)のものを返す（truckIdを指定するとそのトラック内のみ対象） */
function frontmostStackable(code, maxStack, truckId) {
  let best = null;
  state.placements.forEach(p => {
    if (p.code === code && (p.stack || 1) < maxStack && (!truckId || p.truckInstanceId === truckId)) {
      if (!best || p.x < best.x) best = p;
    }
  });
  return best;
}

/** placeUnits の結果を伝えるトースト文言（②はみ出し許容の注記を含む） */
function placeResultToast(prefix, r) {
  if (r.failed > 0) {
    showResidualWarning(r);   // 積み切れなかった商品を品番ごとに一覧表示（指示書Ver.2 §10）
  } else {
    toast(`${prefix}${r.placed}個を配置しました`);
  }
}

/** 最後まで積んだ上でなお積み切れなかった商品を、品番・数量つきで警告表示する（指示書Ver.2 §10） */
function showResidualWarning(r) {
  const rows = Object.entries(r.failedByCode || {}).map(([code, qty]) => {
    const info = productInfo(code);
    const label = (info && info.isMaterial) ? info.name : code;
    return `<div class="residual-row"><span class="residual-code">${label}</span><span class="residual-qty">×${qty}</span></div>`;
  }).join('');
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML = `
    <div class="modal">
      <h3>⚠ 商品が残っています</h3>
      <p class="modal-message">最大限積み込みましたが、積載できなかった商品があります。</p>
      <div class="residual-list">${rows}</div>
      <div class="modal-actions">
        <button class="btn btn-primary" data-ok>確認しました</button>
      </div>
    </div>`;
  const close = () => mask.remove();
  mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
  mask.querySelector('[data-ok]').addEventListener('click', close);
  document.body.appendChild(mask);
}

/* ---------------------------------------------------------------------------
 * 再配置（複数案の比較・選択）
 *   現在そのトラックに積まれている商品構成はそのまま保ち、異なるロジックで
 *   組み直した候補案を2〜3種類生成し、ミニプレビューを見比べて選べるようにする。
 * ------------------------------------------------------------------------- */
/** truckInstanceId に現在積まれている商品を、品番の配列（stackはユニットに展開）で返す */
function unitsFromTruckPlacements(truckInstanceId) {
  const units = [];
  state.placements.filter(p => p.truckInstanceId === truckInstanceId).forEach(p => {
    for (let i = 0; i < (p.stack || 1); i++) units.push(p.code);
  });
  return units;
}

/** 現在配置済みの全商品（全トラック合計）を、品番の配列（stackはユニットに展開）で返す */
function unitsFromAllPlacements() {
  const units = [];
  state.placements.forEach(p => { for (let i = 0; i < (p.stack || 1); i++) units.push(p.code); });
  return units;
}

/**
 * units を、指定した並び順(sortFn)・フィット関数(fitFn)でトラック群(trucks)へ組み直す。
 * 実際のstateには一切触れず、トラックごとの仮配置リストを返すだけ（比較用プレビュー生成のため）。
 * trucks配列の順番を「前方から埋める」優先順位として扱う（既存のplaceUnitsと同じ考え方）。
 */
function buildLayoutCandidate(units, trucks, sortFn, fitFn) {
  const ordered = [...units].sort(sortFn);
  const byTruck = new Map(trucks.map(t => [t.instanceId, []]));
  let failed = 0;
  ordered.forEach(code => {
    const info = productInfo(code);
    if (canStack(info)) {
      let stackTarget = null;
      trucks.forEach(t => {
        byTruck.get(t.instanceId).forEach(p => {
          if (p.code === code && (p.stack || 1) < (info.maxStack || 1)) {
            if (!stackTarget || p.x < stackTarget.x) stackTarget = p;
          }
        });
      });
      if (stackTarget) { stackTarget.stack = (stackTarget.stack || 1) + 1; return; }
    }
    const fp0 = footprint(info, 0), fp90 = footprint(info, 90);
    let placedHere = false;
    for (const t of trucks) {
      const m = truckDims(t);
      const list = byTruck.get(t.instanceId);
      const free = computeFreeRectsFromList(list, m);
      const best = fitFn(free, fp0, fp90);
      if (best) {
        const foldMode = info.folded ? (state.productModes[code] || 'folded') : undefined;
        list.push({ id: uid('cand'), code, x: Math.round(best.x), y: Math.round(best.y), rotation: best.rot, stack: 1, foldMode });
        placedHere = true;
        break;
      }
    }
    if (!placedHere) failed++;
  });
  return { byTruck, failed };
}

const RELAYOUT_STRATEGIES = [
  {
    label: '積載効率優先（現在の既定）',
    desc: '空きスペースを最も無駄なく埋める配置。積める量を最大化する。',
    sortFn: (a, b) => { const ia = productInfo(a), ib = productInfo(b); return (ib.height - ia.height) || (ib.width * ib.depth - ia.width * ia.depth); },
    fitFn: bestFreeRectFit,
  },
  {
    label: '前方優先・見やすさ重視',
    desc: '前から順に詰め、荷下ろし順や見た目の分かりやすさを優先する。',
    sortFn: (a, b) => { const ia = productInfo(a), ib = productInfo(b); return (ib.height - ia.height) || (ib.width * ib.depth - ia.width * ia.depth); },
    fitFn: bestFreeRectFitFront,
  },
  {
    label: '同一商品をまとめて配置',
    desc: '同じ品番の商品同士が近くにまとまるよう、品番ごとに続けて詰める。',
    sortFn: (a, b) => a.localeCompare(b) || 0,
    fitFn: bestFreeRectFitFront,
  },
];

function fillRatioOf(placements, m) {
  const area = placements.reduce((sum, p) => { const fp = footprint(productInfo(p.code), p.rotation); return sum + fp.lenX * fp.lenY; }, 0);
  return area / (m.cargoLength * m.cargoWidth);
}

/** 1台分のミニプレビューをhost内へ描画する（実キャンバスとは独立した簡易版） */
function renderMiniPreview(host, placements, m) {
  const box = host.getBoundingClientRect();
  const scale = Math.min((box.width || 260) / m.cargoLength, (box.height || 90) / m.cargoWidth);
  placements.forEach(p => {
    const info = productInfo(p.code);
    const fp = footprint(info, p.rotation);
    const el = document.createElement('div');
    el.className = 'relayout-box';
    el.style.left = (p.x * scale) + 'px';
    el.style.top = (p.y * scale) + 'px';
    el.style.width = (fp.lenX * scale) + 'px';
    el.style.height = (fp.lenY * scale) + 'px';
    el.style.borderColor = info.color;
    el.style.background = hexToRgba(info.color, 0.25);
    host.appendChild(el);
  });
}

/**
 * 再配置モーダル本体（1台分の再配置／全体の再配置で共通）。
 * trucks: 対象トラック配列（1台なら単一トラック再配置、複数なら全体再配置）
 * units: 組み直す商品の品番配列、applyFn: 「この案を適用」時にstateへ反映する処理
 */
function openRelayoutModalCore(trucks, units, applyFn, title, message) {
  if (trucks.length === 0) { toast('先にトラックを選択してください'); return; }
  if (units.length === 0) { toast('組み直す商品がありません'); return; }

  const candidates = RELAYOUT_STRATEGIES.map(strategy => ({
    ...strategy,
    result: buildLayoutCandidate(units, trucks, strategy.sortFn, strategy.fitFn),
  }));

  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  const cardsHtml = candidates.map((c, i) => {
    const totalArea = trucks.reduce((s, t) => { const m = truckDims(t); return s + m.cargoLength * m.cargoWidth; }, 0);
    const usedArea = trucks.reduce((s, t) => s + fillRatioOf(c.result.byTruck.get(t.instanceId), truckDims(t)) * (truckDims(t).cargoLength * truckDims(t).cargoWidth), 0);
    const fillPct = Math.round((usedArea / totalArea) * 100);
    const previewsHtml = trucks.map((t, ti) => `<div class="relayout-preview" data-cand="${i}" data-truck="${ti}"></div>`).join('');
    return `
      <div class="relayout-card">
        <div class="relayout-previews">${previewsHtml}</div>
        <div class="relayout-info">
          <div class="relayout-label">${c.label}</div>
          <div class="relayout-desc">${c.desc}</div>
          <div class="relayout-stats">積載率目安 ${fillPct}%${c.result.failed > 0 ? `／積み残し ${c.result.failed}個` : ''}</div>
          <button class="btn btn-primary relayout-apply" data-cand="${i}">この案を適用</button>
        </div>
      </div>`;
  }).join('');
  mask.innerHTML = `
    <div class="modal relayout-modal">
      <h3>${title}</h3>
      <p class="modal-message">${message}</p>
      <div class="relayout-cards">${cardsHtml}</div>
      <div class="modal-actions">
        <button class="btn" data-cancel>キャンセル</button>
      </div>
    </div>`;
  const close = () => mask.remove();
  mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
  mask.querySelector('[data-cancel]').addEventListener('click', close);
  mask.querySelectorAll('.relayout-apply').forEach(btn => {
    btn.addEventListener('click', () => {
      const cand = candidates[parseInt(btn.dataset.cand, 10)];
      applyFn(cand);
      close();
      if (cand.result.failed > 0) toast(`一部の商品はこの案では積み切れませんでした（${cand.result.failed}個）`);
      else toast('再配置しました');
    });
  });
  document.body.appendChild(mask);

  candidates.forEach((c, i) => {
    trucks.forEach((t, ti) => {
      const host = mask.querySelector(`.relayout-preview[data-cand="${i}"][data-truck="${ti}"]`);
      renderMiniPreview(host, c.result.byTruck.get(t.instanceId), truckDims(t));
    });
  });
}

/** トラック1台分の再配置（トラックブロックの「再配置」ボタン） */
function openRelayoutModal(truckInstanceId) {
  const t = state.trucks.find(x => x.instanceId === truckInstanceId);
  if (!t) return;
  const units = unitsFromTruckPlacements(truckInstanceId);
  openRelayoutModalCore([t], units, (cand) => {
    state.placements = state.placements.filter(p => p.truckInstanceId !== truckInstanceId)
      .concat(cand.result.byTruck.get(truckInstanceId).map(p => ({ ...p, id: uid('p'), truckInstanceId })));
    renderProductList();
    renderCanvases();
    saveToLocal();
  }, '再配置案を選択', '現在この荷台に積まれている商品を、異なるロジックで組み直しました。気に入った案を選んでください。');
}

/** 全トラック分の再配置（「トラックへ積む（自動配置）」ボタン） */
function openGlobalRelayoutModal() {
  const units = unitsFromAllPlacements();
  state.products.forEach(p => {
    if (p.isMaterial && !state.materialIncluded[p.code]) return;   // 部材は既定で自動配置の対象外
    for (let i = 0; i < remaining(p); i++) units.push(p.code);
  });
  openRelayoutModalCore(state.trucks, units, (cand) => {
    const next = [];
    state.trucks.forEach(t => {
      cand.result.byTruck.get(t.instanceId).forEach(p => next.push({ ...p, id: uid('p'), truckInstanceId: t.instanceId }));
    });
    state.placements = next;
    renderProductList();
    renderCanvases();
    saveToLocal();
  }, '全体の再配置案を選択', '配置済み＋未配置の残数をあわせた全商品を、全トラックへ異なるロジックで組み直しました。気に入った案を選んでください。');
}

/** 指定した伝票のみ自動配置（RIGHT-004）。在庫(残)の範囲で積む */
function autoPlaceSlip(slipId) {
  const s = state.slips.find(x => x.id === slipId);
  if (!s) return;
  const units = [];
  const used = {};
  (s.items || []).forEach(it => {
    if (isMaterialType(it.code) && !state.materialIncluded[it.code]) return;   // 部材は既定で自動配置の対象外
    const cap = remainingByCode(it.code) - (used[it.code] || 0);
    const n = Math.min(it.qty, Math.max(0, cap));
    for (let i = 0; i < n; i++) units.push(it.code);
    used[it.code] = (used[it.code] || 0) + n;
  });
  if (units.length === 0) { toast('この伝票に積める残数がありません'); return; }
  const r = placeUnits(units, s.targetTruckId);
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
  document.getElementById('pmAccHead').addEventListener('click', () => { accOpen.pm = !accOpen.pm; renderProductMasterAccordion(); });

  // 中央「＋ トラック追加」→ トラックピッカー
  document.getElementById('btnAddTruckDashed').addEventListener('click', openTruckPicker);

  // 右「＋ 伝票を追加読込」→ ファイル選択（OCR追加読込）§RIGHT-001
  document.getElementById('btnAddOcr').addEventListener('click', () => document.getElementById('fileSlip').click());

  // 手入力（伝票選択・品番・数量）で商品を追加（OCRできない商品用）LEFT-005
  document.getElementById('btnManualAdd').addEventListener('click', addProductManual);
  document.getElementById('manCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') addProductManual(); });
  document.getElementById('manQty').addEventListener('keydown', (e) => { if (e.key === 'Enter') addProductManual(); });

  // 「トラックへ積む」自動配置
  document.getElementById('btnAutoPlace').addEventListener('click', openGlobalRelayoutModal);

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
/** 正規化してマスターの正式品番に解決。見つからなければ正規化文字列を返す（新規登録した型式も対象）*/
function resolveProductCode(raw) {
  const n = normalizeCode(raw);
  if (!n) return '';
  const codes = [...PRODUCT_MASTER.map(p => p.code), ...customProductCodes()];
  let hit = codes.find(c => c.toUpperCase() === n);
  if (hit) return hit;
  const nh = n.replace(/-/g, '');                 // ハイフン有無を吸収
  hit = codes.find(c => c.toUpperCase().replace(/-/g, '') === nh);
  return hit || n;
}

/* ---------------------------------------------------------------------------
 * OCR結果 ×商品マスター照合（Logistics改善指示書 §5）
 *   OCR → 商品マスター検索 → 一致候補抽出 → 一致率判定 → 正式商品へ変換
 *   品番が正しく読めた場合は品番一致(confidence=1)を優先。品番が無い/読めない場合は
 *   商品名の文字bigram類似度（Dice係数、空白を持たない日本語でも安定して比較できる）で
 *   最も近い商品マスターへ補正する。
 * ------------------------------------------------------------------------- */
function bigrams(s) {
  const grams = [];
  for (let i = 0; i < s.length - 1; i++) grams.push(s.slice(i, i + 2));
  return grams;
}
/** 商品名同士の類似度（0〜1）。Sørensen-Dice係数（文字bigram） */
function nameSimilarity(a, b) {
  const norm = (s) => toHalfWidth(String(s || '')).replace(/[\s　()（）]/g, '');
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ga = bigrams(na), gb = bigrams(nb);
  if (ga.length === 0 || gb.length === 0) return na === nb ? 1 : 0;
  const counts = new Map();
  gb.forEach(g => counts.set(g, (counts.get(g) || 0) + 1));
  let overlap = 0;
  ga.forEach(g => { const c = counts.get(g) || 0; if (c > 0) { overlap++; counts.set(g, c - 1); } });
  return (2 * overlap) / (ga.length + gb.length);
}
const OCR_NAME_MATCH_THRESHOLD = 0.45;   // これ未満は「一致候補なし」として未解決扱いにする

/**
 * OCRが読み取った1行（品番らしき文字列 / 商品名 / 数量）を商品マスターへ照合し、
 * 正式な商品コードへ変換する。部材（型式A等）は照合せずそのまま返す。
 * 戻り値: { code, qty, def, method:'material'|'code'|'name'|'none', confidence, rawName }
 */
function matchOcrLine(line) {
  const qty = line.qty;
  const rawCode = (line.rawCode || '').trim();
  const rawName = (line.rawName || '').trim();

  if (rawCode && isMaterialType(rawCode)) {
    return { code: normalizeCode(rawCode) || rawCode, qty, def: { name: rawName || '部材' }, method: 'material', confidence: 1, rawName };
  }

  // ①品番として一致するか（読み取れていれば最優先・確実。新規登録した型式も対象＝指示書②④）
  if (rawCode) {
    const resolved = resolveProductCode(rawCode);
    const exact = getProductMaster(resolved);
    if (exact) return { code: exact.code, qty, method: 'code', confidence: 1, rawName };
  }

  // ②品番が無い/一致しない場合は商品名の近似一致で補正（新規登録した型式も対象）
  if (rawName) {
    const candidates = [...PRODUCT_MASTER, ...customProductCodes().map(getProductMaster)];
    let best = null, bestScore = 0;
    candidates.forEach(p => {
      const score = nameSimilarity(rawName, p.name);
      if (score > bestScore) { bestScore = score; best = p; }
    });
    if (best && bestScore >= OCR_NAME_MATCH_THRESHOLD) {
      return { code: best.code, qty, method: 'name', confidence: bestScore, rawName };
    }
  }

  // ③一致候補なし → 未解決のまま手入力同様に保持（手動修正を促す）
  return { code: rawCode || rawName || '?', qty, def: { name: rawName || rawCode || '未認識' }, method: 'none', confidence: 0, rawName };
}

/* 手入力で商品追加。選択した伝票（またはOCR外の「手入力」）へ品番・数量を追加 LEFT-005/006 */
/**
 * 品番を指定した伝票（またはtarget==='manual'なら手入力グループ）へ追加する共通処理。
 * 左下の手入力フォーム・各伝票カード下部の追加フォームの両方から使う。
 */
function addItemToTarget(target, rawCode, qty) {
  const code = resolveProductCode(rawCode);
  if (!code) { toast('品番を入力してください'); return null; }

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
      const def = master ? null : { name: code, width: 400, depth: 400, height: 400, color: pickColor(state.products.length), sizeUnknown: true };
      if (!master) toast(`「${code}」はサイズ未設定です。商品マスターから登録してください`);
      state.manual.push({ id: uid('m'), code, qty, def });
    }
  }

  rebuildProducts();
  renderUploads();
  renderProductList();
  renderCanvases();
  saveToLocal();
  return code;
}

/** その伝票のカード下部の追加フォームから、品番をその伝票へ直接追加する */
function addItemToSlip(slipId, rawCode, qty) {
  addItemToTarget(slipId, rawCode, qty);
}

function addProductManual() {
  const codeEl = document.getElementById('manCode');
  const qtyEl = document.getElementById('manQty');
  const slipSel = document.getElementById('manSlip');
  const qty = Math.max(1, parseInt(qtyEl.value, 10) || 1);
  const target = slipSel ? slipSel.value : 'manual';
  const code = addItemToTarget(target, codeEl.value, qty);
  if (!code) { codeEl.focus(); return; }

  codeEl.value = '';
  qtyEl.value = '1';
  codeEl.focus();
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
      state.materialIncluded = {};
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
      items: runOcr(state.slips.length),   // ★OCR結果を商品マスターへ照合済み（伝票ごと）§5
      targetTruckId: (state.trucks[0] && state.trucks[0].instanceId) || null,   // 配置先トラック（既定は先頭）§4
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
/**
 * OCRエンジンのスタブ（本番: 写真/PDF → OCRエンジン → {rawCode, rawName, qty}の生読取結果）。
 * 品番が鮮明に読めなかった行は rawCode を空にし、商品名だけを渡す（③の行で再現）。
 * 実OCR接続時はここを実エンジン呼び出しに差し替え、{rawCode, rawName, qty}を返せばよい。
 * 型式「A」の部材は rawCode='A' として渡す（§1・商品マスター照合はしない）。
 */
function runOcrStub(slipIndex) {
  const sets = [
    [{ rawCode: 'C6', rawName: '宝飾ケース（黒）', qty: 8 },
     { rawCode: 'C8N', rawName: '宝飾角ケース（黒）', qty: 3 },
     { rawCode: 'A', rawName: 'ガラス', qty: 2 }],
    [{ rawCode: 'C6', rawName: '宝飾ケース（黒）', qty: 8 },
     { rawCode: 'C9', rawName: '宝飾ハイケース（黒）', qty: 4 }],
    [{ rawCode: '', rawName: '宝飾ケース', qty: 4 },     // 品番が読み取れず商品名のみ→商品マスター照合で C6 へ補正される例
     { rawCode: 'C90C', rawName: 'ガラスハイケース', qty: 2 }],
  ];
  return sets[slipIndex % sets.length].map(x => ({ ...x }));
}

/** OCRの生読取結果を商品マスターへ照合し、伝票明細（{code,qty,def,method,confidence,rawName}）へ変換する §5 */
function runOcr(slipIndex) {
  return runOcrStub(slipIndex).map(matchOcrLine);
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
    slips: state.slips.map(s => ({ id: s.id, name: s.name, isImage: s.isImage, items: s.items, targetTruckId: s.targetTruckId || null })),
    manual: state.manual,
    placements: state.placements,
    productModes: state.productModes,   // ③展開/折りたたみの選択状態
    materialIncluded: state.materialIncluded,   // 部材（型式A等）の積載対象フラグ
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
    items: (s.items || []).map(it => ({
      code: it.code, qty: it.qty, def: it.def || null,
      method: it.method || null, confidence: it.confidence, rawName: it.rawName || null,
    })),
    targetTruckId: s.targetTruckId || null,
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
    foldMode: p.foldMode || undefined,
  }));
  state.productModes = obj.productModes || {};
  state.materialIncluded = obj.materialIncluded || {};
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
      <td style="font-weight:700">${p.isMaterial ? '' : p.code}</td>
      <td>${p.name}</td>
      <td style="text-align:center">${p.isMaterial ? '' : `${p.width}×${p.depth}×${p.height}`}</td>
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
      ${info.isMaterial ? info.name : p.code}</div>`;
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
