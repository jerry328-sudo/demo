(function () {
'use strict';
function showLoadError(message) {
  const error = document.getElementById('load-error');
  error.textContent = message;
  error.hidden = false;
  document.querySelectorAll('.panel button, .panel input, .panel select').forEach(control => { control.disabled = true; });
}
if (!window.THREE) {
  showLoadError('三维资源加载失败，请检查网络后刷新页面。 / 3D resources failed to load. Check your connection and reload.');
  return;
}
const { Core, scenarioUpdate, TYPE, BETA, NOMINAL_MW, TC } = RBMK;
const core = new Core();
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- i18n ----------
const I18N = {
  en: {
    title: 'Core simulator',
    hint3d: 'Drag to orbit · scroll to zoom · hover a channel',
    modeFree: 'Free operation',
    modeScen: '26 April 1986',
    narrIntro: 'The reactor is at full power, 3200 MW. The turbogenerator rundown test is planned for today.',
    skipNext: 'Skip to next event',
    takeover: 'Take manual control',
    instruments: 'Instruments',
    kPower: 'Thermal power', kRho: 'Reactivity', kPeriod: 'Period', kOrm: 'Reactivity margin',
    kVoid: 'Core void', kTemp: 'Hottest fuel', kFlow: 'Coolant flow',
    lampORm15: 'ORM < 15', lampAR: 'AR limit', lampFlow: 'Low flow', lampPrompt: 'Prompt crit.',
    lampFuel: 'Fuel > 2200 K', lampRupt: 'Rupture', lampDead: 'Core lost',
    recorder: 'Power recorder',
    recorderSub: 'log scale, last 30 s of playback',
    az5Title: 'AZ-5 · Emergency shutdown',
    az5Body: 'Drives every control rod into the core at 0.4 m/s. Rods start from the top with graphite displacers below the absorber, so the first seconds of travel add reactivity at the bottom of the core.',
    operatorControls: 'Operator controls',
    autoRegulator: 'Automatic regulator',
    hintSP: '12 automatic rods hold power at this setpoint within their limited range.',
    manualRods: 'Manual control rods',
    shortenedAbsorbers: 'Shortened absorbers (from below)',
    pumps: 'Main circulation pumps',
    subcooling: 'Inlet subcooling',
    hintSub: 'Below saturation at the channel inlet. Near zero, a little extra heat makes a lot of steam.',
    rundownTest: 'Start turbine rundown test',
    timeView: 'Time & view',
    colourBy: 'Colour channels by',
    optType: 'Channel type', optTemp: 'Fuel temperature', optVoid: 'Steam void', optXe: 'Xenon-135',
    slowOrbit: 'Slow orbit',
    resetReactor: 'Reset reactor',
    eventLog: 'Event log',
    aboutModel: 'About the model',
    aboutP1: 'Column height follows local thermal power. The physics is point kinetics with one delayed-neutron group (β = 0.5%, prompt generation time 0.8 ms) driven by per-channel steam void, fuel temperature (Doppler) and iodine-135 → xenon-135 poisoning. Steam void adds reactivity, as it did in the RBMK, and the effect is strongest at low power with coolant near boiling.',
    aboutP2: 'Coefficients are tuned so the 1986 sequence plays out qualitatively as described in IAEA INSAG-7. Numbers are illustrative, not a reconstruction of the plant.',
    clockElapsed: 'ELAPSED', clockPaused: 'paused', slowmo: 'SLOW MOTION ×0.25',
    mwThermal: 'thermal',
    bigDestroyed: 'Destroyed', bigNoReadings: 'no readings',
    chipOk: 'Normal operation', chipDead: 'Core destroyed', chipRupt: 'Channels rupturing',
    chipPrompt: 'Prompt critical', chipScram: 'AZ-5 · rods inserting', chipOver: 'Overpower',
    chipMargin: 'Reactivity margin violated', chipLow: 'Low power · unstable region',
    p4in: '25 April 1986, 01:00. Unit 4 is at full power ahead of a planned shutdown and turbogenerator rundown test.',
    narrFirst: 'The reactor is at full power, 3200 MW. The turbogenerator rundown test is planned for today.',
    rods: 'rods', xeEq: '× eq.',
    hRR: n => `${n} rods. 0% means fully withdrawn above the core.`,
    pctIn: (v) => `${v}% in`,
    outWin: (o, n) => `${n} rods, ${o} manual and shortened rods fully withdrawn. 0% is fully out above the core.`,
    typeFuel: (n) => `Fuel (${n})`,
    typeRR: (n) => `Manual rods (${n})`,
    typeUSP: (n) => `Shortened absorbers (${n})`,
    typeAR: (n) => `Automatic rods (${n})`,
    legendTemp: 'Fuel temperature', legendVoid: 'Steam void', legendXe: 'Xenon-135', legendXeEq: '2× eq.',
    tipFuel: 'Fuel channel', tipRR: 'Manual control rod', tipUSP: 'Shortened absorber', tipAR: 'Automatic regulator rod',
    tipFlux: 'Relative flux', tipPower: 'Channel power', tipFuelTemp: 'Fuel temp.', tipVoid: 'Steam void',
    tipInsertion: 'Insertion', tipStatus: 'Status', tipRuptured: 'Ruptured',
    rec1MW: '1 MW', rec100MW: '100 MW', rec10GW: '10 GW', recNominal: 'nominal',
    logRupture: 'Fuel channel pressure tube ruptured. Steam is escaping into the graphite stack.',
    logPrompt: (v) => `Prompt critical: reactivity ${v} $. Power is now multiplying on prompt neutrons alone.`,
    logOrm: (v) => `Operational reactivity margin fell below 15 rods (${v}). Regulations require immediate shutdown.`,
    logOver: (mw) => `Power above 120% of nominal (${mw} MW).`,
    logTen: (gw) => `Power ×10 nominal (${gw} GW). Fuel is fragmenting.`,
    logCoast: (k) => `Turbine stop valves closed. ${k} main circulation pumps coast down with the turbogenerator.`,
    logAz5: 'AZ-5 pressed. All control rods start driving into the core at 0.4 m/s.',
    logExplode: (n, mw) => `Steam explosion. ${n} channels ruptured; the 1000-tonne upper shield lifts and the core is destroyed. Peak power ≈ ${mw} MW.`,
    logOrmPrint: (v) => `Computer printout: operational reactivity margin ≈ ${v} rods (minimum allowed: 15).`,
    sc1: 'Power reduction begins ahead of the turbogenerator 8 rundown test.',
    sc2: 'Reactor at 1600 MW (50%). Turbogenerator 7 disconnected.',
    sc3: 'Emergency core cooling system isolated. The Kyiv grid controller asks the unit to stay online, so the test is postponed.',
    sc4: 'Grid controller releases the unit. Power reduction resumes toward the 700–1000 MW test level.',
    sc5: 'Control is switched from the local to the global automatic regulators. Power collapses to about 30 MW.',
    sc6: 'Operators withdraw control rods to recover power. Xenon-135 is accumulating in the core.',
    sc7: 'Power held near 200 MW, well below the 700 MW the test plan required.',
    sc8: 'Main circulation pump 7 started. Extra flow suppresses boiling, so more rods are withdrawn.',
    sc9: 'Main circulation pump 8 started. Coolant in the core is now close to saturation.',
    sc10: 'Feedwater flow reduced. Preparations for the rundown test.',
    m1: 'Power reduction begins', m2: 'ECCS isolated; test postponed by grid', m3: 'Reduction resumes',
    m4: 'Power collapses to ~30 MW', m5: 'Extra pumps 7 and 8 started', m6: 'Turbine rundown test starts',
    m7: 'AZ-5 pressed'
  },
  zh: {
    title: '反应堆堆芯模拟器',
    hint3d: '拖动旋转 · 滚轮缩放 · 悬停查看通道',
    modeFree: '自由操作',
    modeScen: '1986 年 4 月 26 日',
    narrIntro: '反应堆处于满功率 3200 MW。今天计划进行汽轮发电机惰转试验。',
    skipNext: '跳到下一个事件',
    takeover: '接管手动控制',
    instruments: '仪表',
    kPower: '热功率', kRho: '反应性', kPeriod: '周期', kOrm: '反应性裕量',
    kVoid: '堆芯空泡', kTemp: '最热燃料', kFlow: '冷却剂流量',
    lampORm15: 'ORM < 15', lampAR: 'AR 限位', lampFlow: '低流量', lampPrompt: '瞬发临界',
    lampFuel: '燃料 > 2200 K', lampRupt: '管道破裂', lampDead: '堆芯损毁',
    recorder: '功率记录仪',
    recorderSub: '对数刻度，回放最近 30 秒',
    az5Title: 'AZ-5 · 紧急停堆',
    az5Body: '以 0.4 米/秒的速度将所有控制棒插入堆芯。控制棒从顶部插入，吸收体下方带有石墨排水器，因此行程最初几秒会在堆芯底部增加反应性。',
    operatorControls: '操作员控制',
    autoRegulator: '自动调节器',
    hintSP: '12 根自动控制棒在其有限行程内将功率维持在该设定值。',
    manualRods: '手动控制棒',
    shortenedAbsorbers: '短型吸收棒（自下而上）',
    pumps: '主循环泵',
    subcooling: '入口过冷度',
    hintSub: '通道入口低于饱和温度。接近零时，少量额外热量就会产生大量蒸汽。',
    rundownTest: '开始汽轮机惰转试验',
    timeView: '时间与视图',
    colourBy: '通道着色依据',
    optType: '通道类型', optTemp: '燃料温度', optVoid: '蒸汽空泡', optXe: '氙-135',
    slowOrbit: '缓慢环绕',
    resetReactor: '重置反应堆',
    eventLog: '事件日志',
    aboutModel: '关于本模型',
    aboutP1: '柱体高度表示局部热功率。物理采用单组缓发中子的点堆动力学（β = 0.5%，瞬发中子代时间 0.8 ms），由逐通道的蒸汽空泡、燃料温度（多普勒效应）以及碘-135 → 氙-135 中毒驱动。蒸汽空泡会像 RBMK 中那样增加反应性，且在低功率、冷却剂接近沸腾时效应最强。',
    aboutP2: '系数经过调整，使 1986 年的过程按 IAEA INSAG-7 所述在定性上重现。数值仅作示意，并非该机组的复现。',
    clockElapsed: '已运行', clockPaused: '已暂停', slowmo: '慢动作 ×0.25',
    mwThermal: '热功率',
    bigDestroyed: '已损毁', bigNoReadings: '无读数',
    chipOk: '正常运行', chipDead: '堆芯已损毁', chipRupt: '通道破裂',
    chipPrompt: '瞬发临界', chipScram: 'AZ-5 · 控制棒插入中', chipOver: '超功率',
    chipMargin: '反应性裕量违规', chipLow: '低功率 · 不稳定区',
    p4in: '1986 年 4 月 25 日 01:00。4 号机组处于满功率，即将按计划停堆并进行汽轮发电机惰转试验。',
    narrFirst: '反应堆处于满功率 3200 MW。今天计划进行汽轮发电机惰转试验。',
    rods: '根', xeEq: '× 平衡值',
    hRR: n => `共 ${n} 根。0% 表示完全提出堆芯上方。`,
    pctIn: (v) => `插入 ${v}%`,
    outWin: (o, n) => `共 ${n} 根，其中 ${o} 根手动及短型控制棒已完全提出。0% 表示完全提出至堆芯上方。`,
    typeFuel: (n) => `燃料通道（${n}）`,
    typeRR: (n) => `手动控制棒（${n}）`,
    typeUSP: (n) => `短型吸收棒（${n}）`,
    typeAR: (n) => `自动控制棒（${n}）`,
    legendTemp: '燃料温度', legendVoid: '蒸汽空泡', legendXe: '氙-135', legendXeEq: '2× 平衡值',
    tipFuel: '燃料通道', tipRR: '手动控制棒', tipUSP: '短型吸收棒', tipAR: '自动调节棒',
    tipFlux: '相对通量', tipPower: '通道功率', tipFuelTemp: '燃料温度', tipVoid: '蒸汽空泡',
    tipInsertion: '插入深度', tipStatus: '状态', tipRuptured: '已破裂',
    rec1MW: '1 MW', rec100MW: '100 MW', rec10GW: '10 GW', recNominal: '额定',
    logRupture: '燃料通道压力管破裂，蒸汽正在泄入石墨堆体。',
    logPrompt: (v) => `瞬发临界：反应性 ${v} $。功率现在仅靠瞬发中子倍增。`,
    logOrm: (v) => `运行反应性裕量降至 15 根以下（${v}）。规程要求立即停堆。`,
    logOver: (mw) => `功率超过额定值的 120%（${mw} MW）。`,
    logTen: (gw) => `功率达到额定值的 10 倍（${gw} GW）。燃料正在碎裂。`,
    logCoast: (k) => `汽轮机主汽阀关闭。${k} 台主循环泵随汽轮发电机惰转降速。`,
    logAz5: '已按下 AZ-5。所有控制棒开始以 0.4 米/秒插入堆芯。',
    logExplode: (n, mw) => `蒸汽爆炸。${n} 个通道破裂；1000 吨重的上部防护盖被掀起，堆芯损毁。峰值功率约 ${mw} MW。`,
    logOrmPrint: (v) => `计算机打印：运行反应性裕量约 ${v} 根（最低允许：15）。`,
    sc1: '在汽轮发电机 8 号惰转试验前开始降功率。',
    sc2: '反应堆功率 1600 MW（50%）。7 号汽轮发电机解列。',
    sc3: '应急堆芯冷却系统被隔离。基辅电网调度要求机组继续并网，试验因此推迟。',
    sc4: '电网调度放行机组。降功率继续进行，目标是 700–1000 MW 的试验功率。',
    sc5: '控制方式从局部自动调节器切换为全局自动调节器。功率骤降至约 30 MW。',
    sc6: '操作员提出控制棒以恢复功率。氙-135 正在堆内积累。',
    sc7: '功率维持在 200 MW 附近，远低于试验方案要求的 700 MW。',
    sc8: '7 号主循环泵启动。额外流量抑制了沸腾，因此又提出了更多控制棒。',
    sc9: '8 号主循环泵启动。堆芯冷却剂现已接近饱和温度。',
    sc10: '给水流量减少。进行惰转试验的准备工作。',
    m1: '开始降功率', m2: 'ECCS 隔离；电网推迟试验', m3: '恢复降功率',
    m4: '功率骤降至约 30 MW', m5: '7、8 号泵启动', m6: '汽轮机惰转试验开始',
    m7: '按下 AZ-5'
  }
};

const LANG_KEY = 'rbmk-lang';
let lang = 'en';
try { const saved = localStorage.getItem(LANG_KEY); if (saved && I18N[saved]) lang = saved; } catch (e) { /* storage unavailable */ }
const T = key => I18N[lang][key] !== undefined ? I18N[lang][key] : I18N.en[key];

// (s1)(s2) split static markup so languages reorder emphasis freely
function buildScenTable() {
  const M = {
    'Power reduction begins ahead of the turbogenerator 8 rundown test.': 'sc1',
    'Reactor at 1600 MW (50%). Turbogenerator 7 disconnected.': 'sc2',
    'Emergency core cooling system isolated. The Kyiv grid controller asks the unit to stay online, so the test is postponed.': 'sc3',
    'Grid controller releases the unit. Power reduction resumes toward the 700–1000 MW test level.': 'sc4',
    'Control is switched from the local to the global automatic regulators. Power collapses to about 30 MW.': 'sc5',
    'Operators withdraw control rods to recover power. Xenon-135 is accumulating in the core.': 'sc6',
    'Power held near 200 MW, well below the 700 MW the test plan required.': 'sc7',
    'Main circulation pump 7 started. Extra flow suppresses boiling, so more rods are withdrawn.': 'sc8',
    'Main circulation pump 8 started. Coolant in the core is now close to saturation.': 'sc9',
    'Feedwater flow reduced. Preparations for the rundown test.': 'sc10'
  };
  for (const e of RBMK.SCENARIO) {
    const k = M[e.text];
    if (k) { e.s1 = e.s2 = I18N.en[k]; e.k = k; }
    else if (e.text) { e.s1 = e.text; e.s2 = null; } // event codes: ORM / COAST / AZ5
  }
}
const MS = {
  'Power reduction begins': 'm1',
  'ECCS isolated; test postponed by grid': 'm2',
  'Reduction resumes': 'm3',
  'Power collapses to ~30 MW': 'm4',
  'Extra pumps 7 and 8 started': 'm5',
  'Turbine rundown test starts': 'm6',
  'AZ-5 pressed': 'm7'
};

function scenText(e) {
  if (!e) return '';
  if (!lang || lang === 'en' || !e.k) return e.s1;
  return T(e.k);
}
function evText(e, c) {
  let t;
  switch (e.k) {
    case 'rupture': t = T('logRupture'); break;
    case 'prompt': t = T('logPrompt')(e.v); break;
    case 'orm': t = T('logOrm')(e.v); break;
    case 'over': t = T('logOver')(e.v); break;
    case 'ten': t = T('logTen')(e.v); break;
    case 'coast': t = T('logCoast')(e.v); break;
    case 'az5': t = T('logAz5'); break;
    case 'explode': t = T('logExplode')(e.v, e.v2); break;
    case 'ormprint': t = T('logOrmPrint')(e.v); break;
    default:
      if (e.s1 === 'ORM' || e.s1 === 'COAST' || e.s1 === 'AZ5') t = T(`sc${e.s1}`);
      else t = scenText(e);
  }
  return typeof t === 'function' ? t(c) : t;
}
const evLine = e => evText(e, core);

function translateNode(n) {
  const k = n.dataset.i18n; if (!k) return;
  const v = T(k); if (typeof v !== 'string') return;
  n.innerHTML = '<span class="s1"></span><span class="s2"></span>';
  n.firstChild.textContent = v;
}
function applyStatic() {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.body.dataset.lang = lang;
  for (const n of document.querySelectorAll('[data-i18n]')) translateNode(n);
  for (const b of document.querySelectorAll('[data-lang-btn]')) b.setAttribute('aria-pressed', b.dataset.langBtn === lang);
  document.title = T('title');
}

let narrKey = null, narrEvent = null;
function setNarr(v, e) {
  if (v === undefined || v === null) return;
  narrEvent = e || null;
  narrKey = null;
  for (const k of ['narrIntro', 'p4in']) if (Object.values(I18N).some(d => d[k] === v)) narrKey = k;
  $('narr').textContent = v;
}
function applyLang() {
  applyStatic();
  renderLegend(); renderSteps(); drawRecorder(); updateInstruments();
  if (narrEvent) $('narr').textContent = evLine(narrEvent);
  else if (narrKey) $('narr').textContent = T(narrKey);
  for (const li of $('log').children) if (li._e) li.lastChild.textContent = evLine(li._e);
  for (const b of $('warps').children) b.setAttribute('aria-pressed', +b.dataset.w === state.warp);
}
for (const b of document.querySelectorAll('[data-lang-btn]')) {
  b.onclick = () => {
    lang = b.dataset.langBtn;
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* storage unavailable */ }
    applyLang();
  };
}
buildScenTable();

const state = { mode: 'scen', warp: 1, colorMode: 'type', autoRotate: !reduceMotion, scen: null, skipping: false, log: [], destroyedShown: false, explodeT: -1 };

const MILESTONES = [
  { t: 360, label: 'Power reduction begins' },
  { t: 46800, label: 'ECCS isolated; test postponed by grid' },
  { t: 79800, label: 'Reduction resumes' },
  { t: 84480, label: 'Power collapses to ~30 MW' },
  { t: 86580, label: 'Extra pumps 7 and 8 started' },
  { t: 87784, label: 'Turbine rundown test starts' },
  { t: 87820, label: 'AZ-5 pressed' },
];

// ---------- formatting ----------
function fmtClock(t) {
  if (state.mode === 'scen' || state.scenClock) {
    const tot = Math.floor(3600 + t), day = 25 + Math.floor(tot / 86400), r = tot % 86400;
    const stamp = `${p2(Math.floor(r / 3600))}:${p2(Math.floor(r / 60) % 60)}:${p2(r % 60)}`;
    return lang === 'zh' ? `1986年4月${day}日 · ${stamp}` : `${day} APR 1986 · ${stamp}`;
  }
  const s = Math.floor(t);
  return `${T('clockElapsed')} ${p2(Math.floor(s / 3600))}:${p2(Math.floor(s / 60) % 60)}:${p2(s % 60)}`;
}
function shortClock(t) {
  if (state.mode === 'scen' || state.scenClock) { const tot = Math.floor(3600 + t), r = tot % 86400; return `${p2(Math.floor(r / 3600))}:${p2(Math.floor(r / 60) % 60)}:${p2(r % 60)}`; }
  const s = Math.floor(t); return `+${p2(Math.floor(s / 3600))}:${p2(Math.floor(s / 60) % 60)}:${p2(s % 60)}`;
}
function p2(n) { return String(n).padStart(2, '0'); }
function fmtMW(mw) {
  if (mw >= 10000) return [(mw / 1000).toFixed(mw >= 100000 ? 0 : 1), 'GW'];
  if (mw >= 100) return [Math.round(mw).toString(), 'MW'];
  if (mw >= 1) return [mw.toFixed(1), 'MW'];
  return [mw.toFixed(2), 'MW'];
}

// ---------- three.js scene ----------
const canvas = $('gl'), stage = $('stage');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (error) {
  showLoadError('无法启动三维视图，请使用支持 WebGL 的浏览器。 / Unable to start the 3D view. Use a WebGL-capable browser.');
  return;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x12140f);
scene.fog = new THREE.Fog(0x12140f, 90, 190);
const camera = new THREE.PerspectiveCamera(34, 1, 0.5, 600);
camera.position.set(-8, 40, 66);
let controls = null;
if (THREE.OrbitControls) {
  controls = new THREE.OrbitControls(camera, canvas);
  controls.target.set(0, 2.5, 0); controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 28; controls.maxDistance = 160; controls.maxPolarAngle = 1.42; controls.enablePan = false;
  controls.autoRotate = state.autoRotate; controls.autoRotateSpeed = 0.35;
  controls.addEventListener('start', () => { controls.autoRotate = false; $('rot').checked = false; state.autoRotate = false; });
} else camera.lookAt(0, 2.5, 0);

scene.add(new THREE.HemisphereLight(0xe2e6cb, 0x0c0e09, 0.6));
const sun = new THREE.DirectionalLight(0xfff2d6, 1.05); sun.position.set(-30, 60, 25); scene.add(sun);
const fill = new THREE.DirectionalLight(0x9fb3a6, 0.25); fill.position.set(40, 20, -30); scene.add(fill);
const fire = new THREE.PointLight(0xff7a33, 0, 140, 1.6); fire.position.set(0, 9, 0); scene.add(fire);

// base, rings, lamp ring
const base = new THREE.Mesh(new THREE.CylinderGeometry(28.6, 29.2, 0.7, 120), new THREE.MeshStandardMaterial({ color: 0x191b14, roughness: 0.9 }));
base.position.y = -0.36; scene.add(base);
function ring(r, tube, color) { const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 200), new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.6 })); m.rotation.x = Math.PI / 2; m.position.y = 0.02; scene.add(m); }
ring(25.4, 0.07, 0x3b3f31); ring(27.9, 0.12, 0x4a4e3d); ring(29.0, 0.06, 0x2f3227);
const NL = 132;
const lampMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.12, 0.42), new THREE.MeshBasicMaterial({ color: 0xffffff }), NL);
{
  const d = new THREE.Object3D(), c = new THREE.Color(0.2, 0.22, 0.15);
  for (let k = 0; k < NL; k++) { const a = k / NL * Math.PI * 2 - Math.PI / 2; d.position.set(26.65 * Math.cos(a), 0.06, 26.65 * Math.sin(a)); d.rotation.y = -a; d.updateMatrix(); lampMesh.setMatrixAt(k, d.matrix); lampMesh.setColorAt(k, c); }
}
scene.add(lampMesh);

// cap texture
function capTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 64);
  x.strokeStyle = 'rgba(0,0,0,0.16)'; x.lineWidth = 5; x.strokeRect(2.5, 2.5, 59, 59);
  x.fillStyle = 'rgba(0,0,0,0.10)'; x.beginPath(); x.arc(32, 32, 10, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#3d3b30'; x.beginPath(); x.arc(32, 32, 5.2, 0, Math.PI * 2); x.fill();
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}
const N = core.N;
const bodyGeo = new THREE.BoxGeometry(0.9, 1, 0.9); bodyGeo.translate(0, 0.5, 0);
const bodyMesh = new THREE.InstancedMesh(bodyGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, metalness: 0.12 }), N);
const capMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.09, 0.9), new THREE.MeshBasicMaterial({ map: capTexture(), color: 0xffffff }), N);
bodyMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); capMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
const BODY = new THREE.Color(0.31, 0.34, 0.25);
const TYPE_COL = [new THREE.Color(0.86, 0.85, 0.72), new THREE.Color(0.86, 0.55, 0.38), new THREE.Color(0.55, 0.66, 0.67), new THREE.Color(0.65, 0.75, 0.57)];
for (let i = 0; i < N; i++) { bodyMesh.setColorAt(i, BODY); capMesh.setColorAt(i, TYPE_COL[core.type[i]]); }
scene.add(bodyMesh); scene.add(capMesh);

// upper biological shield ("Elena") – only shown when it is thrown
const lid = new THREE.Mesh(new THREE.CylinderGeometry(23.5, 23.5, 1.1, 72), new THREE.MeshStandardMaterial({ color: 0x23251d, roughness: 0.85, metalness: 0.3 }));
lid.visible = false; scene.add(lid);

// embers
const NE = 1400;
const emberGeo = new THREE.BufferGeometry();
const ePos = new Float32Array(NE * 3), eVel = new Float32Array(NE * 3), eLife = new Float32Array(NE), eCol = new Float32Array(NE * 3);
emberGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
emberGeo.setAttribute('color', new THREE.BufferAttribute(eCol, 3));
const embers = new THREE.Points(emberGeo, new THREE.PointsMaterial({ size: 0.38, vertexColors: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
embers.visible = false; scene.add(embers);

// bloom
let composer = null, bloom = null;
if (THREE.EffectComposer && THREE.UnrealBloomPass) {
  try {
    composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));
    bloom = new THREE.UnrealBloomPass(new THREE.Vector2(512, 512), 0.32, 0.5, 0.9);
    composer.addPass(bloom);
  } catch (e) { composer = null; }
}

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  if (composer) { composer.setSize(w, h); }
  const narrow = w < 560; camera.fov = narrow ? 44 : 34; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage); resize();

// ---------- per-channel visuals ----------
const hDisp = new Float32Array(N), phase = new Float32Array(N);
for (let i = 0; i < N; i++) { hDisp[i] = 3; phase[i] = Math.random() * 6.283; }
// debris state
const dPos = new Float32Array(N * 3), dVel = new Float32Array(N * 3), dRot = new Float32Array(N * 2), dAng = new Float32Array(N * 2);
const cPos = new Float32Array(N * 3), cVel = new Float32Array(N * 3), cRot = new Float32Array(N * 2), cAng = new Float32Array(N * 2);
const tmpC = new THREE.Color(), dummy = new THREE.Object3D();

const RAMP = [[0.16, 0.19, 0.14], [0.33, 0.42, 0.31], [0.85, 0.66, 0.3], [1.0, 0.38, 0.16], [1.0, 0.95, 0.82]];
function ramp(u, out) {
  u = clamp(u, 0, 1) * (RAMP.length - 1); const k = Math.min(RAMP.length - 2, Math.floor(u)), f = u - k, a = RAMP[k], b = RAMP[k + 1];
  out.setRGB(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f); return out;
}
function heightFor(i) { const q = core.P * Math.pow(core.s[i], 2.2); return Math.min(15, 0.6 + 7 * Math.log10(1 + 3 * q)); }
function channelT(i) { return core.type[i] === TYPE.FUEL ? core.T[i] : TC; }

function startExplosion() {
  state.explodeT = 0;
  for (let i = 0; i < N; i++) {
    const x = core.cx[i], z = core.cy[i], r = Math.hypot(x, z) + 0.01, ux = x / r, uz = z / r;
    const kick = 0.45 + 0.55 * clamp(core.s[i] - 0.5, 0, 1) + (core.rupt[i] ? 0.5 : 0);
    dPos[i * 3] = x; dPos[i * 3 + 1] = 0; dPos[i * 3 + 2] = z;
    dVel[i * 3] = ux * (2 + 7 * Math.random()) + (Math.random() - 0.5) * 3;
    dVel[i * 3 + 1] = (4 + 20 * Math.random()) * kick;
    dVel[i * 3 + 2] = uz * (2 + 7 * Math.random()) + (Math.random() - 0.5) * 3;
    dRot[i * 2] = dRot[i * 2 + 1] = 0; dAng[i * 2] = (Math.random() - 0.5) * 6; dAng[i * 2 + 1] = (Math.random() - 0.5) * 6;
    cPos[i * 3] = x; cPos[i * 3 + 1] = hDisp[i]; cPos[i * 3 + 2] = z;
    cVel[i * 3] = dVel[i * 3] * 1.6; cVel[i * 3 + 1] = dVel[i * 3 + 1] * 1.5 + 6; cVel[i * 3 + 2] = dVel[i * 3 + 2] * 1.6;
    cRot[i * 2] = cRot[i * 2 + 1] = 0; cAng[i * 2] = (Math.random() - 0.5) * 14; cAng[i * 2 + 1] = (Math.random() - 0.5) * 14;
  }
  lid.visible = true; lid.position.set(0, 9, 0); lid.rotation.set(0, 0, 0);
  embers.visible = true;
  for (let k = 0; k < NE; k++) spawnEmber(k, true);
  $('flash').style.transition = 'none'; $('flash').style.opacity = reduceMotion ? '0.35' : '0.95';
  requestAnimationFrame(() => { $('flash').style.transition = 'opacity 2.4s ease-out'; $('flash').style.opacity = '0'; });
}
function spawnEmber(k, burst) {
  const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * 20;
  ePos[k * 3] = r * Math.cos(a); ePos[k * 3 + 1] = burst ? 2 + Math.random() * 6 : 0.5 + Math.random() * 2; ePos[k * 3 + 2] = r * Math.sin(a);
  const sp = burst ? 18 : 3;
  eVel[k * 3] = (Math.random() - 0.5) * sp * 0.6 + (burst ? Math.cos(a) * 6 : 0); eVel[k * 3 + 1] = (burst ? 10 : 2) + Math.random() * sp; eVel[k * 3 + 2] = (Math.random() - 0.5) * sp * 0.6 + (burst ? Math.sin(a) * 6 : 0);
  eLife[k] = (burst ? 1.5 : 2.5) + Math.random() * 3;
  const w = Math.random(); eCol[k * 3] = 1; eCol[k * 3 + 1] = 0.35 + 0.45 * w; eCol[k * 3 + 2] = 0.1 + 0.25 * w * w;
}
function resetVisuals() {
  state.explodeT = -1; lid.visible = false; embers.visible = false; fire.intensity = 0;
  for (let i = 0; i < N; i++) hDisp[i] = heightFor(i);
}

function updateChannels(dt, time) {
  const bm = bodyMesh.instanceMatrix.array, cm = capMesh.instanceMatrix.array;
  const bc = bodyMesh.instanceColor.array, cc = capMesh.instanceColor.array;
  const mode = state.colorMode;
  const exploding = state.explodeT >= 0;
  const P = core.P;
  const dance = P > 1.6 && !exploding ? Math.min(1.4, 0.18 * Math.log(P)) : 0;
  for (let i = 0; i < N; i++) {
    const Tch = channelT(i), isFuel = core.type[i] === TYPE.FUEL;
    const hot = exploding ? clamp((Tch - 900) / 1400, 0, 1) * (0.75 + 0.25 * Math.sin(time * 3 + phase[i])) : clamp((Tch - 950) / 1500, 0, 1);
    // colours
    if (mode === 'type' || !isFuel) {
      const b = TYPE_COL[core.type[i]];
      tmpC.setRGB(b.r + (1.0 - b.r) * hot, b.g + (0.5 - b.g) * hot, b.b + (0.18 - b.b) * hot).multiplyScalar(1 + 0.6 * hot * hot);
    } else if (mode === 'temp') { ramp((Tch - TC) / 2200, tmpC).multiplyScalar(1 + hot); }
    else if (mode === 'void') { ramp(core.v[i] / 0.85, tmpC); }
    else { ramp(core.X[i] / 2.0, tmpC); }
    if (core.rupt[i] && !exploding) tmpC.setRGB(1.6, 0.6, 0.25);
    cc[i * 3] = tmpC.r; cc[i * 3 + 1] = tmpC.g; cc[i * 3 + 2] = tmpC.b;
    bc[i * 3] = BODY.r + 2.0 * hot * hot; bc[i * 3 + 1] = BODY.g + 0.45 * hot * hot; bc[i * 3 + 2] = BODY.b + 0.05 * hot;

    if (!exploding) {
      const ht = heightFor(i);
      hDisp[i] += (ht - hDisp[i]) * (1 - Math.exp(-dt * (ht > hDisp[i] ? 9 : 4)));
      const h = hDisp[i], x = core.cx[i], z = core.cy[i];
      let o = i * 16;
      bm[o] = 1; bm[o + 1] = 0; bm[o + 2] = 0; bm[o + 3] = 0; bm[o + 4] = 0; bm[o + 5] = h; bm[o + 6] = 0; bm[o + 7] = 0; bm[o + 8] = 0; bm[o + 9] = 0; bm[o + 10] = 1; bm[o + 11] = 0; bm[o + 12] = x; bm[o + 13] = 0; bm[o + 14] = z; bm[o + 15] = 1;
      let jump = 0;
      if (dance && isFuel) jump = dance * core.v[i] * Math.abs(Math.sin(time * 17 + phase[i] * 3));
      if (core.rupt[i]) jump = 0.6 + 1.6 * Math.abs(Math.sin(time * 11 + phase[i]));
      cm[o] = 1; cm[o + 1] = 0; cm[o + 2] = 0; cm[o + 3] = 0; cm[o + 4] = 0; cm[o + 5] = 1; cm[o + 6] = 0; cm[o + 7] = 0; cm[o + 8] = 0; cm[o + 9] = 0; cm[o + 10] = 1; cm[o + 11] = 0; cm[o + 12] = x; cm[o + 13] = h + 0.045 + jump; cm[o + 14] = z; cm[o + 15] = 1;
    } else {
      // debris physics
      debris(i, dPos, dVel, dRot, dAng, false, bm, dt);
      debris(i, cPos, cVel, cRot, cAng, true, cm, dt);
    }
  }
  bodyMesh.instanceMatrix.needsUpdate = true; capMesh.instanceMatrix.needsUpdate = true;
  bodyMesh.instanceColor.needsUpdate = true; capMesh.instanceColor.needsUpdate = true;
}

function debris(i, pos, vel, rot, ang, isCap, out, dt) {
  const k3 = i * 3, k2 = i * 2;
  vel[k3 + 1] -= 30 * dt; pos[k3] += vel[k3] * dt; pos[k3 + 1] += vel[k3 + 1] * dt; pos[k3 + 2] += vel[k3 + 2] * dt;
  rot[k2] += ang[k2] * dt; rot[k2 + 1] += ang[k2 + 1] * dt;
  const floor = isCap ? 0.05 : 0;
  if (pos[k3 + 1] < floor) { pos[k3 + 1] = floor; if (vel[k3 + 1] < 0) vel[k3 + 1] *= -0.22; vel[k3] *= 0.55; vel[k3 + 2] *= 0.55; ang[k2] *= 0.5; ang[k2 + 1] *= 0.5; }
  dummy.position.set(pos[k3], pos[k3 + 1], pos[k3 + 2]);
  dummy.rotation.set(rot[k2], 0, rot[k2 + 1]);
  dummy.scale.set(1, isCap ? 1 : Math.max(0.6, hDisp[i] * 0.55), 1);
  dummy.updateMatrix();
  dummy.matrix.toArray(out, i * 16);
}

function updateLamps() {
  const mw = core.destroyed ? 0 : core.MW;
  const f = clamp(Math.log10(Math.max(mw, 1)) / 5, 0, 1), lit = Math.round(f * NL), nomK = Math.round(Math.log10(NOMINAL_MW) / 5 * NL);
  const a = lampMesh.instanceColor.array;
  for (let k = 0; k < NL; k++) {
    let r = 0.2, g = 0.22, b = 0.15;
    if (k < lit) { if (k >= nomK) { r = 1.4; g = 0.35; b = 0.2; } else { r = 0.98; g = 0.86; b = 0.48; } }
    else if (k === nomK) { r = 0.45; g = 0.3; b = 0.2; }
    a[k * 3] = r; a[k * 3 + 1] = g; a[k * 3 + 2] = b;
  }
  lampMesh.instanceColor.needsUpdate = true;
}

function updateExplosion(dt, time) {
  if (state.explodeT < 0) return;
  state.explodeT += dt;
  const t = state.explodeT;
  // lid: thrown up, flips, lands tilted on the debris
  if (t < 2.2) { lid.position.y = t < 1 ? 9 + 26 * t - 13 * t * t : 22 - (t - 1) * 0.9; lid.position.z = -10 * Math.min(1, t / 2.2); lid.rotation.x = -Math.min(1.25, 0.6 * t * t); lid.rotation.z = 0.12 * t; }
  else { lid.position.set(0, 21, -10); lid.rotation.x = -1.25; }
  // embers rise forever (graphite fire)
  for (let k = 0; k < NE; k++) {
    eLife[k] -= dt;
    if (eLife[k] <= 0) { spawnEmber(k, false); continue; }
    eVel[k * 3 + 1] += (t < 3 ? -9 : 1.2) * dt;
    ePos[k * 3] += eVel[k * 3] * dt + Math.sin(time + k) * 0.01; ePos[k * 3 + 1] += eVel[k * 3 + 1] * dt; ePos[k * 3 + 2] += eVel[k * 3 + 2] * dt;
    if (ePos[k * 3 + 1] < 0) { ePos[k * 3 + 1] = 0; eVel[k * 3 + 1] *= -0.3; }
  }
  emberGeo.attributes.position.needsUpdate = true; emberGeo.attributes.color.needsUpdate = true;
  fire.intensity = 1.6 + 0.6 * Math.sin(time * 7) * Math.sin(time * 3.1) + (t < 1 ? 6 * (1 - t) : 0);
  if (bloom) bloom.strength = 0.45 + (t < 1.5 ? 0.9 * (1 - t / 1.5) : 0) + 0.06 * Math.sin(time * 5);
  if (!reduceMotion && t < 1.6) { const s = 0.9 * (1 - t / 1.6); camera.position.x += (Math.random() - 0.5) * s; camera.position.y += (Math.random() - 0.5) * s; }
}

// ---------- tooltip (hover a channel) ----------
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
let tipTimer = 0, pointer = null;
canvas.addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect(); pointer = { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height, type: e.pointerType }; });
canvas.addEventListener('pointerleave', () => { pointer = null; $('tip').hidden = true; });
function updateTip(now) {
  if (!pointer || pointer.type === 'touch' || now - tipTimer < 90) return; tipTimer = now;
  if (state.explodeT >= 0) { $('tip').hidden = true; return; }
  mouse.set(pointer.x / pointer.w * 2 - 1, -pointer.y / pointer.h * 2 + 1); ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObject(capMesh, false)[0] || ray.intersectObject(bodyMesh, false)[0];
  if (!hit || hit.instanceId === undefined) { $('tip').hidden = true; return; }
  const i = hit.instanceId, ty = core.type[i];
  const name = T(['tipFuel', 'tipRR', 'tipUSP', 'tipAR'][ty]);
  const coord = `${p2(core.cy[i] + 26)}-${p2(core.cx[i] + 26)}`;
  const q = core.P * core.s[i] * NOMINAL_MW / core.Nf;
  let rows = `<dt>${T('tipFlux')}</dt><dd>${core.s[i].toFixed(2)}</dd>`;
  if (ty === TYPE.FUEL) rows += `<dt>${T('tipPower')}</dt><dd>${q >= 100 ? q.toFixed(0) : q.toFixed(2)} MW</dd><dt>${T('tipFuelTemp')}</dt><dd>${Math.round(core.T[i])} K</dd><dt>${T('tipVoid')}</dt><dd>${Math.round(core.v[i] * 100)}%</dd><dt>Xenon</dt><dd>${core.X[i].toFixed(2)}×</dd>`;
  else { const j = core.rods.indexOf(i); rows += `<dt>${T('tipInsertion')}</dt><dd>${Math.round(core.rodX[j] * 100)}%</dd>`; }
  if (core.rupt[i]) rows += `<dt>${T('tipStatus')}</dt><dd style="color:var(--alarm)">${T('tipRuptured')}</dd>`;
  const tip = $('tip'); tip.innerHTML = `<b>${name} ${coord}</b><dl>${rows}</dl>`; tip.hidden = false;
  const tx = Math.min(pointer.x, pointer.w - 200), ty2 = Math.min(pointer.y, pointer.h - 150);
  tip.style.left = tx + 'px'; tip.style.top = ty2 + 'px';
}

// ---------- legend ----------
function renderLegend() {
  const L = $('legend');
  if (state.colorMode === 'type') {
    const sw = (c, t) => `<span><i style="background:rgb(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0})"></i>${t}</span>`;
    L.innerHTML = sw(TYPE_COL[0], T('typeFuel')(core.Nf)) + sw(TYPE_COL[1], T('typeRR')(core.nFuelType.RR)) + sw(TYPE_COL[2], T('typeUSP')(core.nFuelType.USP)) + sw(TYPE_COL[3], T('typeAR')(core.nFuelType.AR));
  } else {
    const stops = RAMP.map((c, k) => `rgb(${c.map(v => Math.min(255, v * 255 | 0)).join(',')}) ${k / (RAMP.length - 1) * 100}%`).join(',');
    const [lo, hi, name] = state.colorMode === 'temp' ? ['557 K', '2750 K', T('legendTemp')] : state.colorMode === 'void' ? ['0%', '85%', T('legendVoid')] : ['0', T('legendXeEq'), T('legendXe')];
    L.innerHTML = `<span>${name}</span><span>${lo}<i class="ramp" style="background:linear-gradient(90deg,${stops})"></i>${hi}</span>`;
  }
}

// ---------- recorder ----------
const rec = $('rec'), rctx = rec.getContext('2d'); const hist = []; let histT = 0;
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function drawRecorder() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), w = rec.clientWidth, h = rec.clientHeight;
  if (rec.width !== Math.round(w * dpr)) { rec.width = Math.round(w * dpr); rec.height = Math.round(h * dpr); }
  rctx.setTransform(dpr, 0, 0, dpr, 0, 0); rctx.clearRect(0, 0, w, h);
  const L = 40, R = 6, PAD_T = 8, B = 8, ymax = 5.5, y = v => PAD_T + (h - PAD_T - B) * (1 - clamp(v, 0, ymax) / ymax);
  rctx.font = '11px "Share Tech Mono", monospace'; rctx.textBaseline = 'middle';
  const grid = [[0, T('rec1MW')], [2, T('rec100MW')], [4, T('rec10GW')]];
  for (const [v, lab] of grid) { rctx.strokeStyle = css('--line'); rctx.lineWidth = 1; rctx.beginPath(); rctx.moveTo(L, y(v) + 0.5); rctx.lineTo(w - R, y(v) + 0.5); rctx.stroke(); rctx.fillStyle = css('--dim'); rctx.fillText(lab, 2, y(v)); }
  const nom = Math.log10(NOMINAL_MW); rctx.setLineDash([3, 3]); rctx.strokeStyle = css('--muted'); rctx.beginPath(); rctx.moveTo(L, y(nom) + 0.5); rctx.lineTo(w - R, y(nom) + 0.5); rctx.stroke(); rctx.setLineDash([]);
  rctx.fillStyle = css('--muted'); rctx.fillText(T('recNominal'), w - R - (lang === 'zh' ? 30 : 46), y(nom) - 7);
  if (hist.length < 2) return;
  const n = 300, x = k => L + (w - L - R) * (k + (n - hist.length)) / (n - 1);
  rctx.beginPath(); hist.forEach((v, k) => { k ? rctx.lineTo(x(k), y(v)) : rctx.moveTo(x(k), y(v)); });
  const last = hist[hist.length - 1];
  rctx.strokeStyle = last > nom + 0.08 ? css('--alarm') : css('--amber'); rctx.lineWidth = 1.6; rctx.stroke();
  rctx.lineTo(x(hist.length - 1), h - B); rctx.lineTo(x(0), h - B); rctx.closePath(); rctx.fillStyle = 'rgba(233,180,82,0.08)'; rctx.fill();
  rctx.fillStyle = rctx.strokeStyle; rctx.beginPath(); rctx.arc(x(hist.length - 1), y(last), 2.6, 0, 6.283); rctx.fill();
}

// ---------- log ----------
function pushLog(e) {
  const li = document.createElement('li'); li.dataset.l = e.level; li._e = e;
  li.innerHTML = `<time>${shortClock(e.t)}</time><span></span>`; li.querySelector('span').textContent = evLine(e);
  $('log').prepend(li);
  while ($('log').children.length > 60) $('log').lastChild.remove();
  if (state.mode === 'scen') setNarr(evLine(e), e);
}

// ---------- scenario ----------
function renderSteps() {
  $('steps').innerHTML = MILESTONES.map(m => {
    const tot = 3600 + m.t, r = tot % 86400, d = 25 + Math.floor(tot / 86400);
    const stamp = `${lang === 'zh' ? `${d}日 ` : `${d} Apr `}${p2(Math.floor(r / 3600))}:${p2(Math.floor(r / 60) % 60)}${m.t > 87700 ? ':' + p2(r % 60) : ''}`;
    return `<li><time>${stamp}</time><span>${MS[m.label] ? T(MS[m.label]) : m.label}</span></li>`;
  }).join('');
}
function updateSteps() {
  const lis = $('steps').children; let cur = -1;
  for (let k = 0; k < MILESTONES.length; k++) if (core.t >= MILESTONES[k].t) cur = k;
  for (let k = 0; k < lis.length; k++) lis[k].dataset.s = k < cur ? 'done' : k === cur ? 'now' : '';
}
renderSteps();

function setMode(m, keepState) {
  state.mode = m;
  $('m-free').setAttribute('aria-pressed', m === 'free'); $('m-scen').setAttribute('aria-pressed', m === 'scen');
  $('scenbox').hidden = m !== 'scen';
  $('controls').disabled = m === 'scen';
  if (m === 'scen' && !keepState) {
    resetAll();
    state.scenClock = true;
    core.operatorAssist = true;
    state.scen = { i: 0, warp: 3600 };
    setWarp(3600);
    setNarr(T('p4in'));
  }
  if (m === 'free') {
    state.scen = null; core.operatorAssist = false;
    if (!keepState) { resetAll(); state.scenClock = false; setWarp(1); }
    syncControls();
  }
}
$('m-free').onclick = () => { if (state.mode !== 'free') setMode('free', false); };
$('m-scen').onclick = () => setMode('scen', false);
$('takeover').onclick = () => { setMode('free', true); };
$('skip').onclick = () => { if (state.scen) { state.skipping = true; setWarp(3600); } };

// ---------- controls ----------
const spToMW = v => Math.pow(10, 1 + Math.log10(NOMINAL_MW / 10) * v / 1000);
const mwToSp = mw => Math.round(1000 * Math.log10(mw / 10) / Math.log10(NOMINAL_MW / 10));
function syncControls() {
  $('ar').checked = core.arOn;
  $('sp').value = mwToSp(clamp(core.setpoint * NOMINAL_MW, 10, NOMINAL_MW)); $('o-sp').textContent = Math.round(spToMW(+$('sp').value)) + ' MW';
  const rr = Math.round(core.groupMean(TYPE.RR, core.rodTgt) * 100), us = Math.round(core.groupMean(TYPE.USP, core.rodTgt) * 100);
  $('rr').value = rr; $('o-rr').textContent = T('pctIn')(rr); $('usp').value = us; $('o-usp').textContent = T('pctIn')(us);
  $('o-pumps').textContent = core.flowPumps; $('sub').value = core.subC; $('o-sub').textContent = core.subC.toFixed(1).replace('.0', '') + ' °C';
}
$('ar').onchange = e => { core.arOn = e.target.checked; };
$('sp').oninput = e => { const mw = spToMW(+e.target.value); core.setpoint = mw / NOMINAL_MW; $('o-sp').textContent = Math.round(mw) + ' MW'; };
$('rr').oninput = e => { core.setGroup(TYPE.RR, e.target.value / 100); $('o-rr').textContent = T('pctIn')(e.target.value); };
$('usp').oninput = e => { core.setGroup(TYPE.USP, e.target.value / 100); $('o-usp').textContent = T('pctIn')(e.target.value); };
$('p-dn').onclick = () => { core.flowPumps = Math.max(4, core.flowPumps - 1); $('o-pumps').textContent = core.flowPumps; };
$('p-up').onclick = () => { core.flowPumps = Math.min(8, core.flowPumps + 1); $('o-pumps').textContent = core.flowPumps; };
$('sub').oninput = e => { core.subC = +e.target.value; $('o-sub').textContent = (+e.target.value).toFixed(1).replace('.0', '') + ' °C'; };
$('rundown').onclick = () => core.startCoastdown(Math.floor(core.flowPumps / 2));
$('az5').onclick = () => core.az5();
$('reset').onclick = () => { setMode(state.mode, false); };
$('cmode').onchange = e => { state.colorMode = e.target.value; renderLegend(); };
$('rot').onchange = e => { state.autoRotate = e.target.checked; if (controls) controls.autoRotate = e.target.checked; };
function setWarp(w) {
  state.warp = w;
  for (const b of $('warps').children) b.setAttribute('aria-pressed', +b.dataset.w === w);
}
for (const b of $('warps').children) b.onclick = () => { state.skipping = false; setWarp(+b.dataset.w); };

function resetAll() {
  core.reset(); core.events.length = 0; $('log').innerHTML = ''; hist.length = 0; simDebt = 0;
  resetVisuals(); if (bloom) bloom.strength = 0.32; state.destroyedShown = false;
  syncControls(); narrEvent = null; narrKey = state.mode === 'scen' ? 'narrIntro' : null;
  if (state.mode === 'scen') $('narr').textContent = T('narrIntro');
  renderSteps();
}

// ---------- instruments ----------
function setTile(id, s) { $(id).dataset.s = s || ''; }
function lamp(id, on) { $(id).dataset.on = on || ''; }
function updateInstruments() {
  const mw = core.destroyed ? 0 : core.MW, [pv, pu] = fmtMW(mw);
  $('bigpower').innerHTML = core.destroyed ? `${T('bigDestroyed')}<small>${T('bigNoReadings')}</small>` : `${pv}<small>${pu} ${T('mwThermal')}</small>`;
  $('clock').textContent = fmtClock(core.t);
  $('simclock').textContent = state.warp === 0 ? T('clockPaused') : '';
  $('v-pow').innerHTML = core.destroyed ? '—' : `${pv}<small>${pu}</small>`;
  $('b-pow').style.width = clamp(Math.log10(Math.max(mw, 1)) / 5, 0, 1) * 100 + '%';
  setTile('t-pow', core.destroyed || core.P > 3 ? 'crit' : core.P > 1.1 ? 'warn' : '');
  const r$ = core.rho / BETA;
  $('v-rho').innerHTML = core.destroyed ? '—' : `${r$ >= 0.005 ? '+' : r$ <= -0.005 ? '−' : ''}${Math.abs(r$).toFixed(2)}<small>$</small>`;
  const rb = $('b-rho'); const rc = clamp(r$, -2, 2); rb.style.left = (rc < 0 ? 50 + rc * 25 : 50) + '%'; rb.style.width = Math.abs(rc) * 25 + '%'; rb.style.background = r$ > 1 ? 'var(--alarm)' : 'var(--amber)';
  setTile('t-rho', r$ > 1 ? 'crit' : r$ > 0.3 ? 'warn' : '');
  const w = core.omega;
  $('v-per').innerHTML = core.destroyed ? '—' : Math.abs(w) < 1e-3 ? '∞' : `${w > 0 ? '+' : '−'}${Math.abs(1 / w) >= 100 ? Math.round(Math.abs(1 / w)) : Math.abs(1 / w).toFixed(1)}<small>s</small>`;
  setTile('t-per', w > 0.05 ? 'crit' : w > 0.02 ? 'warn' : '');
  $('v-orm').innerHTML = `${core.ORM.toFixed(1)}<small>${T('rods')}</small>`; $('b-orm').style.width = clamp(core.ORM / 40, 0, 1) * 100 + '%';
  setTile('t-orm', !core.scram && core.ORM < 15 ? 'crit' : !core.scram && core.ORM < 26 ? 'warn' : '');
  $('v-void').innerHTML = `${Math.round(core.vMean * 100)}<small>%</small>`;
  $('v-temp').innerHTML = `${Math.round(core.Tmax)}<small>K</small>`; setTile('t-temp', core.Tmax > 2200 ? 'crit' : core.Tmax > 1500 ? 'warn' : '');
  $('v-xe').innerHTML = `${core.XW.toFixed(2)}<small>${T('xeEq')}</small>`; setTile('t-xe', core.XW > 1.15 ? 'warn' : '');
  $('v-flow').innerHTML = `${Math.round(core.flow * 100)}<small>%</small>`; setTile('t-flow', core.flow < 0.85 ? 'warn' : '');
  $('h-rr').textContent = T('outWin')(core.rodsOut(), core.nFuelType.RR);
  lamp('L-orm', !core.scram && core.ORM < 15 ? 'crit' : '');
  lamp('L-ar', core.arOn && !core.scram && (core.arMean < 0.02 || core.arMean > 0.98) ? 'warn' : '');
  lamp('L-flow', core.flow < 0.85 ? 'warn' : '');
  lamp('L-scram', core.scram ? 'warn' : '');
  lamp('L-prompt', r$ > 1 && !core.destroyed ? 'crit' : '');
  lamp('L-fuel', core.Tmax > 2200 ? 'crit' : '');
  lamp('L-rupt', core.ruptCount > 0 ? 'crit' : '');
  lamp('L-dead', core.destroyed ? 'crit' : '');
  const chip = $('chip');
  let cs = 'ok', ct = T('chipOk');
  if (core.destroyed) { cs = 'dead'; ct = T('chipDead'); }
  else if (core.ruptCount > 0) { cs = 'crit'; ct = T('chipRupt'); }
  else if (r$ > 1) { cs = 'crit'; ct = T('chipPrompt'); }
  else if (core.scram) { cs = 'warn'; ct = T('chipScram'); }
  else if (core.P > 1.15) { cs = 'warn'; ct = T('chipOver'); }
  else if (core.ORM < 15) { cs = 'warn'; ct = T('chipMargin'); }
  else if (core.P < 0.22) { cs = 'warn'; ct = T('chipLow'); }
  chip.dataset.s = cs; chip.textContent = ct;
  $('az5').disabled = core.scram || core.destroyed;
  $('rundown').disabled = !!core.coast || core.destroyed;
  $('takeover').disabled = core.destroyed;
  $('skip').disabled = core.destroyed || core.scram || !state.scen || state.scen.i >= RBMK.SCENARIO.length;
  if (state.mode === 'scen') updateSteps();
}

// ---------- main loop ----------
let last = performance.now(), simDebt = 0, uiTimer = 0, slow = false;
function frame(now) {
  const realDt = Math.min(0.1, (now - last) / 1000); last = now;
  // simulation
  let warp = state.warp;
  slow = !core.destroyed && warp > 0 && (core.rho > 0.6 * BETA || core.omega > 0.4 || (core.P > 2 && core.omega > 0.05));
  if (slow) warp = Math.min(warp, 0.25);
  simDebt += warp * realDt;
  const t0 = performance.now(); let steps = 0;
  while (simDebt > 0 && performance.now() - t0 < 11 && steps < 500) {
    if (state.scen) {
      const before = state.scen.i;
      scenarioUpdate(core, state.scen);
      if (state.scen.i !== before) { if (state.skipping && state.scen.i !== before) state.skipping = false; setWarp(state.scen.warp); warp = Math.min(warp, state.scen.warp); simDebt = Math.min(simDebt, warp * realDt); }
    }
    const dt = Math.min(core.suggestDt(), Math.max(0.002, warp / 30));
    core.step(dt); simDebt -= dt; steps++;
    while (core.events.length) pushLog(core.events.shift());
    if (core.destroyed && !state.destroyedShown) { state.destroyedShown = true; startExplosion(); simDebt = 0; break; }
  }
  if (simDebt > 0) simDebt = 0;
  $('slowmo').hidden = !slow;

  // visuals
  const time = now / 1000;
  updateChannels(realDt, time);
  updateExplosion(realDt, time);
  updateLamps();
  if (controls) controls.update();
  if (composer) composer.render(); else renderer.render(scene, camera);
  updateTip(now);
  histT += realDt;
  if (histT >= 0.1) { histT = 0; hist.push(core.destroyed ? 0 : Math.log10(Math.max(core.MW, 0.5))); if (hist.length > 300) hist.shift(); }
  uiTimer += realDt;
  if (uiTimer > 0.07) { uiTimer = 0; updateInstruments(); drawRecorder(); }
  requestAnimationFrame(frame);
}

resetVisuals(); renderLegend(); syncControls(); applyStatic();
setMode('scen', false); updateInstruments();
requestAnimationFrame(frame);
})();
