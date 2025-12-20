document.addEventListener('DOMContentLoaded', () => {
  const coreMassInput = document.getElementById('coreMass');
  const massUnitSelect = document.getElementById('massUnit');
  const maxSpeedInput = document.getElementById('maxSpeed');
  const speedUnitSelect = document.getElementById('speedUnit');
  const speedSlider = document.getElementById('speedSlider');
  const calcBtn = document.getElementById('calcBtn');
  const resultsPanel = document.getElementById('resultsPanel');
  const errorMsg = document.getElementById('errorMsg');

  // Outputs
  const massRatioEl = document.getElementById('massRatio');
  const totalMassEl = document.getElementById('totalMass');
  const totalMassUnitEl = document.getElementById('totalMassUnit');
  const fuelMassEl = document.getElementById('fuelMass');
  const fuelMassUnitEl = document.getElementById('fuelMassUnit');
  const energyJoulesEl = document.getElementById('energyJoules');
  const energyTNTEl = document.getElementById('energyTNT');

  const C = 299792458; // m/s

  // Sync slider and input
  speedSlider.addEventListener('input', (e) => {
    if (speedUnitSelect.value === 'c') {
      maxSpeedInput.value = e.target.value;
    } else {
      // If km/s, convert c ratio to km/s
      maxSpeedInput.value = (e.target.value * C / 1000).toFixed(0);
    }
  });

  maxSpeedInput.addEventListener('input', (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val)) return;

    if (speedUnitSelect.value === 'c') {
      if (val >= 1) val = 0.9999;
      speedSlider.value = val;
    } else {
      let cVal = (val * 1000) / C;
      if (cVal >= 1) cVal = 0.9999;
      speedSlider.value = cVal;
    }
  });

  speedUnitSelect.addEventListener('change', () => {
    // When unit changes, update input value to match current slider position (which holds beta)
    const beta = parseFloat(speedSlider.value);
    if (speedUnitSelect.value === 'c') {
      maxSpeedInput.value = beta.toFixed(4);
      maxSpeedInput.max = 0.99999;
      maxSpeedInput.step = 0.01;
    } else {
      maxSpeedInput.value = (beta * C / 1000).toFixed(0);
      maxSpeedInput.max = C / 1000; // technically a bit less
      maxSpeedInput.step = 100;
    }
  });

  calcBtn.addEventListener('click', calculate);

  function calculate() {
    errorMsg.style.display = 'none';
    resultsPanel.style.display = 'none';

    try {
      const M_core = parseFloat(coreMassInput.value);
      const M_unit = massUnitSelect.value;
      let v = parseFloat(maxSpeedInput.value);
      
      if (isNaN(M_core) || M_core <= 0) throw new Error("请输入有效的核心物质质量");
      if (isNaN(v) || v < 0) throw new Error("请输入有效的速度");

      // Normalize v to beta (v/c)
      let beta = 0;
      if (speedUnitSelect.value === 'kms') {
        const v_m_s = v * 1000;
        if (v_m_s >= C) throw new Error("速度不能超过或等于光速 (c)");
        beta = v_m_s / C;
      } else {
        if (v >= 1) throw new Error("速度不能超过或等于光速");
        beta = v;
      }

      // Calculate Ratio R = (1+beta)/(1-beta) for round trip (accel + decel)
      // Wait, let's re-read the derivation provided by user.
      // Launch mass M0. Final mass M_core.
      // Phase 1: M0 -> M1 (accel to v).
      // Phase 2: M1 -> M_core (decel from v to 0).
      // Logic from user: Total Ratio R = (Phase 1 Ratio) * (Phase 2 Ratio)
      // Ratio for single change 0->v or v->0 is sqrt((1+beta)/(1-beta)).
      // Oh wait, user derivation said:
      // "对于单次加速过程... 初始质量 M0 与末态质量 M1 的比值为 sqrt((1+beta)/(1-beta))"
      // NO, let me check standard relativistic rocket equation.
      // Delta_v = c * tanh( (m0/m1) ) -> WRONG.
      // Correct: Delta_v = c * ln(m0/m1) is classical.
      // Relativistic: M0/M1 = exp(arctanh(v/c)).
      // Let's check math: arctanh(beta) = 0.5 * ln((1+beta)/(1-beta)).
      // So M0/M1 = exp( 0.5 * ln((1+beta)/(1-beta)) ) = sqrt((1+beta)/(1-beta)).
      // USER SAID: "合并，即总质量比为两个阶段质量比的乘积... R = (1+beta)/(1-beta)"
      // Let's verify:
      // Accel: M0 / M1 = sqrt((1+b)/(1-b))
      // Decel: M1 / M_core = sqrt((1+b)/(1-b))
      // Total M0 / M_core = (M0/M1)*(M1/M_core) = (1+beta)/(1-beta).
      // YES, User's derivation is CORRECT for M0/M_core.

      const ratio = (1 + beta) / (1 - beta);

      const M_total = M_core * ratio;
      const M_fuel = M_total - M_core;

      // Energy E = m c^2
      // But which mass converts to energy?
      // In matter-antimatter annihilation, mass converts to energy 100%.
      // The fuel mass M_fuel is composed of matter and antimatter (presumably 50/50).
      // So the entire M_fuel is converted into energy (photons).
      // E = M_fuel * C^2
      
      // We need M_fuel in kg for Joules.
      let M_fuel_kg = M_fuel;
      if (M_unit === 'ton') M_fuel_kg = M_fuel * 1000;

      const Energy_Joules = M_fuel_kg * Math.pow(C, 2);
      
      // TNT equivalent: 1 ton TNT approx 4.184e9 J.  Usually taken as 4.184 GJ.
      const TNT_Joules = 4.184e9;
      const Energy_TNT_tons = Energy_Joules / TNT_Joules;

      // Update UI
      massRatioEl.textContent = formatNumber(ratio, 2) + " : 1";
      totalMassEl.textContent = formatNumber(M_total, 2);
      totalMassUnitEl.textContent = M_unit;
      fuelMassEl.textContent = formatNumber(M_fuel, 2);
      fuelMassUnitEl.textContent = M_unit;

      energyJoulesEl.innerHTML = formatScientific(Energy_Joules);
      
      // Smart format for TNT
      let tntStr = "";
      if (Energy_TNT_tons < 1000) {
        tntStr = `≈ ${formatNumber(Energy_TNT_tons, 0)} Tons TNT`;
      } else if (Energy_TNT_tons < 1e6) {
        tntStr = `≈ ${formatNumber(Energy_TNT_tons / 1000, 1)} Kilotons (KT) TNT`;
      } else if (Energy_TNT_tons < 1e9) {
        tntStr = `≈ ${formatNumber(Energy_TNT_tons / 1e6, 1)} Megatons (MT) TNT`;
      } else {
        tntStr = `≈ ${formatNumber(Energy_TNT_tons / 1e9, 2)} Gigatons (GT) TNT`;
      }
      energyTNTEl.textContent = tntStr;

      resultsPanel.style.display = 'block';

    } catch (e) {
      errorMsg.textContent = e.message;
      errorMsg.style.display = 'block';
    }
  }

  function formatNumber(num, decimals) {
    if (num > 100000) return num.toExponential(2);
    return num.toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: 0 });
  }

  function formatScientific(num) {
    const str = num.toExponential(2);
    const [base, exponent] = str.split('e');
    const expSign = exponent.startsWith('+') ? '' : '-';
    const expVal = parseInt(exponent.replace('+', ''));
    return `${base} × 10<sup>${expVal}</sup>`;
  }
});
