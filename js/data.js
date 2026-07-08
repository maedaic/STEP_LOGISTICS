/* =========================================================================
 * data.js — マスターデータ（トラック / 商品）※アプリ実行時に使う実体
 *
 * すべて実寸(mm)・実重(kg)で保持する。UIはこの実寸データの可視化にすぎない。
 *
 * ★正本（Source of Truth）は data/ 配下のJSONファイル：
 *     data/vehicle-master.json  ← TRUCK_MASTER の正本
 *     data/product-master.json  ← PRODUCT_MASTER の正本（STEP Studio全体で共通利用）
 *   将来「Settings」モジュールが持つ共通マスターの土台となる想定のため、
 *   実寸の追加・修正はまず data/*.json 側を直し、このファイルへ反映すること。
 *   このファイルには、アプリ描画専用の追加項目（color, group, viewMode用の
 *   external/placeholder フラグ等）が乗っている点でJSONそのものとは異なる。
 * ======================================================================= */

/**
 * トラックマスター（正本: data/vehicle-master.json）
 * group   : 'step'（STEP車両）| 'gaisha'（業者トラック）
 * cargo*  : 荷台内寸(mm)   ← レイアウト描画・寸法表示(D/W/H)の基準
 *           D=cargoLength（長さ/奥行）, W=cargoWidth（幅）, H=cargoHeight（高さ）
 * external: 業者トラック（クリックごとに枝番付きで複数追加）
 * placeholder: 将来追加枠（選択不可）
 *
 * ※ 積載量目安・車外寸はUI表示から廃止（荷台寸法のみ表示）。
 * ※ 荷台内寸が実測で未確定のものは estimated:true を付けている。
 *    正確な値が分かり次第このファイルと data/vehicle-master.json の両方を更新すること。
 */
const TRUCK_MASTER = [
  // ---- STEP車両（荷台実寸: 画像②「ステップ車輌 荷台の寸法」2026-07-08 反映）----
  //   長さ=cargoLength(D), 幅=cargoWidth(W), 高さ=cargoHeight(H)
  { id: 'dutro3', group: 'step', name: '（小）デュトロ③', cargoLength: 4500, cargoWidth: 2050, cargoHeight: 2150 },
  { id: 'dutro2', group: 'step', name: 'デュトロ②',       cargoLength: 5500, cargoWidth: 2050, cargoHeight: 2150 },
  // ⑤⑥は画像②で該当箇所が黒塗り（未開示）のため未確定 → 暫定値のまま
  { id: 'dutro5', group: 'step', name: 'デュトロ⑤',       cargoLength: 4360, cargoWidth: 2060, cargoHeight: 2070, estimated: true },
  { id: 'dutro6', group: 'step', name: 'デュトロ⑥',       cargoLength: 4360, cargoWidth: 2060, cargoHeight: 2070, estimated: true },
  { id: 'elf',    group: 'step', name: 'エルフ',           cargoLength: 4200, cargoWidth: 2050, cargoHeight: 2150 },
  { id: 'kotora', group: 'step', name: '小トラ',           cargoLength: 3000, cargoWidth: 1550, cargoHeight: 2200 },
  { id: 'bongo',  group: 'step', name: 'ボンゴ',           cargoLength: 2500, cargoWidth: 1550, cargoHeight: 1920 },

  // ---- 業者トラック（他業者・画像②反映。複数追加可・枝番付き）----
  //   ※印(2t)は「車種によって寸法が違う事があるので事前確認」→ estimated:true
  { id: 'box4t',     group: 'gaisha', external: true, name: '4t（フルワイド）', cargoLength: 6200, cargoWidth: 2350, cargoHeight: 2300 },
  { id: 'box2tbox',  group: 'gaisha', external: true, name: '2t箱車',    cargoLength: 4200, cargoWidth: 2000, cargoHeight: 2100, estimated: true },
  { id: 'box2tflat', group: 'gaisha', external: true, name: '2t平ボディ', cargoLength: 4200, cargoWidth: 2000, cargoHeight: 2200, estimated: true },
  // 10tは画像②に記載なし（LEFT-004指定のため残置・暫定）
  { id: 'box10t',    group: 'gaisha', external: true, name: '10t箱車',   cargoLength: 9500, cargoWidth: 2300, cargoHeight: 2400, estimated: true },
  { id: 'gaisha_other', group: 'gaisha', name: 'その他', placeholder: true },
];

/**
 * 商品マスター（正本: data/product-master.json — STEP Studio全体で共通利用）
 * width  : 幅(mm)    → 上面図では荷台の長さ方向(X)に描画
 * depth  : 奥行(mm)  → 上面図では荷台の幅方向(Y)に描画
 * height : 高さ(mm)  → 側面図で使用
 * color  : 描画色（カテゴリ別の識別色。アプリ描画専用でJSON側には無い）
 * price  : レンタル最低料金（税込・円）
 * glass  : ガラス什器か
 * folded : 展開⇄折りたたみ切替対応商品の折りたたみ時の実寸（例: C24C）
 * weight / stackable : 公開ページ未記載のため null（推測補完なし）
 *
 * 出典: 株式会社ステップ https://www.kk-step.jp/ （2026-07-08 取得）
 * ここはレイアウトシステムが直接使う実寸コピー。追加・修正はまず
 * data/product-master.json を直し、その後このファイルへ反映すること。
 */
const PRODUCT_MASTER = [
  // 宝飾スタンダードケース
  { code: 'C6',      name: '宝飾ケース（黒）',              category: '宝飾スタンダードケース', width: 1500, depth: 500, height: 920,  price: 16500, weight: null, stackable: true, maxStack: 2, glass: true, color: '#2563eb' },
  { code: 'C6-12',   name: '宝飾ケース（黒）',              category: '宝飾スタンダードケース', width: 1200, depth: 500, height: 920,  price: 16500, weight: null, stackable: null, maxStack: 1, glass: true, color: '#2563eb' },
  { code: 'C6-09',   name: '宝飾ケース（黒）',              category: '宝飾スタンダードケース', width: 900,  depth: 500, height: 920,  price: 15400, weight: null, stackable: null, maxStack: 1, glass: true, color: '#2563eb' },
  { code: 'C6D',     name: '宝飾ケース（大理石）',          category: '宝飾スタンダードケース', width: 1500, depth: 500, height: 920,  price: 16500, weight: null, stackable: null, maxStack: 1, glass: true, color: '#2563eb' },
  { code: 'C6D-12',  name: '宝飾ケース（大理石）',          category: '宝飾スタンダードケース', width: 1200, depth: 500, height: 920,  price: 16500, weight: null, stackable: null, maxStack: 1, glass: true, color: '#2563eb' },
  { code: 'C6D-09',  name: '宝飾ケース（大理石）',          category: '宝飾スタンダードケース', width: 900,  depth: 500, height: 920,  price: 15400, weight: null, stackable: null, maxStack: 1, glass: true, color: '#2563eb' },
  { code: 'C6GT',    name: '宝飾ケース（ゴールド）',        category: '宝飾スタンダードケース', width: 1500, depth: 550, height: 940,  price: 17600, weight: null, stackable: null, maxStack: 1, glass: true, color: '#2563eb' },
  { code: 'CC6T',    name: 'CC宝飾ケース',                  category: '宝飾スタンダードケース', width: 1500, depth: 550, height: 1000, price: 22000, weight: null, stackable: null, maxStack: 1, glass: true, color: '#2563eb' },
  { code: 'C6W',     name: '宝飾ウッドケース',              category: '宝飾スタンダードケース', width: 1500, depth: 570, height: 1000, price: 22000, weight: null, stackable: null, maxStack: 1, glass: true, color: '#2563eb' },
  { code: 'C6WB',    name: '宝飾ウッドケース(B)',           category: '宝飾スタンダードケース', width: 1500, depth: 570, height: 1000, price: 22000, weight: null, stackable: null, maxStack: 1, glass: true, color: '#2563eb' },
  // 宝飾クラッシーケース
  { code: 'CL6',     name: '宝飾クラッシーケース',          category: '宝飾クラッシーケース', width: 1600, depth: 660, height: 990,  price: 33000, weight: null, stackable: null, maxStack: 1, glass: true, color: '#7c3aed' },
  { code: 'CL8H',    name: '宝飾クラッシーミドルケース',    category: '宝飾クラッシーケース', width: 690,  depth: 690, height: 1500, price: 33000, weight: null, stackable: null, maxStack: 1, glass: true, color: '#7c3aed' },
  { code: 'CL9',     name: '宝飾クラッシーハイケース',      category: '宝飾クラッシーケース', width: 680,  depth: 680, height: 1880, price: 33000, weight: null, stackable: null, maxStack: 1, glass: true, color: '#7c3aed' },
  // 宝飾プレミアムケース
  { code: 'CLP6',    name: '宝飾プレミアムケース',          category: '宝飾プレミアムケース', width: 1500, depth: 570, height: 1000, price: 33000, weight: null, stackable: null, maxStack: 1, glass: true, color: '#4f46e5' },
  { code: 'CLP8HM',  name: '宝飾プレミアムハイミドルケース(B)', category: '宝飾プレミアムケース', width: 630, depth: 630, height: 1600, price: 33000, weight: null, stackable: null, maxStack: 1, glass: true, color: '#4f46e5' },
  // 宝飾コーナーケース
  { code: 'C7',      name: '宝飾コーナーケース（黒）',      category: '宝飾コーナーケース', width: 1446, depth: 500, height: 920,  price: 19800, weight: null, stackable: null, maxStack: 1, glass: true, color: '#0891b2' },
  { code: 'C7D',     name: '宝飾コーナーケース（大理石）',  category: '宝飾コーナーケース', width: 1446, depth: 500, height: 920,  price: 19800, weight: null, stackable: null, maxStack: 1, glass: true, color: '#0891b2' },
  { code: 'C7GT',    name: '宝飾コーナーケース（ゴールド）',category: '宝飾コーナーケース', width: 1446, depth: 566, height: 940,  price: 23100, weight: null, stackable: null, maxStack: 1, glass: true, color: '#0891b2' },
  // 宝飾角ケース
  { code: 'C8N',     name: '宝飾角ケース（黒）',            category: '宝飾角ケース', width: 550, depth: 550, height: 920,  price: 13200, weight: null, stackable: null, maxStack: 1, glass: true, color: '#16a34a' },
  { code: 'C8DN',    name: '宝飾角ケース（大理石）',        category: '宝飾角ケース', width: 550, depth: 550, height: 920,  price: 13200, weight: null, stackable: null, maxStack: 1, glass: true, color: '#16a34a' },
  { code: 'C8GTN',   name: '宝飾角ケース（ゴールド）',      category: '宝飾角ケース', width: 550, depth: 550, height: 943,  price: 16500, weight: null, stackable: null, maxStack: 1, glass: true, color: '#16a34a' },
  { code: 'CC8T',    name: 'CC宝飾角ケース',                category: '宝飾角ケース', width: 550, depth: 550, height: 998,  price: 22000, weight: null, stackable: null, maxStack: 1, glass: true, color: '#16a34a' },
  // 宝飾ミドルケース
  { code: 'C8HN',    name: '宝飾ミドルケース（黒）',        category: '宝飾ミドルケース', width: 550, depth: 550, height: 1148, price: 16500, weight: null, stackable: null, maxStack: 1, glass: true, color: '#059669' },
  { code: 'C8DHN',   name: '宝飾ミドルケース（大理石）',    category: '宝飾ミドルケース', width: 550, depth: 550, height: 1148, price: 16500, weight: null, stackable: null, maxStack: 1, glass: true, color: '#059669' },
  { code: 'C8GTHN',  name: '宝飾ミドルケース（ゴールド）',  category: '宝飾ミドルケース', width: 550, depth: 550, height: 1140, price: 17600, weight: null, stackable: null, maxStack: 1, glass: true, color: '#059669' },
  { code: 'CC8TH',   name: 'CC宝飾ミドルケース',            category: '宝飾ミドルケース', width: 550, depth: 550, height: 1195, price: 22000, weight: null, stackable: null, maxStack: 1, glass: true, color: '#059669' },
  { code: 'C8WH',    name: '宝飾ウッドミドルケース',        category: '宝飾ミドルケース', width: 590, depth: 590, height: 1205, price: 22000, weight: null, stackable: null, maxStack: 1, glass: true, color: '#059669' },
  { code: 'C8WHB',   name: '宝飾ウッドミドルケース(B)',     category: '宝飾ミドルケース', width: 590, depth: 590, height: 1205, price: 22000, weight: null, stackable: null, maxStack: 1, glass: true, color: '#059669' },
  // 宝飾ハイミドルケース
  { code: 'C8HMN',   name: '宝飾ハイミドルケース（黒）',    category: '宝飾ハイミドルケース', width: 550, depth: 550, height: 1515, price: 19800, weight: null, stackable: null, maxStack: 1, glass: true, color: '#d97706' },
  { code: 'C8DHMN',  name: '宝飾ハイミドルケース（大理石）',category: '宝飾ハイミドルケース', width: 550, depth: 550, height: 1515, price: 19800, weight: null, stackable: null, maxStack: 1, glass: true, color: '#d97706' },
  { code: 'CC8THM',  name: 'CC宝飾ハイミドルケース',        category: '宝飾ハイミドルケース', width: 550, depth: 550, height: 1549, price: 24200, weight: null, stackable: null, maxStack: 1, glass: true, color: '#d97706' },
  { code: 'C8WHM',   name: '宝飾ウッドハイミドルケース',    category: '宝飾ハイミドルケース', width: 590, depth: 590, height: 1540, price: 24200, weight: null, stackable: null, maxStack: 1, glass: true, color: '#d97706' },
  { code: 'C8WHMB',  name: '宝飾ウッドハイミドルケース(B)', category: '宝飾ハイミドルケース', width: 590, depth: 590, height: 1540, price: 24200, weight: null, stackable: null, maxStack: 1, glass: true, color: '#d97706' },
  { code: 'C8W4',    name: '宝飾四ツ脚ウッドハイミドルケース', category: '宝飾ハイミドルケース', width: 550, depth: 550, height: 1550, price: 24200, weight: null, stackable: null, maxStack: 1, glass: true, color: '#d97706' },
  // 宝飾ハイケース
  { code: 'C9',      name: '宝飾ハイケース（黒）',          category: '宝飾ハイケース', width: 600, depth: 600, height: 1908, price: 19800, weight: null, stackable: null, maxStack: 1, glass: true, color: '#dc2626' },
  { code: 'C9D',     name: '宝飾ハイケース（大理石）',      category: '宝飾ハイケース', width: 600, depth: 600, height: 1908, price: 19800, weight: null, stackable: null, maxStack: 1, glass: true, color: '#dc2626' },
  { code: 'C9GT',    name: '宝飾ハイケース（ゴールド）',    category: '宝飾ハイケース', width: 600, depth: 600, height: 1908, price: 20900, weight: null, stackable: null, maxStack: 1, glass: true, color: '#dc2626' },
  { code: 'CC9T',    name: 'CC宝飾ハイケース',              category: '宝飾ハイケース', width: 550, depth: 550, height: 1910, price: 24200, weight: null, stackable: null, maxStack: 1, glass: true, color: '#dc2626' },
  { code: 'C9W',     name: '宝飾ウッドハイケース',          category: '宝飾ハイケース', width: 590, depth: 590, height: 1935, price: 24200, weight: null, stackable: null, maxStack: 1, glass: true, color: '#dc2626' },
  { code: 'C9WB',    name: '宝飾ウッドハイケース(B)',       category: '宝飾ハイケース', width: 590, depth: 590, height: 1935, price: 24200, weight: null, stackable: null, maxStack: 1, glass: true, color: '#dc2626' },
  // 宝飾ワイドハイケース
  { code: 'C11',     name: '宝飾ワイドハイケース（黒）',    category: '宝飾ワイドハイケース', width: 1200, depth: 500, height: 1820, price: 22000, weight: null, stackable: null, maxStack: 1, glass: true, color: '#9333ea' },
  { code: 'C13',     name: '宝飾ワイドハイケース（黒）',    category: '宝飾ワイドハイケース', width: 900,  depth: 500, height: 1820, price: 22000, weight: null, stackable: null, maxStack: 1, glass: true, color: '#9333ea' },
  { code: 'C11D',    name: '宝飾ワイドハイケース（大理石）',category: '宝飾ワイドハイケース', width: 1200, depth: 500, height: 1820, price: 22000, weight: null, stackable: null, maxStack: 1, glass: true, color: '#9333ea' },
  { code: 'C13D',    name: '宝飾ワイドハイケース（大理石）',category: '宝飾ワイドハイケース', width: 900,  depth: 500, height: 1820, price: 22000, weight: null, stackable: null, maxStack: 1, glass: true, color: '#9333ea' },
  // 宝飾カウンターケース
  { code: 'C16',     name: '宝飾カウンターケース（黒）',    category: '宝飾カウンターケース', width: 1500, depth: 550, height: 790, price: 22000, weight: null, stackable: null, maxStack: 1, glass: true, color: '#ca8a04' },
  { code: 'C16D',    name: '宝飾カウンターケース（大理石）',category: '宝飾カウンターケース', width: 1500, depth: 550, height: 790, price: 22000, weight: null, stackable: null, maxStack: 1, glass: true, color: '#ca8a04' },
  { code: 'C16GT',   name: '宝飾カウンターケース（ゴールド）',category: '宝飾カウンターケース', width: 1500, depth: 550, height: 790, price: 22000, weight: null, stackable: null, maxStack: 1, glass: true, color: '#ca8a04' },
  // 宅配対応
  { code: 'T-1',     name: '宅配対応ハイミドルケース',      category: '宅配対応', width: 298, depth: 298, height: 1200, price: 13750, weight: null, stackable: null, maxStack: 1, glass: true, color: '#64748b' },
  // ガラスケース
  { code: 'C0C',     name: 'ガラスケース W900',             category: 'ガラスケース', width: 900,  depth: 500, height: 940, price: 14300, weight: null, stackable: null, maxStack: 1, glass: true, color: '#0ea5e9' },
  { code: 'C1C',     name: 'ガラスケース W1200',            category: 'ガラスケース', width: 1200, depth: 500, height: 940, price: 14300, weight: null, stackable: null, maxStack: 1, glass: true, color: '#0ea5e9' },
  { code: 'C2C',     name: 'ガラスケース W1500',            category: 'ガラスケース', width: 1500, depth: 500, height: 940, price: 14300, weight: null, stackable: null, maxStack: 1, glass: true, color: '#0ea5e9' },
  { code: 'C3C',     name: 'ガラスケース W1800',            category: 'ガラスケース', width: 1800, depth: 500, height: 940, price: 16500, weight: null, stackable: null, maxStack: 1, glass: true, color: '#0ea5e9' },
  // width/depth/height＝展開状態の実寸。folded＝折りたたみ状態の実寸（2026-07-08 確認済み）。
  // 初期値は「折りたたみ」（Sprint UI改善 ③）。
  { code: 'C24C',    name: 'ガラスケース(折りたたみ式)',    category: 'ガラスケース', width: 1500, depth: 600, height: 900, price: 11000, weight: null, stackable: null, maxStack: 1, glass: true, color: '#0ea5e9',
    folded: { width: 1500, depth: 220, height: 910 } },
  { code: 'CT1',     name: '卓上ケース',                    category: 'ガラスケース', width: 600,  depth: 310, height: 435, price: 5500,  weight: null, stackable: null, maxStack: 1, glass: true, color: '#0ea5e9' },
  // ガラスハイケース
  { code: 'C90C',    name: 'ガラスハイケース W900',         category: 'ガラスハイケース', width: 900,  depth: 500, height: 1500, price: 19800, weight: null, stackable: null, maxStack: 1, glass: true, color: '#0284c7' },
  { code: 'C10C',    name: 'ガラスハイケース W1200',        category: 'ガラスハイケース', width: 1200, depth: 500, height: 1500, price: 22000, weight: null, stackable: null, maxStack: 1, glass: true, color: '#0284c7' },
  { code: 'C12C',    name: 'ガラスハイケース W1200×H1800',  category: 'ガラスハイケース', width: 1200, depth: 500, height: 1800, price: 24200, weight: null, stackable: null, maxStack: 1, glass: true, color: '#0284c7' },
];

/** 商品マスターから1件取得 */
function getProductMaster(code) {
  return PRODUCT_MASTER.find(p => p.code === code) || null;
}

/** トラックマスターから1件取得 */
function getTruckMaster(id) {
  return TRUCK_MASTER.find(t => t.id === id) || null;
}
