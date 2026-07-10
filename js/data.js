/* =========================================================================
 * data.js — マスターデータ（トラック / 商品）※アプリ実行時に使う実体
 *
 * すべて実寸(mm)・実重(kg)で保持する。UIはこの実寸データの可視化にすぎない。
 *
 * ★正本（Source of Truth）は company/master/ 配下のJSONファイル（Architecture Ver1.0で統一）：
 *     company/master/vehicles.json  ← TRUCK_MASTER の正本
 *     company/master/products.json  ← PRODUCT_MASTER の正本（STEP Studio全体で共通利用）
 *   将来「Settings」モジュールが持つ共通マスターの土台となる想定のため、
 *   実寸の追加・修正はまず company/master/*.json 側を直し、このファイルへ反映すること。
 *   このファイルには、アプリ描画専用の追加項目（color, group, viewMode用の
 *   external/placeholder フラグ等）が乗っている点でJSONそのものとは異なる。
 *   （このファイル自体はJSONを直接fetchせず、手動転記したJS配列を保持している）
 * ======================================================================= */

/**
 * トラックマスター（正本: company/master/vehicles.json）
 * group   : 'step'（STEP車両）| 'gaisha'（業者トラック）
 * cargo*  : 荷台内寸(mm)   ← レイアウト描画・寸法表示(D/W/H)の基準
 *           D=cargoLength（長さ/奥行）, W=cargoWidth（幅）, H=cargoHeight（高さ）
 * external: 業者トラック（クリックごとに枝番付きで複数追加）
 * placeholder: 将来追加枠（選択不可）
 *
 * ※ 積載量目安・車外寸はUI表示から廃止（荷台寸法のみ表示）。
 * ※ 荷台内寸が実測で未確定のものは estimated:true を付けている。
 *    正確な値が分かり次第このファイルと company/master/vehicles.json の両方を更新すること。
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
 * 商品マスター（正本: company/master/products.json — STEP Studio全体で共通利用）
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
 * company/master/products.json を直し、その後このファイルへ反映すること。
 */
const PRODUCT_MASTER = [
  // 宝飾スタンダードケース
  { code: 'C6',      name: '宝飾ケース（黒）',              category: '宝飾スタンダードケース', width: 1500, depth: 500, height: 920,  price: 16500, weight: null, stackable: true, maxStack: 2, glass: true, color: '#2563eb' },
  { code: 'C6-12',   name: '宝飾ケース（黒）',              category: '宝飾スタンダードケース', width: 1200, depth: 500, height: 920,  price: 16500, weight: null, stackable: true, maxStack: 2, glass: true, color: '#2563eb' },
  { code: 'C6-09',   name: '宝飾ケース（黒）',              category: '宝飾スタンダードケース', width: 900,  depth: 500, height: 920,  price: 15400, weight: null, stackable: true, maxStack: 2, glass: true, color: '#2563eb' },
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
  { code: 'C2C',     name: 'ガラスケース W1500',            category: 'ガラスケース', width: 1500, depth: 500, height: 940, price: 14300, weight: null, stackable: true, maxStack: 2, glass: true, color: '#0ea5e9' },
  { code: 'C3C',     name: 'ガラスケース W1800',            category: 'ガラスケース', width: 1800, depth: 500, height: 940, price: 16500, weight: null, stackable: true, maxStack: 2, glass: true, color: '#0ea5e9' },
  // width/depth/height＝展開状態の実寸。folded＝折りたたみ状態の実寸（2026-07-08 確認済み）。
  // 初期値は「折りたたみ」（Sprint UI改善 ③）。
  { code: 'C24C',    name: 'ガラスケース(折りたたみ式)',    category: 'ガラスケース', width: 1500, depth: 600, height: 900, price: 11000, weight: null, stackable: null, maxStack: 1, glass: true, color: '#0ea5e9',
    folded: { width: 1500, depth: 220, height: 910 } },
  { code: 'CT1',     name: '卓上ケース',                    category: 'ガラスケース', width: 600,  depth: 310, height: 435, price: 5500,  weight: null, stackable: null, maxStack: 1, glass: true, color: '#0ea5e9' },
  // ガラスハイケース
  { code: 'C90C',    name: 'ガラスハイケース W900',         category: 'ガラスハイケース', width: 900,  depth: 500, height: 1500, price: 19800, weight: null, stackable: null, maxStack: 1, glass: true, color: '#0284c7' },
  { code: 'C10C',    name: 'ガラスハイケース W1200',        category: 'ガラスハイケース', width: 1200, depth: 500, height: 1500, price: 22000, weight: null, stackable: null, maxStack: 1, glass: true, color: '#0284c7' },
  { code: 'C12C',    name: 'ガラスハイケース W1200×H1800',  category: 'ガラスハイケース', width: 1200, depth: 500, height: 1800, price: 24200, weight: null, stackable: null, maxStack: 1, glass: true, color: '#0284c7' },
  // 照明機器（company/master/products.json より一括反映。price=税込目安、null=未計測）
  { code: 'ASP2', name: '絵画用展示パネル専用アームスポット', category: '照明機器', width: null, depth: null, height: 270, price: 2200, weight: null, stackable: null, maxStack: 1, color: '#facc15' },
  { code: 'ASP3', name: 'パネル用アームスポット', category: '照明機器', width: null, depth: null, height: 270, price: 1650, weight: null, stackable: null, maxStack: 1, color: '#facc15' },
  { code: 'SP1R', name: 'スタンドスポット', category: '照明機器', width: null, depth: null, height: null, price: 6600, weight: null, stackable: null, maxStack: 1, color: '#facc15' },
  { code: 'SP5', name: 'スタンドスポット(5灯付)', category: '照明機器', width: null, depth: null, height: null, price: 7700, weight: null, stackable: null, maxStack: 1, color: '#facc15' },
  { code: 'SP6', name: 'スタンドスポット(2灯付)', category: '照明機器', width: null, depth: null, height: null, price: 6600, weight: null, stackable: null, maxStack: 1, color: '#facc15' },
  { code: 'TASP', name: 'TAスタンドスポット', category: '照明機器', width: null, depth: null, height: null, price: 8800, weight: null, stackable: null, maxStack: 1, color: '#facc15' },
  { code: 'TSPA', name: 'コンパクト卓上スポット', category: '照明機器', width: null, depth: null, height: 270, price: 1650, weight: null, stackable: null, maxStack: 1, color: '#facc15' },
  { code: 'TSPC', name: '卓上スポット(アダプター式)', category: '照明機器', width: null, depth: null, height: null, price: 1650, weight: null, stackable: null, maxStack: 1, color: '#facc15' },
  { code: 'TSPL', name: '卓上スポット(バッテリー式)', category: '照明機器', width: null, depth: null, height: null, price: 1650, weight: null, stackable: null, maxStack: 1, color: '#facc15' },
  { code: 'TSPW', name: 'コンセント型卓上スポット', category: '照明機器', width: 100, depth: 161, height: null, price: 1650, weight: null, stackable: null, maxStack: 1, color: '#facc15' },
  // パネル（company/master/products.json より一括反映。price=税込目安、null=未計測）
  { code: 'BSシリーズ', name: 'ベルトパーテーション', category: 'パネル', width: null, depth: null, height: null, price: 3300, weight: null, stackable: null, maxStack: 1, color: '#0d9488' },
  { code: 'CHS-tk', name: 'チェーン・ロープスタンド', category: 'パネル', width: null, depth: null, height: 900, price: 2420, weight: null, stackable: null, maxStack: 1, color: '#0d9488' },
  { code: 'CU-01B', name: '間仕切りカーテン', category: 'パネル', width: 1524, depth: null, height: 3048, price: 2200, weight: null, stackable: null, maxStack: 1, color: '#0d9488' },
  { code: 'PA-D2400', name: '暗室(鑑定用)', category: 'パネル', width: 1200, depth: 900, height: 2400, price: 22000, weight: null, stackable: null, maxStack: 1, color: '#0d9488' },
  { code: 'PAC', name: '展示用パネル(クロスパネル)', category: 'パネル', width: 900, depth: 35, height: 2100, price: 3300, weight: null, stackable: null, maxStack: 1, color: '#0d9488' },
  { code: 'PACU-BR', name: 'パネルカーテン(ブラウン)', category: 'パネル', width: 900, depth: null, height: 2000, price: 3300, weight: null, stackable: null, maxStack: 1, color: '#0d9488' },
  { code: 'PAEZ', name: 'システムパネル(白)', category: 'パネル', width: 900, depth: 35, height: 2100, price: 3300, weight: null, stackable: null, maxStack: 1, color: '#0d9488' },
  { code: 'PAEZ-B', name: 'システムパネル(黒)', category: 'パネル', width: 900, depth: 35, height: 2100, price: 4400, weight: null, stackable: null, maxStack: 1, color: '#0d9488' },
  { code: 'PAEZ-DR', name: 'システムパネル(ドア付き)', category: 'パネル', width: 900, depth: null, height: 2100, price: 5500, weight: null, stackable: null, maxStack: 1, color: '#0d9488' },
  { code: 'PAL-L', name: 'ウッドパーテーションパネル', category: 'パネル', width: 900, depth: 35, height: 1570, price: 3850, weight: null, stackable: null, maxStack: 1, color: '#0d9488' },
  { code: 'PALB-L', name: 'パーテーションパネル', category: 'パネル', width: 900, depth: 35, height: 1570, price: 3850, weight: null, stackable: null, maxStack: 1, color: '#0d9488' },
  { code: 'PAP21W', name: '絵画用展示パネル(白)', category: 'パネル', width: 900, depth: 35, height: 2100, price: 7700, weight: null, stackable: null, maxStack: 1, color: '#0d9488' },
  { code: 'PAW', name: 'ウッドパネル', category: 'パネル', width: 900, depth: 35, height: 2100, price: 4950, weight: null, stackable: null, maxStack: 1, color: '#0d9488' },
  { code: 'PAW-C', name: 'ウッドパネルコーナー(C300)', category: 'パネル', width: 300, depth: 300, height: 2100, price: 4950, weight: null, stackable: null, maxStack: 1, color: '#0d9488' },
  { code: 'PAW-W', name: '窓付きウッドパネル', category: 'パネル', width: 900, depth: 335, height: 2100, price: null, weight: null, stackable: null, maxStack: 1, color: '#0d9488' },
  { code: 'PAWB', name: '展示会パネル', category: 'パネル', width: 900, depth: 350, height: 2100, price: 5500, weight: null, stackable: null, maxStack: 1, color: '#0d9488' },
  { code: 'PAWB-C-300', name: 'コーナーパネル(300)', category: 'パネル', width: 300, depth: 300, height: 2100, price: 4950, weight: null, stackable: null, maxStack: 1, color: '#0d9488' },
  { code: 'PAWB-M', name: 'ミラーパネル', category: 'パネル', width: 900, depth: null, height: 2100, price: 12100, weight: null, stackable: null, maxStack: 1, color: '#0d9488' },
  { code: 'PAWB-W', name: '窓付き展示パネル(観音開き)', category: 'パネル', width: 900, depth: 335, height: 2100, price: 19800, weight: null, stackable: null, maxStack: 1, color: '#0d9488' },
  { code: 'PAWB-WII', name: '窓付き展示パネル(W900)', category: 'パネル', width: 900, depth: 400, height: 2100, price: 19800, weight: null, stackable: null, maxStack: 1, color: '#0d9488' },
  { code: 'PAWB-WIII', name: '窓付き展示パネル(W600)', category: 'パネル', width: 600, depth: 400, height: 2100, price: 19800, weight: null, stackable: null, maxStack: 1, color: '#0d9488' },
  { code: 'PAWB-WS', name: 'サインパネル', category: 'パネル', width: 900, depth: 350, height: 2100, price: 19800, weight: null, stackable: null, maxStack: 1, color: '#0d9488' },
  { code: 'PAWB-WSH', name: 'サインパネル大', category: 'パネル', width: 900, depth: 350, height: 2100, price: 33000, weight: null, stackable: null, maxStack: 1, color: '#0d9488' },
  { code: 'PAWR', name: '展示用パネルR(リバーシブル)', category: 'パネル', width: 900, depth: 35, height: 2100, price: 4950, weight: null, stackable: null, maxStack: 1, color: '#0d9488' },
  { code: 'PAtf-tk', name: '三折れパネル', category: 'パネル', width: 900, depth: null, height: 1800, price: 5500, weight: null, stackable: null, maxStack: 1, color: '#0d9488' },
  { code: 'YKP-TK', name: '有孔パネル', category: 'パネル', width: 900, depth: null, height: 1800, price: 3300, weight: null, stackable: null, maxStack: 1, color: '#0d9488' },
  // パネル・仕切り（company/master/products.json より一括反映。price=税込目安、null=未計測）
  { code: 'BS', name: 'ベルトパーテーション（イメージサイズ）', category: 'パネル・仕切り', width: 300, depth: 300, height: 900, price: 3630, weight: null, stackable: null, maxStack: 1, color: '#2dd4bf' },
  { code: 'ML', name: 'ミラーパネルライト（イメージサイズ）', category: 'パネル・仕切り', width: 100, depth: 100, height: 300, price: null, weight: null, stackable: null, maxStack: 1, color: '#2dd4bf' },
  { code: 'PAEZ-2100', name: 'システムパネル（白）H2100', category: 'パネル・仕切り', width: 900, depth: 35, height: 2100, price: 3630, weight: null, stackable: null, maxStack: 1, color: '#2dd4bf' },
  { code: 'PAEZ-2400', name: 'システムパネル（白）H2400', category: 'パネル・仕切り', width: 900, depth: 35, height: 2400, price: 3630, weight: null, stackable: null, maxStack: 1, color: '#2dd4bf' },
  { code: 'PAEZ-B-2100', name: 'システムパネル（黒）H2100', category: 'パネル・仕切り', width: 900, depth: 35, height: 2100, price: 4840, weight: null, stackable: null, maxStack: 1, color: '#2dd4bf' },
  { code: 'PAEZ-B-2400', name: 'システムパネル（黒）H2400', category: 'パネル・仕切り', width: 900, depth: 35, height: 2400, price: 4840, weight: null, stackable: null, maxStack: 1, color: '#2dd4bf' },
  { code: 'PAP24B', name: '絵画展示パネル（黒）H2400', category: 'パネル・仕切り', width: 900, depth: 35, height: 2400, price: 8470, weight: null, stackable: null, maxStack: 1, color: '#2dd4bf' },
  { code: 'PAP24B3', name: '絵画展示パネル（黒）W300', category: 'パネル・仕切り', width: 300, depth: 35, height: 2400, price: 8470, weight: null, stackable: null, maxStack: 1, color: '#2dd4bf' },
  { code: 'PAP24W', name: '絵画展示パネル（白）H2400', category: 'パネル・仕切り', width: 900, depth: 35, height: 2400, price: 8470, weight: null, stackable: null, maxStack: 1, color: '#2dd4bf' },
  { code: 'PAW-C-300', name: '木製コーナーパネル（W300）', category: 'パネル・仕切り', width: 300, depth: 300, height: 2100, price: 5445, weight: null, stackable: null, maxStack: 1, color: '#2dd4bf' },
  { code: 'PAW-C-450', name: '木製コーナーパネル（W450）', category: 'パネル・仕切り', width: 450, depth: 450, height: 2100, price: 5445, weight: null, stackable: null, maxStack: 1, color: '#2dd4bf' },
  { code: 'PAWB-C-450', name: 'コーナーパネル（W450）', category: 'パネル・仕切り', width: 450, depth: 450, height: 2100, price: 5445, weight: null, stackable: null, maxStack: 1, color: '#2dd4bf' },
  { code: 'PAWB-W2', name: '窓用パネル（W900）', category: 'パネル・仕切り', width: 900, depth: 400, height: 2100, price: 21780, weight: null, stackable: null, maxStack: 1, color: '#2dd4bf' },
  { code: 'PAWB-W3', name: '窓用パネル（W600）', category: 'パネル・仕切り', width: 600, depth: 400, height: 2100, price: 21780, weight: null, stackable: null, maxStack: 1, color: '#2dd4bf' },
  { code: 'PAtf-tk-600', name: '三つ折りパネル（W600）', category: 'パネル・仕切り', width: 600, depth: 35, height: 1800, price: 6050, weight: null, stackable: null, maxStack: 1, color: '#2dd4bf' },
  { code: 'PAtf-tk-900', name: '三つ折りパネル（W900）', category: 'パネル・仕切り', width: 900, depth: 35, height: 1800, price: 6050, weight: null, stackable: null, maxStack: 1, color: '#2dd4bf' },
  // 鏡(ミラー)（company/master/products.json より一括反映。price=税込目安、null=未計測）
  { code: 'M2', name: 'スタンドミラー', category: '鏡(ミラー)', width: 510, depth: 450, height: 1535, price: 1650, weight: null, stackable: null, maxStack: 1, color: '#ec4899' },
  { code: 'M2-tk', name: '角型卓上ミラー', category: '鏡(ミラー)', width: 345, depth: 200, height: 430, price: null, weight: null, stackable: null, maxStack: 1, color: '#ec4899' },
  { code: 'M2L', name: '女優スタンドミラー', category: '鏡(ミラー)', width: 470, depth: null, height: 1520, price: 6600, weight: null, stackable: null, maxStack: 1, color: '#ec4899' },
  { code: 'M3GB', name: '卓上ミラー', category: '鏡(ミラー)', width: null, depth: null, height: null, price: 1650, weight: null, stackable: null, maxStack: 1, color: '#ec4899' },
  { code: 'NGANT021', name: '姿見 ゴールド', category: '鏡(ミラー)', width: 460, depth: 450, height: 1700, price: 3300, weight: null, stackable: null, maxStack: 1, color: '#ec4899' },
  { code: 'NGANT025', name: '姿見(古美色)', category: '鏡(ミラー)', width: 450, depth: null, height: 1540, price: 3300, weight: null, stackable: null, maxStack: 1, color: '#ec4899' },
  { code: 'NGANT029', name: 'デコレーションミラー・フローラル', category: '鏡(ミラー)', width: null, depth: null, height: null, price: 2750, weight: null, stackable: null, maxStack: 1, color: '#ec4899' },
  { code: 'NGANT031', name: 'アンティークミラー・シルバー', category: '鏡(ミラー)', width: null, depth: null, height: null, price: 1650, weight: null, stackable: null, maxStack: 1, color: '#ec4899' },
  // テーブル（company/master/products.json より一括反映。price=税込目安、null=未計測）
  { code: 'RT75', name: '丸テーブル(φ750)', category: 'テーブル', width: 750, depth: 750, height: 700, price: 2200, weight: null, stackable: null, maxStack: 1, color: '#ea580c' },
  { code: 'TBS-15tk', name: '折りたたみスタックテーブル', category: 'テーブル', width: 1500, depth: 600, height: 900, price: 6490, weight: null, stackable: null, maxStack: 1, color: '#ea580c' },
  { code: 'TBW18-45', name: 'ホワイトテーブル', category: 'テーブル', width: 1800, depth: 450, height: 700, price: 1650, weight: null, stackable: null, maxStack: 1, color: '#ea580c' },
  { code: 'TCG-GD-15', name: '柄付き角テーブルクロス', category: 'テーブル', width: null, depth: null, height: null, price: 3080, weight: null, stackable: null, maxStack: 1, color: '#ea580c' },
  { code: 'TCP-GD-23', name: '柄付き円卓テーブルクロス', category: 'テーブル', width: null, depth: null, height: null, price: 3080, weight: null, stackable: null, maxStack: 1, color: '#ea580c' },
  { code: 'TKB', name: '柄付きテーブルクロス', category: 'テーブル', width: null, depth: null, height: null, price: 2530, weight: null, stackable: null, maxStack: 1, color: '#ea580c' },
  { code: 'TKC', name: '茶色テーブルクロス', category: 'テーブル', width: 3100, depth: 1750, height: null, price: 2200, weight: null, stackable: null, maxStack: 1, color: '#ea580c' },
  { code: 'TKK', name: '展示用黒テーブルクロス', category: 'テーブル', width: null, depth: null, height: null, price: 2530, weight: null, stackable: null, maxStack: 1, color: '#ea580c' },
  { code: 'TT-301-TO', name: '商談用角テーブル', category: 'テーブル', width: 750, depth: 450, height: 700, price: 3300, weight: null, stackable: null, maxStack: 1, color: '#ea580c' },
  { code: 'TT-302-TO', name: '商談用角テーブル(S/M/L)', category: 'テーブル', width: 450, depth: 450, height: 700, price: 4400, weight: null, stackable: null, maxStack: 1, color: '#ea580c' },
  { code: 'TT-308-TO', name: '商談テーブル', category: 'テーブル', width: 1200, depth: 750, height: 700, price: 7150, weight: null, stackable: null, maxStack: 1, color: '#ea580c' },
  { code: 'TT-311-TO', name: '座卓テーブル', category: 'テーブル', width: 1800, depth: 600, height: 340, price: 3850, weight: null, stackable: null, maxStack: 1, color: '#ea580c' },
  { code: 'TT-327-TO', name: '丸ハイテーブルΦ600(白)', category: 'テーブル', width: 600, depth: 600, height: 1000, price: 7700, weight: null, stackable: null, maxStack: 1, color: '#ea580c' },
  { code: 'TT-328-TO', name: '丸ハイテーブルΦ600(黒)', category: 'テーブル', width: 600, depth: 600, height: 1000, price: 7700, weight: null, stackable: null, maxStack: 1, color: '#ea580c' },
  { code: 'TT-329-TO', name: '丸ハイテーブルΦ600(木製)', category: 'テーブル', width: 600, depth: 600, height: 1000, price: 8800, weight: null, stackable: null, maxStack: 1, color: '#ea580c' },
  { code: 'TT-330-TO', name: 'ハイカウンターテーブル(半円)W1200', category: 'テーブル', width: 1200, depth: 600, height: 1000, price: 9900, weight: null, stackable: null, maxStack: 1, color: '#ea580c' },
  { code: 'TT-331-TO', name: 'ハイカウンターテーブル(白)W1200', category: 'テーブル', width: 1200, depth: 500, height: 1000, price: 11000, weight: null, stackable: null, maxStack: 1, color: '#ea580c' },
  { code: 'TT-332-TO', name: 'ハイカウンターテーブル(黒)', category: 'テーブル', width: 1800, depth: 500, height: 1000, price: 26400, weight: null, stackable: null, maxStack: 1, color: '#ea580c' },
  // イス（company/master/products.json より一括反映。price=税込目安、null=未計測）
  { code: 'CH7', name: 'スタッキングチェア', category: 'イス', width: 490, depth: 540, height: 750, price: 880, weight: null, stackable: null, maxStack: 1, color: '#fb923c' },
  { code: 'CH8-tk', name: 'パイプ椅子', category: 'イス', width: 448, depth: 465, height: 735, price: 550, weight: null, stackable: null, maxStack: 1, color: '#fb923c' },
  { code: 'CHB', name: '黒接客椅子', category: 'イス', width: 490, depth: 540, height: 750, price: 2750, weight: null, stackable: null, maxStack: 1, color: '#fb923c' },
  { code: 'CHH-Btk', name: 'ハイチェアー', category: 'イス', width: 410, depth: 410, height: 830, price: 2640, weight: null, stackable: null, maxStack: 1, color: '#fb923c' },
  { code: 'SFB-Btk', name: 'ベンチソファー', category: 'イス', width: 1670, depth: 560, height: 370, price: 2750, weight: null, stackable: null, maxStack: 1, color: '#fb923c' },
  { code: 'TC-101-TO', name: 'カフェチェア白', category: 'イス', width: 500, depth: 530, height: 770, price: 4950, weight: null, stackable: null, maxStack: 1, color: '#fb923c' },
  { code: 'TC-105-TO', name: '木製チェア', category: 'イス', width: 380, depth: 430, height: 760, price: 4950, weight: null, stackable: null, maxStack: 1, color: '#fb923c' },
  { code: 'TC-106-TO', name: 'アンティーク風チェア', category: 'イス', width: 440, depth: 520, height: 900, price: 11000, weight: null, stackable: null, maxStack: 1, color: '#fb923c' },
  { code: 'TC-107-TO', name: 'ベーシックチェア', category: 'イス', width: 420, depth: 480, height: 790, price: 6050, weight: null, stackable: null, maxStack: 1, color: '#fb923c' },
  { code: 'TC-108-TO', name: 'ラウンジチェア', category: 'イス', width: 450, depth: 560, height: 700, price: 3300, weight: null, stackable: null, maxStack: 1, color: '#fb923c' },
  { code: 'TC-111-TO', name: 'ヴィンテージチェア', category: 'イス', width: 400, depth: 540, height: 920, price: 8800, weight: null, stackable: null, maxStack: 1, color: '#fb923c' },
  { code: 'TC-112-TO', name: '宴会椅子', category: 'イス', width: 460, depth: 540, height: 830, price: 3300, weight: null, stackable: null, maxStack: 1, color: '#fb923c' },
  { code: 'TC-113-TO', name: 'オフィスチェア', category: 'イス', width: 470, depth: 500, height: 770, price: 6050, weight: null, stackable: null, maxStack: 1, color: '#fb923c' },
  { code: 'TC-114-TO', name: '会議椅子', category: 'イス', width: 491, depth: 510, height: 762, price: 3850, weight: null, stackable: null, maxStack: 1, color: '#fb923c' },
  { code: 'TC-116-TO', name: '丸椅子', category: 'イス', width: 320, depth: 320, height: null, price: 880, weight: null, stackable: null, maxStack: 1, color: '#fb923c' },
  { code: 'TC-119-TO', name: 'メモ台付チェア', category: 'イス', width: 480, depth: 720, height: 750, price: 3300, weight: null, stackable: null, maxStack: 1, color: '#fb923c' },
  { code: 'TC-120-TO', name: '折たたみイス', category: 'イス', width: 450, depth: 460, height: 750, price: 660, weight: null, stackable: null, maxStack: 1, color: '#fb923c' },
  { code: 'TC-123-TO', name: '長椅子', category: 'イス', width: 1500, depth: 450, height: null, price: 5500, weight: null, stackable: null, maxStack: 1, color: '#fb923c' },
  { code: 'TC-124-TO', name: '木製ハイチェア', category: 'イス', width: 410, depth: 430, height: 970, price: 7150, weight: null, stackable: null, maxStack: 1, color: '#fb923c' },
  { code: 'TC-125-TO', name: 'シンプルハイチェア', category: 'イス', width: 380, depth: 410, height: 1040, price: 6050, weight: null, stackable: null, maxStack: 1, color: '#fb923c' },
  { code: 'TC-126-TO', name: 'ハイチェアブラック', category: 'イス', width: 500, depth: 530, height: 900, price: 6050, weight: null, stackable: null, maxStack: 1, color: '#fb923c' },
  // 展示台（company/master/products.json より一括反映。price=税込目安、null=未計測）
  { code: 'CLW', name: '宝飾クラッシーオープン台', category: '展示台', width: 1500, depth: 775, height: 855, price: 27500, weight: null, stackable: null, maxStack: 1, color: '#65a30d' },
  { code: 'DSH-09tk', name: 'オクタナ', category: '展示台', width: 900, depth: 300, height: 340, price: null, weight: null, stackable: null, maxStack: 1, color: '#65a30d' },
  { code: 'DST-88tk', name: 'オリウス', category: '展示台', width: 880, depth: 585, height: 35, price: null, weight: null, stackable: null, maxStack: 1, color: '#65a30d' },
  { code: 'NG001', name: '円柱ステージΦ450(H600)', category: '展示台', width: 450, depth: 450, height: 600, price: 7700, weight: null, stackable: null, maxStack: 1, color: '#65a30d' },
  { code: 'NG006', name: '角ステージ白350(H600)', category: '展示台', width: 350, depth: 350, height: 600, price: 5500, weight: null, stackable: null, maxStack: 1, color: '#65a30d' },
  { code: 'NG007', name: '角ステージ黒350(H600)', category: '展示台', width: 350, depth: 350, height: 600, price: 6600, weight: null, stackable: null, maxStack: 1, color: '#65a30d' },
  { code: 'NG012', name: 'ディスプレイステージ白W1200', category: '展示台', width: 1200, depth: 600, height: 900, price: 15400, weight: null, stackable: null, maxStack: 1, color: '#65a30d' },
  { code: 'NG013', name: 'ディスプレイステージ黒W1200', category: '展示台', width: 1200, depth: 600, height: 900, price: 15400, weight: null, stackable: null, maxStack: 1, color: '#65a30d' },
  { code: 'NGTAB033', name: 'ディスプレイテーブル大(H150)', category: '展示台', width: 1500, depth: 750, height: 150, price: 4400, weight: null, stackable: null, maxStack: 1, color: '#65a30d' },
  { code: 'NGTAB038', name: 'ディスプレイテーブル中(H150)', category: '展示台', width: 1200, depth: 600, height: 150, price: 3300, weight: null, stackable: null, maxStack: 1, color: '#65a30d' },
  { code: 'NGTAB043', name: 'ディスプレイテーブルW1200×D600中(木目)(H150)', category: '展示台', width: 1200, depth: 600, height: 150, price: 3850, weight: null, stackable: null, maxStack: 1, color: '#65a30d' },
  { code: 'NGTAB048', name: 'ディスプレイテーブル小(H150)', category: '展示台', width: 900, depth: 600, height: 150, price: 2200, weight: null, stackable: null, maxStack: 1, color: '#65a30d' },
  { code: 'NGTAB053', name: 'ディスプレイテーブル900角(木目)(H150)', category: '展示台', width: 900, depth: 900, height: 150, price: 2530, weight: null, stackable: null, maxStack: 1, color: '#65a30d' },
  { code: 'NGTAB058', name: 'ディスプレイテーブル900×600(H150)', category: '展示台', width: 900, depth: 600, height: 150, price: 1650, weight: null, stackable: null, maxStack: 1, color: '#65a30d' },
  { code: 'NGTAB066', name: 'テーブルステージ白900×450(H150)', category: '展示台', width: 900, depth: 450, height: 150, price: 1320, weight: null, stackable: null, maxStack: 1, color: '#65a30d' },
  { code: 'NGTAB070', name: 'テーブルステージ白900角(H150)', category: '展示台', width: 900, depth: 900, height: 150, price: 1980, weight: null, stackable: null, maxStack: 1, color: '#65a30d' },
  { code: 'ST-09tk', name: 'ステージ', category: '展示台', width: 900, depth: 900, height: 100, price: null, weight: null, stackable: null, maxStack: 1, color: '#65a30d' },
  { code: 'TB', name: 'コンパクト置き台', category: '展示台', width: 400, depth: 400, height: 808, price: 5500, weight: null, stackable: null, maxStack: 1, color: '#65a30d' },
  { code: 'TB2', name: '展示台A', category: '展示台', width: 500, depth: 500, height: 900, price: 4400, weight: null, stackable: null, maxStack: 1, color: '#65a30d' },
  { code: 'TB3', name: '展示台(白)', category: '展示台', width: 500, depth: 500, height: 900, price: 5500, weight: null, stackable: null, maxStack: 1, color: '#65a30d' },
  { code: 'TB4-09', name: 'コの字展示台(900)(黒)', category: '展示台', width: 900, depth: 500, height: 700, price: 11000, weight: null, stackable: null, maxStack: 1, color: '#65a30d' },
  { code: 'TB4-12', name: 'コの字展示台(1200)(黒)', category: '展示台', width: 1200, depth: 500, height: 700, price: 11000, weight: null, stackable: null, maxStack: 1, color: '#65a30d' },
  { code: 'W10', name: '宝飾オープン台(グレー石目調)', category: '展示台', width: 1500, depth: 775, height: 855, price: 9900, weight: null, stackable: null, maxStack: 1, color: '#65a30d' },
  { code: 'W15', name: '宝飾ウッドオープン台', category: '展示台', width: 1500, depth: 750, height: 850, price: 11000, weight: null, stackable: null, maxStack: 1, color: '#65a30d' },
  { code: 'W9', name: '宝飾ウッドスクエアオープン台', category: '展示台', width: 590, depth: 590, height: 1057, price: 11000, weight: null, stackable: null, maxStack: 1, color: '#65a30d' },
  { code: 'w20', name: 'ヴィンテージテーブル', category: '展示台', width: 1200, depth: 730, height: 770, price: 4950, weight: null, stackable: null, maxStack: 1, color: '#65a30d' },
  // ハンガーラック（company/master/products.json より一括反映。price=税込目安、null=未計測）
  { code: 'H1', name: 'シングルハンガー', category: 'ハンガーラック', width: 900, depth: null, height: 1000, price: 2200, weight: null, stackable: null, maxStack: 1, color: '#c026d3' },
  { code: 'H12H', name: '2段式ハンガー', category: 'ハンガーラック', width: 1200, depth: null, height: 1580, price: 2200, weight: null, stackable: null, maxStack: 1, color: '#c026d3' },
  { code: 'H14-tk', name: '真鍮ラック', category: 'ハンガーラック', width: 1400, depth: 450, height: 1310, price: 6380, weight: null, stackable: null, maxStack: 1, color: '#c026d3' },
  { code: 'H15-tk', name: 'エルボーラック', category: 'ハンガーラック', width: 1500, depth: 450, height: 1280, price: 4620, weight: null, stackable: null, maxStack: 1, color: '#c026d3' },
  { code: 'HCI-75tk', name: 'サークルハンガー', category: 'ハンガーラック', width: 750, depth: 750, height: 1050, price: 2530, weight: null, stackable: null, maxStack: 1, color: '#c026d3' },
  { code: 'HSQ-12Btk', name: 'スクウェアハンガーラック', category: 'ハンガーラック', width: 750, depth: 750, height: 1050, price: 3850, weight: null, stackable: null, maxStack: 1, color: '#c026d3' },
  { code: 'NGHAN001', name: 'デザインラック(flec)', category: 'ハンガーラック', width: 1150, depth: 475, height: 1722, price: 4400, weight: null, stackable: null, maxStack: 1, color: '#c026d3' },
  { code: 'NGHAN003', name: 'デザインラック(スチールブラック)', category: 'ハンガーラック', width: 1000, depth: 520, height: 1510, price: 4400, weight: null, stackable: null, maxStack: 1, color: '#c026d3' },
  { code: 'NGHAN004', name: '木製ハンガーラック', category: 'ハンガーラック', width: 990, depth: 555, height: 1475, price: 2200, weight: null, stackable: null, maxStack: 1, color: '#c026d3' },
  { code: 'NGHAN006', name: '木製コート・帽子掛け', category: 'ハンガーラック', width: 320, depth: 260, height: 1920, price: 4950, weight: null, stackable: null, maxStack: 1, color: '#c026d3' },
  { code: 'NGHAN007', name: 'デザインラック(黒皮風)', category: 'ハンガーラック', width: 1200, depth: 450, height: 1600, price: 4400, weight: null, stackable: null, maxStack: 1, color: '#c026d3' },
  { code: 'NGHAN008', name: 'デザインZラック(スチール)', category: 'ハンガーラック', width: 1200, depth: 450, height: 1600, price: 4400, weight: null, stackable: null, maxStack: 1, color: '#c026d3' },
  { code: 'NGHAN009', name: 'デザインラック(ホワイト)', category: 'ハンガーラック', width: 1200, depth: 450, height: 1700, price: 4400, weight: null, stackable: null, maxStack: 1, color: '#c026d3' },
  { code: 'NGHAN011', name: 'スチールラック', category: 'ハンガーラック', width: 1200, depth: 420, height: 1560, price: 3850, weight: null, stackable: null, maxStack: 1, color: '#c026d3' },
  { code: 'NGHAN013', name: '水道管ラック', category: 'ハンガーラック', width: 1230, depth: 510, height: 1630, price: 4400, weight: null, stackable: null, maxStack: 1, color: '#c026d3' },
  { code: 'NGHAN014', name: 'アンティークラック', category: 'ハンガーラック', width: 1300, depth: 500, height: 1500, price: 5500, weight: null, stackable: null, maxStack: 1, color: '#c026d3' },
  { code: 'NGHAN015', name: 'アンティーク傾斜ハンガー', category: 'ハンガーラック', width: 365, depth: 500, height: 1400, price: 3850, weight: null, stackable: null, maxStack: 1, color: '#c026d3' },
  { code: 'NGHAN016', name: 'アイアンラック(ダークゴールド)', category: 'ハンガーラック', width: 710, depth: 400, height: 1380, price: 2200, weight: null, stackable: null, maxStack: 1, color: '#c026d3' },
  { code: 'NGHAN017', name: 'デコハンガーラック:ブラウン', category: 'ハンガーラック', width: 710, depth: 400, height: 1380, price: 3850, weight: null, stackable: null, maxStack: 1, color: '#c026d3' },
  { code: 'NGHAN019', name: 'ハンガーラック(古美色)90cm', category: 'ハンガーラック', width: 900, depth: 400, height: 1150, price: 3850, weight: null, stackable: null, maxStack: 1, color: '#c026d3' },
  { code: 'NGHAN021', name: '古美色傾斜ハンガー', category: 'ハンガーラック', width: 350, depth: 336, height: 1086, price: 3300, weight: null, stackable: null, maxStack: 1, color: '#c026d3' },
  { code: 'NGHAN022', name: 'ハンガーラック1200', category: 'ハンガーラック', width: 1200, depth: 455, height: 1190, price: 2200, weight: null, stackable: null, maxStack: 1, color: '#c026d3' },
  { code: 'NGHAN024', name: 'ハンガーラック600', category: 'ハンガーラック', width: 600, depth: null, height: 900, price: 1100, weight: null, stackable: null, maxStack: 1, color: '#c026d3' },
  { code: 'NGHAN025', name: 'スーツ・ドレスラック1200', category: 'ハンガーラック', width: 1200, depth: null, height: null, price: 1650, weight: null, stackable: null, maxStack: 1, color: '#c026d3' },
  { code: 'NGHAN027', name: '生地掛け', category: 'ハンガーラック', width: 1200, depth: 450, height: 1500, price: 5280, weight: null, stackable: null, maxStack: 1, color: '#c026d3' },
  { code: 'NGHAN031', name: '傾斜ハンガー', category: 'ハンガーラック', width: null, depth: null, height: 900, price: 880, weight: null, stackable: null, maxStack: 1, color: '#c026d3' },
  { code: 'NGHAN045', name: '2WAYハンガー', category: 'ハンガーラック', width: 540, depth: null, height: 1000, price: 1320, weight: null, stackable: null, maxStack: 1, color: '#c026d3' },
  { code: 'NGHAN046', name: '回転フック什器', category: 'ハンガーラック', width: null, depth: null, height: 165, price: 3300, weight: null, stackable: null, maxStack: 1, color: '#c026d3' },
  // ハンガー（company/master/products.json より一括反映。price=税込目安、null=未計測）
  { code: 'HTO-tk', name: 'トンボハンガー', category: 'ハンガー', width: 750, depth: 750, height: 1050, price: 1100, weight: null, stackable: null, maxStack: 1, color: '#e879f9' },
  { code: 'NGHAN032-1', name: 'スチールハンガー:レディース38cm', category: 'ハンガー', width: 380, depth: null, height: null, price: 220, weight: null, stackable: null, maxStack: 1, color: '#e879f9' },
  { code: 'NGHAN033', name: 'スチールパンツハンガー', category: 'ハンガー', width: 250, depth: null, height: null, price: 220, weight: null, stackable: null, maxStack: 1, color: '#e879f9' },
  { code: 'NGHAN034-1', name: 'ウッドハンガー(ブラウン):レディース38cm', category: 'ハンガー', width: 380, depth: null, height: null, price: 330, weight: null, stackable: null, maxStack: 1, color: '#e879f9' },
  { code: 'NGHAN035', name: 'ウッドパンツハンガー(ブラウン)', category: 'ハンガー', width: 300, depth: null, height: null, price: 330, weight: null, stackable: null, maxStack: 1, color: '#e879f9' },
  { code: 'NGHAN038', name: 'バッグ掛け(古美色)', category: 'ハンガー', width: null, depth: null, height: null, price: 880, weight: null, stackable: null, maxStack: 1, color: '#e879f9' },
  { code: 'NGHAN039', name: '帽子掛け(古美色)', category: 'ハンガー', width: 150, depth: 150, height: null, price: 880, weight: null, stackable: null, maxStack: 1, color: '#e879f9' },
  // フィッティングルーム（company/master/products.json より一括反映。price=税込目安、null=未計測）
  { code: 'M1', name: 'フィッティングルーム', category: 'フィッティングルーム', width: 800, depth: 850, height: 1950, price: 5500, weight: null, stackable: null, maxStack: 1, color: '#e11d48' },
  { code: 'M1B-tk', name: 'BOX型フィッティングルーム', category: 'フィッティングルーム', width: 850, depth: 900, height: 1930, price: 8250, weight: null, stackable: null, maxStack: 1, color: '#e11d48' },
  // 接客カウンター(アパレル)（company/master/products.json より一括反映。price=税込目安、null=未計測）
  { code: 'SC-09tk', name: 'カウンター台', category: '接客カウンター(アパレル)', width: 900, depth: 600, height: 900, price: 5940, weight: null, stackable: null, maxStack: 1, color: '#fb7185' },
  // アンティーク・ヴィンテージ（company/master/products.json より一括反映。price=税込目安、null=未計測）
  { code: 'NGANT001', name: 'ヴィンテージキャビネット', category: 'アンティーク・ヴィンテージ', width: 885, depth: 390, height: null, price: 33000, weight: null, stackable: null, maxStack: 1, glass: true, color: '#78716c' },
  { code: 'NGANT002', name: 'ヴィンテージガラスケース', category: 'アンティーク・ヴィンテージ', width: 1220, depth: 305, height: 1285, price: 30800, weight: null, stackable: null, maxStack: 1, glass: true, color: '#78716c' },
  { code: 'NGANT003', name: 'ヴィンテージドレッサー', category: 'アンティーク・ヴィンテージ', width: 1220, depth: 570, height: 1710, price: 27500, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGANT004', name: 'アンティーク調アクセサリースタンドツリー', category: 'アンティーク・ヴィンテージ', width: null, depth: null, height: 250, price: 1320, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGANT005', name: 'カントリー調木目テーブル', category: 'アンティーク・ヴィンテージ', width: 1090, depth: 430, height: 790, price: 8800, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGANT006', name: 'ヴィンテージテーブル(W1600)', category: 'アンティーク・ヴィンテージ', width: 1600, depth: 650, height: 930, price: 22000, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGANT007', name: 'アンティークテーブル(白)', category: 'アンティーク・ヴィンテージ', width: 850, depth: 420, height: 780, price: 11000, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGANT008', name: 'アンティークキャビネット(白)', category: 'アンティーク・ヴィンテージ', width: 1000, depth: 400, height: 855, price: 14300, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGANT009', name: 'アンティークミニテーブルセット(白)', category: 'アンティーク・ヴィンテージ', width: 520, depth: 450, height: 560, price: 11000, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGANT010', name: 'ウッドテーブル', category: 'アンティーク・ヴィンテージ', width: 1200, depth: 700, height: 730, price: 5500, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGANT011', name: 'ウッドチェア', category: 'アンティーク・ヴィンテージ', width: 415, depth: null, height: 900, price: 2200, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGANT012', name: 'アンティークサイドテーブル', category: 'アンティーク・ヴィンテージ', width: 690, depth: 480, height: 670, price: 11000, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGANT013', name: 'アンティークダイニングテーブル(リフェクトリー)', category: 'アンティーク・ヴィンテージ', width: 1520, depth: 770, height: 710, price: 16500, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGANT014', name: 'アンティークダイニングテーブル(レクタングル)', category: 'アンティーク・ヴィンテージ', width: 1520, depth: 770, height: 710, price: 16500, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGANT015', name: 'アイアンテーブル', category: 'アンティーク・ヴィンテージ', width: 1100, depth: 670, height: 750, price: 11000, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGANT016', name: 'アンティーク木製チェア', category: 'アンティーク・ヴィンテージ', width: null, depth: null, height: null, price: 2200, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGANT017', name: 'アンティークダイニングテーブル(Φ710)', category: 'アンティーク・ヴィンテージ', width: 1520, depth: 910, height: 752, price: 16500, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGANT018', name: 'デザインソファー', category: 'アンティーク・ヴィンテージ', width: 1240, depth: 600, height: 930, price: 19800, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGANT023', name: 'アームスツール(ブラウン)', category: 'アンティーク・ヴィンテージ', width: 850, depth: 310, height: 520, price: 2200, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGTAB001', name: 'ヴィンテージワークテーブルF', category: 'アンティーク・ヴィンテージ', width: 1200, depth: 880, height: 770, price: 22000, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGTAB002', name: 'ヴィンテージワークテーブルE', category: 'アンティーク・ヴィンテージ', width: 1200, depth: 855, height: 775, price: 13200, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGTAB003', name: 'カントリー調ネストテーブルセット', category: 'アンティーク・ヴィンテージ', width: 1000, depth: 300, height: 450, price: 13200, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGTAB005', name: 'ビボサイコロテーブル(白パイプ)', category: 'アンティーク・ヴィンテージ', width: 900, depth: 600, height: 750, price: 7150, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGTAB006', name: 'ミーティングテーブル＆セブンチェアセット', category: 'アンティーク・ヴィンテージ', width: 1140, depth: 450, height: 460, price: 10780, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGTAB009', name: 'アンティークテーブル(大小セット)', category: 'アンティーク・ヴィンテージ', width: 1140, depth: 450, height: 460, price: 16500, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGTAB016', name: 'アンティークラウンドテーブルB', category: 'アンティーク・ヴィンテージ', width: 920, depth: 485, height: 785, price: 11000, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGTAB017', name: 'ヴィンテージテーブル', category: 'アンティーク・ヴィンテージ', width: 920, depth: 485, height: 785, price: 11000, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGTAB018', name: 'ネストテーブルセット', category: 'アンティーク・ヴィンテージ', width: 810, depth: 745, height: 590, price: 8800, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGTAB020', name: 'ダイニングテーブル(楕円)', category: 'アンティーク・ヴィンテージ', width: 1210, depth: 920, height: 735, price: 13200, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGTAB021', name: 'ヴィンテージワークテーブルC', category: 'アンティーク・ヴィンテージ', width: 1730, depth: 900, height: 750, price: 16500, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGTAB022', name: 'ヴィンテージワークテーブルB', category: 'アンティーク・ヴィンテージ', width: 1730, depth: 900, height: 750, price: 22000, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGTAB023', name: 'ヴィンテージワークテーブルA', category: 'アンティーク・ヴィンテージ', width: 1830, depth: 760, height: 760, price: 22000, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGTAB024', name: 'アンティークダイニングテーブルA', category: 'アンティーク・ヴィンテージ', width: 1200, depth: 880, height: 770, price: 22000, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGTAB026', name: 'ロングダメージテーブル＆ベンチセット', category: 'アンティーク・ヴィンテージ', width: 1200, depth: 880, height: 770, price: 15400, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGTAB027', name: 'アンティークラウンドテーブルtypeA', category: 'アンティーク・ヴィンテージ', width: 730, depth: 730, height: 790, price: 11000, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGTAB028', name: 'ビボテーブル(大小セット)', category: 'アンティーク・ヴィンテージ', width: 730, depth: 730, height: 790, price: 11000, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  { code: 'NGTAB031', name: 'バロックテーブル(ブラウン)', category: 'アンティーク・ヴィンテージ', width: 1200, depth: 730, height: 770, price: 5500, weight: null, stackable: null, maxStack: 1, color: '#78716c' },
  // 和装ディスプレイ（company/master/products.json より一括反映。price=税込目安、null=未計測）
  { code: 'CA0010-tatami', name: 'スタイロ畳', category: '和装ディスプレイ', width: 1760, depth: 880, height: null, price: 1100, weight: null, stackable: null, maxStack: 1, color: '#9f1239' },
  { code: 'CB0010', name: '二段木製衣桁', category: '和装ディスプレイ', width: 1850, depth: 380, height: 1690, price: 3300, weight: null, stackable: null, maxStack: 1, color: '#9f1239' },
  { code: 'CB0060', name: '一段組衣桁', category: '和装ディスプレイ', width: 1840, depth: 400, height: 1735, price: 1980, weight: null, stackable: null, maxStack: 1, color: '#9f1239' },
  { code: 'CB0070', name: '二段両組衣桁', category: '和装ディスプレイ', width: 1840, depth: 400, height: 1735, price: 1650, weight: null, stackable: null, maxStack: 1, color: '#9f1239' },
  { code: 'CB0080', name: '子供用衣桁 一段', category: '和装ディスプレイ', width: 140, depth: 140, height: 60, price: 3300, weight: null, stackable: null, maxStack: 1, color: '#9f1239' },
  { code: 'CB0100', name: '房付装飾金具クリップ', category: '和装ディスプレイ', width: null, depth: null, height: null, price: 396, weight: null, stackable: null, maxStack: 1, color: '#9f1239' },
  { code: 'CB0101', name: '房付きクリップ', category: '和装ディスプレイ', width: null, depth: null, height: null, price: 110, weight: null, stackable: null, maxStack: 1, color: '#9f1239' },
  { code: 'CC0010', name: '撞木', category: '和装ディスプレイ', width: 450, depth: 255, height: 600, price: 330, weight: null, stackable: null, maxStack: 1, color: '#9f1239' },
  { code: 'CD0010', name: '毛氈', category: '和装ディスプレイ', width: 1800, depth: 4000, height: null, price: 3850, weight: null, stackable: null, maxStack: 1, color: '#9f1239' },
  { code: 'CG0010', name: '野点傘', category: '和装ディスプレイ', width: null, depth: null, height: 2450, price: 6600, weight: null, stackable: null, maxStack: 1, color: '#9f1239' },
  { code: 'CG0050', name: '帯ひも掛け', category: '和装ディスプレイ', width: 300, depth: null, height: 1600, price: 4400, weight: null, stackable: null, maxStack: 1, color: '#9f1239' },
  { code: 'CG0130-B', name: '生地掛け(両面型)', category: '和装ディスプレイ', width: 1200, depth: 550, height: 1440, price: 2200, weight: null, stackable: null, maxStack: 1, color: '#9f1239' },
  { code: 'CG0130-S', name: '生地掛け(スクリーン型)', category: '和装ディスプレイ', width: 900, depth: null, height: 1800, price: 2200, weight: null, stackable: null, maxStack: 1, color: '#9f1239' },
  { code: 'CG0140', name: 'ノーマルのれん', category: '和装ディスプレイ', width: 150, depth: 40, height: 80, price: 1100, weight: null, stackable: null, maxStack: 1, color: '#9f1239' },
  // サインスタンド・イーゼル（company/master/products.json より一括反映。price=税込目安、null=未計測）
  { code: 'ESBK', name: '黒イーゼル', category: 'サインスタンド・イーゼル', width: 450, depth: 500, height: 1650, price: 1650, weight: null, stackable: null, maxStack: 1, color: '#52525b' },
  { code: 'ESS', name: 'シルバーイーゼル', category: 'サインスタンド・イーゼル', width: 900, depth: 1000, height: 1300, price: 4400, weight: null, stackable: null, maxStack: 1, color: '#52525b' },
  { code: 'ESW', name: '木製イーゼル', category: 'サインスタンド・イーゼル', width: 600, depth: 530, height: 1560, price: 3300, weight: null, stackable: null, maxStack: 1, color: '#52525b' },
  { code: 'HB-tk', name: 'バッグスタンド', category: 'サインスタンド・イーゼル', width: null, depth: null, height: 500, price: 924, weight: null, stackable: null, maxStack: 1, color: '#52525b' },
  { code: 'NGANT019', name: 'デコイーゼル・ブラウン', category: 'サインスタンド・イーゼル', width: 580, depth: 600, height: 1420, price: 2200, weight: null, stackable: null, maxStack: 1, color: '#52525b' },
  { code: 'PBS-tk', name: 'パネルボードスタンド', category: 'サインスタンド・イーゼル', width: null, depth: null, height: 1000, price: 4400, weight: null, stackable: null, maxStack: 1, color: '#52525b' },
  { code: 'PSIL', name: 'ポップスタンド', category: 'サインスタンド・イーゼル', width: 37, depth: 30, height: null, price: 1100, weight: null, stackable: null, maxStack: 1, color: '#52525b' },
  { code: 'PSIT-tk', name: 'T型ポップスタンド', category: 'サインスタンド・イーゼル', width: null, depth: null, height: 1250, price: 2200, weight: null, stackable: null, maxStack: 1, color: '#52525b' },
  { code: 'PST-tk', name: '卓上T型ポップスタンド', category: 'サインスタンド・イーゼル', width: 150, depth: 150, height: 500, price: 1100, weight: null, stackable: null, maxStack: 1, color: '#52525b' },
  { code: 'SST-tk', name: 'サインスタンド', category: 'サインスタンド・イーゼル', width: null, depth: null, height: 1000, price: 4070, weight: null, stackable: null, maxStack: 1, color: '#52525b' },
  { code: 'TO-501-TO', name: 'カタログスタンド(A4縦 1列12段)', category: 'サインスタンド・イーゼル', width: 250, depth: 570, height: 1640, price: 6050, weight: null, stackable: null, maxStack: 1, color: '#52525b' },
  { code: 'TO-503-TO', name: 'カタログスタンド(A4縦 1列2段)', category: 'サインスタンド・イーゼル', width: 225, depth: 225, height: 853, price: 3850, weight: null, stackable: null, maxStack: 1, color: '#52525b' },
  { code: 'TO-504-TO', name: 'カタログスタンド(A4縦 1列5段)', category: 'サインスタンド・イーゼル', width: 230, depth: 260, height: 560, price: 3850, weight: null, stackable: null, maxStack: 1, color: '#52525b' },
  { code: 'TO-505-TO', name: 'カタログスタンド(A4縦 1列3段)', category: 'サインスタンド・イーゼル', width: 251, depth: 261, height: 373, price: 3300, weight: null, stackable: null, maxStack: 1, color: '#52525b' },
  { code: 'TO-506-TO', name: 'カタログスタンド(A4縦 1列3段・小)', category: 'サインスタンド・イーゼル', width: 230, depth: 150, height: 370, price: 1650, weight: null, stackable: null, maxStack: 1, color: '#52525b' },
  { code: 'TO-507-TO', name: 'カタログスタンド(A4縦 1列2段・小)', category: 'サインスタンド・イーゼル', width: 105, depth: 115, height: 361, price: 1650, weight: null, stackable: null, maxStack: 1, color: '#52525b' },
  { code: 'TO-510-TO', name: 'パネルスタンド(板面200×200)', category: 'サインスタンド・イーゼル', width: 300, depth: 300, height: 940, price: 2750, weight: null, stackable: null, maxStack: 1, color: '#52525b' },
  { code: 'TO-511-TO', name: 'パネルスタンド', category: 'サインスタンド・イーゼル', width: 310, depth: null, height: 810, price: 7150, weight: null, stackable: null, maxStack: 1, color: '#52525b' },
  { code: 'TO-513-TO', name: '実演時間表示板', category: 'サインスタンド・イーゼル', width: 300, depth: 300, height: 940, price: 9500, weight: null, stackable: null, maxStack: 1, color: '#52525b' },
  { code: 'TO-515-TO', name: 'サインスタンド', category: 'サインスタンド・イーゼル', width: 400, depth: null, height: 390, price: 4950, weight: null, stackable: null, maxStack: 1, color: '#52525b' },
  { code: 'UST-tk', name: 'ユニバーサルサインスタンド', category: 'サインスタンド・イーゼル', width: null, depth: null, height: 1100, price: 4070, weight: null, stackable: null, maxStack: 1, color: '#52525b' },
  // 受付カウンター（company/master/products.json より一括反映。price=税込目安、null=未計測）
  { code: 'HCW-TK', name: '組み立て式受付ハイカウンター(白)', category: '受付カウンター', width: 1500, depth: 700, height: 900, price: 6600, weight: null, stackable: null, maxStack: 1, color: '#4b5563' },
  { code: 'TR-401-TO', name: 'カウンター(中棚付)', category: '受付カウンター', width: 1800, depth: 600, height: 930, price: 55000, weight: null, stackable: null, maxStack: 1, color: '#4b5563' },
  { code: 'TR-405-TO', name: '受付カウンターA', category: '受付カウンター', width: 900, depth: 450, height: 930, price: 6600, weight: null, stackable: null, maxStack: 1, color: '#4b5563' },
  // 接客カウンター（company/master/products.json より一括反映。price=税込目安、null=未計測）
  { code: 'TR-402-TO', name: 'ユニットカウンター', category: '接客カウンター', width: 1200, depth: 650, height: 750, price: 13200, weight: null, stackable: null, maxStack: 1, color: '#9ca3af' },
  // イベント用品（company/master/products.json より一括反映。price=税込目安、null=未計測）
  { code: 'BRDP', name: 'Blu-rayプレーヤー', category: 'イベント用品', width: 245, depth: 175, height: 38.5, price: 4400, weight: null, stackable: null, maxStack: 1, color: '#a3e635' },
  { code: 'IRDI-01', name: 'アイリスオーヤマ 50インチ 液晶モニター', category: 'イベント用品', width: null, depth: null, height: null, price: 44000, weight: null, stackable: null, maxStack: 1, color: '#a3e635' },
  { code: 'KST-dan02', name: 'ステージ用階段(屋内専用)', category: 'イベント用品', width: 1000, depth: 360, height: 200, price: 2750, weight: null, stackable: null, maxStack: 1, color: '#a3e635' },
  { code: 'KST-ex', name: 'ステージ用延長金具', category: 'イベント用品', width: null, depth: null, height: null, price: 2200, weight: null, stackable: null, maxStack: 1, color: '#a3e635' },
  { code: 'KST-sk02', name: 'ステージ用スカート', category: 'イベント用品', width: 2000, depth: null, height: 200, price: 2200, weight: null, stackable: null, maxStack: 1, color: '#a3e635' },
  { code: 'KST-sq02', name: '簡易ステージ(正方形)(屋内用)', category: 'イベント用品', width: 1000, depth: 1000, height: 200, price: 2750, weight: null, stackable: null, maxStack: 1, color: '#a3e635' },
  { code: 'KST-wd02', name: '簡易ステージ(長方形)(屋内用)', category: 'イベント用品', width: 2000, depth: 1000, height: 230, price: 5500, weight: null, stackable: null, maxStack: 1, color: '#a3e635' },
  { code: 'LEDVISION-CUBE', name: 'キューブ型LEDビジョン(300角)', category: 'イベント用品', width: 320, depth: 320, height: 320, price: 55000, weight: null, stackable: null, maxStack: 1, color: '#a3e635' },
  { code: 'LEDVISION-SHOWCASE', name: 'LEDビジョン・ショーケース', category: 'イベント用品', width: 500, depth: null, height: 1500, price: 77000, weight: null, stackable: null, maxStack: 1, color: '#a3e635' },
  { code: 'LEDVISION-WALL', name: 'LEDビジョン', category: 'イベント用品', width: 1500, depth: null, height: 2000, price: 231000, weight: null, stackable: null, maxStack: 1, color: '#a3e635' },
  { code: 'MS-50', name: '32-55インチ壁吊り用モニタースタンド', category: 'イベント用品', width: null, depth: null, height: null, price: 5500, weight: null, stackable: null, maxStack: 1, color: '#a3e635' },
  { code: 'MS-80', name: '50-110インチ壁吊り用モニタースタンド', category: 'イベント用品', width: null, depth: null, height: null, price: 11000, weight: null, stackable: null, maxStack: 1, color: '#a3e635' },
  { code: 'NG-PNR426', name: 'SHARP 42V型 液晶モニター スタンドセット', category: 'イベント用品', width: null, depth: null, height: null, price: 33000, weight: null, stackable: null, maxStack: 1, color: '#a3e635' },
  { code: 'PN-E521', name: 'SHARP 52V型 液晶モニター', category: 'イベント用品', width: null, depth: null, height: null, price: 37400, weight: null, stackable: null, maxStack: 1, color: '#a3e635' },
  { code: 'PN-L802B', name: 'SHARP 80V型 液晶モニター', category: 'イベント用品', width: null, depth: null, height: null, price: 55000, weight: null, stackable: null, maxStack: 1, color: '#a3e635' },
  { code: 'PN-M43-E', name: 'SHARP 43V型 液晶モニター スタンドセット', category: 'イベント用品', width: null, depth: null, height: null, price: 36300, weight: null, stackable: null, maxStack: 1, color: '#a3e635' },
  { code: 'PN-T321', name: 'SHARP 32V型 液晶モニター', category: 'イベント用品', width: null, depth: null, height: null, price: 22000, weight: null, stackable: null, maxStack: 1, color: '#a3e635' },
  { code: 'PN-Y496-E', name: 'SHARP 49V型 液晶モニター スタンドセット', category: 'イベント用品', width: null, depth: null, height: null, price: 39600, weight: null, stackable: null, maxStack: 1, color: '#a3e635' },
  { code: 'STP-tk', name: 'ポータブルステージ(屋内限定)', category: 'イベント用品', width: 2400, depth: 1200, height: 200, price: 19800, weight: null, stackable: null, maxStack: 1, color: '#a3e635' },
  { code: 'SUASP-KR', name: 'スポットクーラー 移動式エアコン', category: 'イベント用品', width: 430, depth: 390, height: 1050, price: 27500, weight: null, stackable: null, maxStack: 1, color: '#a3e635' },
  { code: 'TF-30W', name: '壁掛け扇風機', category: 'イベント用品', width: 360, depth: 330, height: 490, price: 3740, weight: null, stackable: null, maxStack: 1, color: '#a3e635' },
  { code: 'TL-905A-TO', name: '演台', category: 'イベント用品', width: 750, depth: 500, height: 1000, price: 38500, weight: null, stackable: null, maxStack: 1, color: '#a3e635' },
  { code: 'TR-tk', name: 'トラス', category: 'イベント用品', width: null, depth: null, height: null, price: null, weight: null, stackable: null, maxStack: 1, color: '#a3e635' },
  { code: 'WE10-E', name: '10kgテントウェイト', category: 'イベント用品', width: 235, depth: 235, height: 45, price: 880, weight: null, stackable: null, maxStack: 1, color: '#a3e635' },
];

/**
 * 商品マスターの詳細不明部分（weight/stackable/maxStack等）を後から記入するための上書き層。
 * PRODUCT_MASTER 本体は編集せず、localStorage に差分だけ保存して重ねる。
 */
const PRODUCT_OVERRIDES_KEY = 'stepstudio_product_overrides';
let PRODUCT_OVERRIDES = {};
try {
  PRODUCT_OVERRIDES = JSON.parse(localStorage.getItem(PRODUCT_OVERRIDES_KEY) || '{}');
} catch (_) { PRODUCT_OVERRIDES = {}; }

function saveProductOverrides() {
  try { localStorage.setItem(PRODUCT_OVERRIDES_KEY, JSON.stringify(PRODUCT_OVERRIDES)); } catch (_) { /* file:// 等で不可でも無視 */ }
}

/** 商品マスターの1項目を編集して保存する（value===nullで未入力に戻す） */
function setProductOverride(code, field, value) {
  const ov = PRODUCT_OVERRIDES[code] || {};
  if (value === null) { delete ov[field]; } else { ov[field] = value; }
  if (Object.keys(ov).length === 0) { delete PRODUCT_OVERRIDES[code]; } else { PRODUCT_OVERRIDES[code] = ov; }
  saveProductOverrides();
}

/** マスター未収録の型式に、色を安定的に割り当てる（同じ型式には常に同じ色） */
const CUSTOM_PRODUCT_PALETTE = ['#0ea5e9', '#16a34a', '#d97706', '#9333ea', '#dc2626', '#0891b2', '#ca8a04', '#4f46e5', '#059669', '#7c3aed'];
function colorForCode(code) {
  let hash = 0;
  for (let i = 0; i < code.length; i++) hash = (hash * 31 + code.charCodeAt(i)) >>> 0;
  return CUSTOM_PRODUCT_PALETTE[hash % CUSTOM_PRODUCT_PALETTE.length];
}

/** PRODUCT_MASTERに無く、商品マスター編集画面から新規登録された型式の一覧（指示書②） */
function customProductCodes() {
  return Object.keys(PRODUCT_OVERRIDES).filter(code =>
    !PRODUCT_MASTER.some(p => p.code === code) &&
    PRODUCT_OVERRIDES[code].width && PRODUCT_OVERRIDES[code].depth && PRODUCT_OVERRIDES[code].height);
}

/**
 * マスター未収録の型式を新規登録する（指示書②）。以後 getProductMaster/OCR照合で解決できるようになる。
 * fields: { name, width, depth, height, stackable, maxStack, category }
 */
function registerCustomProduct(code, fields) {
  code = String(code || '').trim().toUpperCase();
  if (!code) return { ok: false, error: '型式を入力してください' };
  if (PRODUCT_MASTER.some(p => p.code === code)) return { ok: false, error: 'この型式は既にマスターに登録されています' };
  if (!fields.name) return { ok: false, error: '商品名を入力してください' };
  if (!fields.width || !fields.depth || !fields.height) return { ok: false, error: '幅・奥行・高さをすべて入力してください' };
  PRODUCT_OVERRIDES[code] = {
    name: fields.name,
    width: fields.width, depth: fields.depth, height: fields.height,
    stackable: fields.stackable ?? null, maxStack: fields.maxStack ?? 1,
    category: fields.category || '未分類（手動登録）',
    color: colorForCode(code),
  };
  saveProductOverrides();
  return { ok: true, code };
}

/** 新規登録した商品をマスターから削除する（PRODUCT_MASTER本体の商品は削除できない） */
function removeCustomProduct(code) {
  if (PRODUCT_MASTER.some(p => p.code === code)) return;
  delete PRODUCT_OVERRIDES[code];
  saveProductOverrides();
}

/**
 * 商品マスターから1件取得（上書き済みの詳細があればマージして返す）。
 * PRODUCT_MASTERに無い型式でも、新規登録済み（幅・奥行・高さが揃っている）なら
 * それ単体で1件のマスターとして返す（指示書②：保存すると以後OCRでも自動認識）。
 */
function getProductMaster(code) {
  const base = PRODUCT_MASTER.find(p => p.code === code);
  const ov = PRODUCT_OVERRIDES[code];
  if (base) return ov ? { ...base, ...ov } : base;
  if (ov && ov.width && ov.depth && ov.height) return { code, ...ov };
  return null;
}

/** トラックマスターから1件取得 */
function getTruckMaster(id) {
  return TRUCK_MASTER.find(t => t.id === id) || null;
}
