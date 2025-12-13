import { clampVelocity, gamma, lorentzTransform, rapidity, velocityTransform } from "./lorentz.js";

export function setupUI(diagram) {
  const vInput = mustGet("v");
  const vText = mustGet("vText");
  const gammaText = mustGet("gammaText");

  const showHyperbolas = mustGet("showHyperbolas");
  const showTPrimeCone = mustGet("showTPrimeCone");
  const hyperbolaA = mustGet("hyperbolaA");
  const rapidityText = mustGet("rapidityText");

  const uInput = mustGet("u");
  const uText = mustGet("uText");
  const uPrimeText = mustGet("uPrimeText");
  const dxPrimeText = mustGet("dxPrimeText");
  const dtPrimeText = mustGet("dtPrimeText");

  const eventX = mustGet("eventX");
  const eventT = mustGet("eventT");
  const eventXp = mustGet("eventXp");
  const eventTp = mustGet("eventTp");
  const s2 = mustGet("s2");
  const s2p = mustGet("s2p");

  const showPrimeGrid = mustGet("showPrimeGrid");
  const showSuperluminal = mustGet("showSuperluminal");

  function syncVelocity() {
    const v = clampVelocity(Number(vInput.value), 0.999);
    diagram.setVelocity(v);
    vText.textContent = `v/c = ${v.toFixed(2)}`;
    gammaText.textContent = gamma(v).toFixed(3);
    rapidityText.textContent = rapidity(v).toFixed(3);
    syncEventReadout();
    syncVelocityTransformReadout();
  }

  function syncEventReadout() {
    const x = Number(eventX.value);
    const t = Number(eventT.value);
    diagram.setEvent(x, t);
    const info = diagram.getEventInfo();
    eventXp.textContent = info.xPrime.toFixed(3);
    eventTp.textContent = info.tPrime.toFixed(3);
    s2.textContent = info.s2.toFixed(3);
    s2p.textContent = info.s2Prime.toFixed(3);
  }

  function syncHyperbolaControls() {
    diagram.setHyperbolasVisible(showHyperbolas.checked);
    diagram.setTPrimeConeVisible(showTPrimeCone.checked);
    diagram.setHyperbolaScale(Number(hyperbolaA.value));
  }

  function syncVelocityTransformReadout() {
    const v = clampVelocity(Number(vInput.value), 0.999);
    const u = clampVelocity(Number(uInput.value), 1);
    diagram.setParticleVelocity(u);

    uText.textContent = `u/c = ${u.toFixed(2)}`;
    const up = velocityTransform(u, v);
    uPrimeText.textContent = up.toFixed(3);

    const delta = lorentzTransform({ x: u, t: 1 }, v);
    dxPrimeText.textContent = delta.x.toFixed(3);
    dtPrimeText.textContent = delta.t.toFixed(3);
  }

  vInput.addEventListener("input", syncVelocity);
  uInput.addEventListener("input", syncVelocityTransformReadout);
  eventX.addEventListener("input", syncEventReadout);
  eventT.addEventListener("input", syncEventReadout);

  showHyperbolas.addEventListener("change", syncHyperbolaControls);
  showTPrimeCone.addEventListener("change", syncHyperbolaControls);
  hyperbolaA.addEventListener("input", syncHyperbolaControls);

  showPrimeGrid.addEventListener("change", () => diagram.setPrimeGridVisible(showPrimeGrid.checked));
  showSuperluminal.addEventListener("change", () => diagram.setSuperluminalVisible(showSuperluminal.checked));

  syncVelocity();
  syncHyperbolaControls();
  syncVelocityTransformReadout();
  diagram.setPrimeGridVisible(showPrimeGrid.checked);
  diagram.setSuperluminalVisible(showSuperluminal.checked);
}

function mustGet(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}
