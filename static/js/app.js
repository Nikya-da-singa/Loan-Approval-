/**
 * LoanLens – Advanced AI Underwriting & Model Lab Logic
 */

(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const inr = n => "₹" + Math.round(n).toLocaleString("en-IN");

  // ==========================================
  // Audio Feedback (Web Audio API Synthesizer)
  // ==========================================
  let audioCtx = null;
  let soundEnabled = localStorage.getItem("loanlens-sfx") !== "false";

  function getAudioContext() {
    if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
  }

  function playTone(freq, type = "sine", duration = 0.08, gainVal = 0.05) {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      // Audio autoplay policy catch
    }
  }

  function playSuccessChord() {
    if (!soundEnabled) return;
    [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
      setTimeout(() => playTone(f, "triangle", 0.25, 0.04), i * 70);
    });
  }

  function playRejectTone() {
    if (!soundEnabled) return;
    [392.00, 329.63, 261.63].forEach((f, i) => {
      setTimeout(() => playTone(f, "sawtooth", 0.18, 0.03), i * 90);
    });
  }

  // SFX Toggle Handler
  const sfxBtn = $("#sfxToggle");
  function updateSfxIcon() {
    if (!sfxBtn) return;
    sfxBtn.style.opacity = soundEnabled ? "1" : "0.5";
    sfxBtn.title = soundEnabled ? "Sound Effects: ON" : "Sound Effects: OFF";
  }
  if (sfxBtn) {
    updateSfxIcon();
    sfxBtn.addEventListener("click", () => {
      soundEnabled = !soundEnabled;
      localStorage.setItem("loanlens-sfx", soundEnabled);
      updateSfxIcon();
      if (soundEnabled) playTone(880, "sine", 0.1, 0.05);
      showToast(soundEnabled ? "Sound Effects Enabled" : "Sound Effects Muted", "info");
    });
  }

  // ==========================================
  // Theme Toggle Engine (Dark / Light)
  // ==========================================
  const themeBtn = $("#themeToggle");
  function setTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("loanlens-theme", t);
    if (themeBtn) {
      themeBtn.innerHTML = t === "dark"
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    }
  }

  if (themeBtn) {
    setTheme(document.documentElement.getAttribute("data-theme") || "dark");
    themeBtn.addEventListener("click", () => {
      playTone(600, "sine", 0.05, 0.03);
      const current = document.documentElement.getAttribute("data-theme") || "dark";
      setTheme(current === "dark" ? "light" : "dark");
    });
  }

  // Toast System
  function showToast(msg, type = "info") {
    const container = $("#toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  // ==========================================
  // Tab Navigation Engine
  // ==========================================
  $$(".nav-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      playTone(550, "sine", 0.04, 0.03);
      $$(".nav-tab").forEach(t => {
        t.classList.toggle("active", t === tab);
        t.setAttribute("aria-selected", t === tab ? "true" : "false");
      });
      $$(".panel").forEach(p => p.classList.toggle("active", p.id === "tab-" + tab.dataset.tab));
      if (tab.dataset.tab === "lab") loadLab();
      if (tab.dataset.tab === "dash" && window.Dash) window.Dash.open();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  // Brand Logo Click to Home Tab
  const brandNav = $("#brandNav");
  if (brandNav) {
    brandNav.addEventListener("click", () => {
      const checkTab = $("#tabBtnCheck");
      if (checkTab) checkTab.click();
    });
  }

  // ==========================================
  // Segmented Controls
  // ==========================================
  const choice = {};
  $$(".seg").forEach(seg => {
    const active = $(".on", seg) || $("button", seg);
    choice[seg.dataset.name] = active.dataset.v;
    seg.addEventListener("click", e => {
      const btn = e.target.closest("button");
      if (!btn) return;
      playTone(700, "sine", 0.03, 0.02);
      $$("button", seg).forEach(b => b.classList.toggle("on", b === btn));
      choice[seg.dataset.name] = btn.dataset.v;
      calculatePreFlight();
    });
  });

  // ==========================================
  // Live Sliders & Pre-Flight Affordability HUD
  // ==========================================
  const form = $("#form");
  const ANNUAL_INTEREST = 0.095;

  function calcEmiAmount(lakhs, months) {
    const principal = lakhs * 100000;
    const r = ANNUAL_INTEREST / 12;
    if (months <= 0) return 0;
    const factor = Math.pow(1 + r, months);
    return Math.round((principal * r * factor) / (factor - 1));
  }

  const bandConfig = s => {
    if (s >= 750) return { label: "Superb", cls: "excellent" };
    if (s >= 700) return { label: "Good", cls: "good" };
    if (s >= 650) return { label: "Fair", cls: "fair" };
    if (s >= 600) return { label: "Weak", cls: "poor" };
    return { label: "Poor", cls: "poor" };
  };

  function syncSliders() {
    // Credit Score
    const cs = +form.credit_score.value;
    const csBandEl = $("#csBand");
    const csOutEl = $("#csOut");
    if (csOutEl) csOutEl.textContent = cs;
    if (csBandEl) {
      const b = bandConfig(cs);
      csBandEl.textContent = b.label;
      csBandEl.className = `credit-band-pill ${b.cls}`;
    }

    // Loan Amount
    const la = +form.loan_amount_lakh.value;
    const laOutEl = $("#laOut");
    if (laOutEl) {
      laOutEl.textContent = la >= 100
        ? (la / 100).toFixed(2).replace(/\.?0+$/, "") + " Crore"
        : la + " Lakh";
    }

    // Tenure
    const m = +form.loan_term_months.value;
    const ltOutEl = $("#ltOut");
    if (ltOutEl) {
      const yrs = m / 12;
      ltOutEl.textContent = yrs % 1 === 0 ? `${yrs} Years` : `${yrs.toFixed(1)} Years (${m}m)`;
    }

    calculatePreFlight();
  }

  function calculatePreFlight() {
    const appInc = +form.applicant_income.value || 0;
    const coInc = +form.coapplicant_income.value || 0;
    const totalIncome = appInc + coInc;
    const exEmi = +form.existing_emi.value || 0;
    const la = +form.loan_amount_lakh.value || 0;
    const months = +form.loan_term_months.value || 12;

    const newEmi = calcEmiAmount(la, months);
    const totalEmi = newEmi + exEmi;
    const dti = totalIncome > 0 ? (totalEmi / totalIncome) * 100 : 100;

    const liveEmiEl = $("#liveEmi");
    const liveDtiEl = $("#liveDti");
    const liveDtiBadgeEl = $("#liveDtiBadge");
    const liveAffEl = $("#liveAffordability");

    if (liveEmiEl) liveEmiEl.textContent = inr(newEmi) + "/mo";
    if (liveDtiEl) liveDtiEl.textContent = dti.toFixed(1) + "%";

    if (liveDtiBadgeEl && liveAffEl) {
      if (dti <= 35) {
        liveDtiBadgeEl.textContent = "Safe Zone";
        liveDtiBadgeEl.className = "dti-pill safe";
        liveAffEl.textContent = "High";
        liveAffEl.style.color = "var(--good)";
      } else if (dti <= 50) {
        liveDtiBadgeEl.textContent = "Moderate";
        liveDtiBadgeEl.className = "dti-pill moderate";
        liveAffEl.textContent = "Moderate";
        liveAffEl.style.color = "var(--amber)";
      } else {
        liveDtiBadgeEl.textContent = "Critical";
        liveDtiBadgeEl.className = "dti-pill critical";
        liveAffEl.textContent = "High Risk";
        liveAffEl.style.color = "var(--bad)";
      }
    }
  }

  ["credit_score", "loan_amount_lakh", "loan_term_months"].forEach(n => {
    if (form[n]) form[n].addEventListener("input", syncSliders);
  });
  ["applicant_income", "coapplicant_income", "existing_emi", "age", "dependents"].forEach(n => {
    if (form[n]) form[n].addEventListener("input", calculatePreFlight);
  });
  syncSliders();

  // ==========================================
  // Preset Demo Archetypes
  // ==========================================
  const PRESETS = {
    prime: {
      age: 32, dependents: 1, education: "Graduate", employment: "Salaried", property_area: "Urban",
      applicant_income: 85000, coapplicant_income: 35000, existing_emi: 8000, credit_score: 760,
      loan_purpose: "Home", loan_amount_lakh: 25, loan_term_months: 180
    },
    business: {
      age: 38, dependents: 2, education: "Graduate", employment: "Business Owner", property_area: "Semiurban",
      applicant_income: 150000, coapplicant_income: 50000, existing_emi: 15000, credit_score: 730,
      loan_purpose: "Business", loan_amount_lakh: 45, loan_term_months: 120
    },
    graduate: {
      age: 24, dependents: 0, education: "Graduate", employment: "Salaried", property_area: "Urban",
      applicant_income: 45000, coapplicant_income: 0, existing_emi: 0, credit_score: 680,
      loan_purpose: "Education", loan_amount_lakh: 12, loan_term_months: 84
    },
    risk: {
      age: 30, dependents: 2, education: "Not Graduate", employment: "Self-Employed", property_area: "Rural",
      applicant_income: 50000, coapplicant_income: 0, existing_emi: 22000, credit_score: 610,
      loan_purpose: "Personal", loan_amount_lakh: 35, loan_term_months: 60
    }
  };

  $$(".preset-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      playTone(650, "sine", 0.05, 0.03);
      $$(".preset-chip").forEach(c => c.classList.toggle("active", c === chip));
      const p = PRESETS[chip.dataset.preset];
      if (!p) return;

      // Apply values
      Object.keys(p).forEach(k => {
        if (form[k]) form[k].value = p[k];
      });

      // Apply segmented controls
      ["education", "employment", "property_area", "loan_purpose"].forEach(name => {
        const seg = $(`.seg[data-name="${name}"]`);
        if (seg) {
          $$("button", seg).forEach(btn => {
            const isMatch = btn.dataset.v === p[name];
            btn.classList.toggle("on", isMatch);
            if (isMatch) choice[name] = p[name];
          });
        }
      });

      syncSliders();
      showToast(`Loaded Preset: ${chip.querySelector("b").textContent}`, "info");
    });
  });

  // ==========================================
  // Gauge Meter Animation
  // ==========================================
  const ARC_LENGTH = 361;

  function setDial(p) {
    const arc = $("#gaugeArc");
    const needle = $("#gaugeNeedle");
    if (!arc || !needle) return;

    const offset = ARC_LENGTH * (1 - p);
    arc.style.strokeDashoffset = offset;
    needle.style.transform = `rotate(${-90 + 180 * p}deg)`;

    // Dynamic Arc Color Shift
    if (p >= 0.7) {
      arc.style.stroke = "url(#gaugeGradient)";
    } else if (p >= 0.5) {
      arc.style.stroke = "#F59E0B";
    } else {
      arc.style.stroke = "#F43F5E";
    }
  }

  // Smooth Percentage Counter Ticker
  function animateCounter(targetPct) {
    const el = $("#pct");
    if (!el) return;
    let start = 0;
    const duration = 1000;
    const startTime = performance.now();

    function updateCount(currTime) {
      const elapsed = currTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const val = Math.round(start + (targetPct - start) * eased);
      el.textContent = val + "%";
      if (progress < 1) requestAnimationFrame(updateCount);
    }
    requestAnimationFrame(updateCount);
  }

  // ==========================================
  // Form Submission & Prediction Handler
  // ==========================================
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const err = $("#err");
    if (err) err.textContent = "";
    const btn = $("#btnSubmit");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg><span>Evaluating Risk Models…</span>`;
    }

    const payload = { model: $("#model").value, ...choice };
    ["age", "dependents", "applicant_income", "coapplicant_income", "existing_emi",
     "credit_score", "loan_amount_lakh", "loan_term_months"].forEach(k => {
      if (form[k]) payload[k] = form[k].value;
    });

    try {
      // Concurrently query primary model prediction and multi-model consensus
      const [resPrimary, resConsensus] = await Promise.all([
        fetch("/api/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }),
        fetch("/api/predict_all", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }).catch(() => null)
      ]);

      const d = await resPrimary.json();
      if (!resPrimary.ok) throw new Error(d.error || "Prediction request failed.");

      let consensusData = null;
      if (resConsensus && resConsensus.ok) {
        consensusData = await resConsensus.json();
      }

      showResults(d, consensusData);
      if (d.approved) playSuccessChord(); else playRejectTone();
      showToast(d.approved ? "Eligible: Loan Approved!" : "High Risk: Loan Rejected", d.approved ? "success" : "warning");
    } catch (ex) {
      if (err) err.textContent = ex.message;
      showToast(ex.message, "error");
    }

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg><span>Run AI Assessment</span>`;
    }
  });

  // Render Full Results
  function showResults(d, consensus) {
    const emptyEl = $("#empty");
    const outEl = $("#out");
    if (emptyEl) emptyEl.hidden = true;
    if (outEl) outEl.hidden = false;

    setDial(d.probability);
    animateCounter(Math.round(d.probability * 100));

    // Verdict Banner
    const v = $("#verdict");
    if (v) {
      v.className = "verdict-banner " + (d.approved ? "approved" : "rejected");
      v.innerHTML = d.approved
        ? `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><span>Approved · High Solvency</span>`
        : `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg><span>Rejected · Elevated Risk</span>`;
    }

    // KPIs
    const kEmi = $("#kEmi");
    const kDti = $("#kDti");
    const kRisk = $("#kRisk");
    if (kEmi) kEmi.textContent = inr(d.new_emi);
    if (kDti) kDti.textContent = d.debt_to_income + "%";
    if (kRisk) {
      kRisk.textContent = d.risk;
      kRisk.style.color = d.risk === "Low" ? "var(--good)" : d.risk === "Medium" ? "var(--amber)" : "var(--bad)";
    }

    // Multi-Model Consensus Pills
    const consensusPills = $("#consensusPills");
    const consensusScore = $("#consensusScore");
    if (consensus && consensus.results && consensusPills) {
      const entries = Object.entries(consensus.results);
      const approvedCount = entries.filter(([_, r]) => r.approved).length;
      if (consensusScore) consensusScore.textContent = `${approvedCount} / ${entries.length} Models Approve`;

      consensusPills.innerHTML = entries.map(([name, r]) => {
        const shortName = name.replace("Gradient Boosting", "GradBoost").replace("Logistic Regression", "LogReg").replace("Decision Tree", "Tree").replace("Random Forest", "RandForest").replace("K-Nearest Neighbors", "KNN");
        return `<div class="consensus-pill ${r.approved ? "yes" : "no"}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            ${r.approved ? '<polyline points="20 6 9 17 4 12"/>' : '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'}
          </svg>
          <span>${shortName} (${Math.round(r.probability * 100)}%)</span>
        </div>`;
      }).join("");
    } else if (consensusPills) {
      consensusPills.innerHTML = `<div class="consensus-pill ${d.approved ? "yes" : "no"}">${d.model}: ${Math.round(d.probability * 100)}%</div>`;
    }

    // Explainable Feature Impacts (Diverging Waterfall)
    const max = Math.max(5, ...d.factors.map(f => Math.abs(f.impact)));
    const factorsEl = $("#factors");
    if (factorsEl) {
      factorsEl.innerHTML = d.factors.map(f => {
        const w = Math.min(50, (Math.abs(f.impact) / max) * 50);
        const cls = f.impact >= 0 ? "pos" : "neg";
        const sign = f.impact > 0 ? "+" : "";
        return `<li class="factor-item">
          <span class="factor-name" title="${f.feature}">${f.feature}</span>
          <div class="factor-track"><i class="factor-bar ${cls}" style="width:${w}%"></i></div>
          <span class="factor-delta ${cls}">${sign}${f.impact}%</span>
        </li>`;
      }).join("");
    }

    // Improvement Tips
    const tipsEl = $("#tips");
    if (tipsEl) {
      tipsEl.innerHTML = d.tips.map(t => `<li class="tip-card">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" class="tip-icon"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        <span>${t}</span>
      </li>`).join("");
    }

    // Model Attribution Footnote
    const usedModelEl = $("#usedModel");
    if (usedModelEl) {
      usedModelEl.textContent = `Scored by ${d.model}. Marginal feature deltas quantify how much each input shifted the approval probability relative to baseline averages.`;
    }

    // Scroll into view on mobile
    if (window.innerWidth <= 1024) {
      $("#resultCard").scrollIntoView({ behavior: "smooth" });
    }
  }

  // ==========================================
  // Auto-Optimizer (What-If Simulator)
  // ==========================================
  const btnOptimize = $("#btnOptimize");
  if (btnOptimize) {
    btnOptimize.addEventListener("click", () => {
      playTone(750, "sine", 0.08, 0.04);
      // Auto optimize: Increase tenure by 36 months and add 20k coapplicant if missing
      const currentTenure = +form.loan_term_months.value;
      const currentCo = +form.coapplicant_income.value;
      if (currentTenure <= 240) form.loan_term_months.value = Math.min(360, currentTenure + 48);
      if (currentCo === 0) form.coapplicant_income.value = 25000;
      syncSliders();
      $("#form").dispatchEvent(new Event("submit"));
      showToast("Applied Tenure Extension & Co-Borrower Optimization!", "success");
    });
  }

  // Print Pre-Approval Certificate Slip
  const btnPrintReport = $("#btnPrintReport");
  if (btnPrintReport) {
    btnPrintReport.addEventListener("click", () => {
      window.print();
    });
  }

  // ==========================================
  // TAB 3: Model Lab & Benchmarking
  // ==========================================
  let labLoaded = false, M = null;

  async function loadLab() {
    if (labLoaded) return;
    labLoaded = true;
    try {
      M = await (await fetch("/api/metrics")).json();
      const pct = x => (x * 100).toFixed(1) + "%";

      // Global Dataset KPI Deck
      const dsStats = $("#dsStats");
      if (dsStats) {
        dsStats.innerHTML = `
          <div class="lab-stat-box"><b>${M.dataset.rows.toLocaleString("en-IN")}</b><small>Total Training Records</small></div>
          <div class="lab-stat-box"><b>${M.dataset.train_rows.toLocaleString("en-IN")} / ${M.dataset.test_rows}</b><small>Train / Test Split</small></div>
          <div class="lab-stat-box"><b>${pct(M.dataset.approval_rate)}</b><small>Base Approval Rate</small></div>
          <div class="lab-stat-box"><b>${M.results.length}</b><small>Algorithms Benchmarked</small></div>`;
      }

      // Accuracy and F1 Comparison Bars
      const barsEl = $("#bars");
      if (barsEl) {
        barsEl.innerHTML = M.results.map(r => `
          <div class="model-bar-row">
            <div class="model-bar-header">
              <span>${r.model}${r.model === M.best_model ? '<span class="best-badge">🏆 Champion</span>' : ""}</span>
              <span class="mono" style="font-size:0.85rem; color:var(--text-muted);">Acc: ${pct(r.accuracy)} · F1: ${pct(r.f1)}</span>
            </div>
            <div class="metric-track"><div class="metric-track-fill acc" data-w="${r.accuracy * 100}"></div></div>
            <div class="metric-track"><div class="metric-track-fill f1" data-w="${r.f1 * 100}"></div></div>
          </div>`).join("");
      }

      // Top Feature Importance (Random Forest Gini Impurity)
      const top = M.feature_importance.slice(0, 10);
      const mx = top[0].importance;
      const nice = s => s.replace(/_/g, " ").replace(/^./, c => c.toUpperCase());
      const impEl = $("#imp");
      if (impEl) {
        impEl.innerHTML = top.map(f => `
          <div class="importance-row">
            <span class="importance-name" title="${f.feature}">${nice(f.feature)}</span>
            <div class="metric-track" style="margin:0;"><div class="metric-track-fill acc" data-w="${(f.importance / mx) * 100}"></div></div>
            <span class="importance-val">${(f.importance * 100).toFixed(1)}%</span>
          </div>`).join("");
      }

      // Comprehensive Evaluation Matrix Table
      const tblEl = $("#tbl");
      if (tblEl) {
        tblEl.innerHTML = `
          <thead>
            <tr>
              <th>Algorithm</th>
              <th>Accuracy</th>
              <th>Precision</th>
              <th>Recall</th>
              <th>F1 Score</th>
              <th>ROC-AUC</th>
              <th>5-Fold CV</th>
              <th>Train Time</th>
            </tr>
          </thead>
          <tbody>` +
          M.results.map(r => `
            <tr style="${r.model === M.best_model ? 'background:rgba(99,102,241,0.08); font-weight:700;' : ''}">
              <td><b>${r.model}</b>${r.model === M.best_model ? ' <span class="best-badge">Best</span>' : ''}</td>
              <td class="mono">${pct(r.accuracy)}</td>
              <td class="mono">${pct(r.precision)}</td>
              <td class="mono">${pct(r.recall)}</td>
              <td class="mono">${pct(r.f1)}</td>
              <td class="mono">${r.roc_auc.toFixed(3)}</td>
              <td class="mono">${pct(r.cv_accuracy)}</td>
              <td class="mono">${r.train_seconds}s</td>
            </tr>`).join("") +
          `</tbody>`;
      }

      // Confusion Matrix Selector & Drawer
      const cmSel = $("#cmModel");
      if (cmSel) {
        cmSel.innerHTML = M.results.map(r => `<option ${r.model === M.best_model ? "selected" : ""}>${r.model}</option>`).join("");
        cmSel.addEventListener("change", () => {
          playTone(600, "sine", 0.04, 0.02);
          drawConfusionMatrix();
        });
        drawConfusionMatrix();
      }

      // Animate progress bars
      requestAnimationFrame(() => {
        $$("[data-w]").forEach(i => i.style.width = i.dataset.w + "%");
      });
    } catch (e) {
      console.error("Failed loading model lab metrics:", e);
    }
  }

  function drawConfusionMatrix() {
    const modelName = $("#cmModel").value;
    const item = M.results.find(r => r.model === modelName);
    if (!item) return;
    const c = item.confusion;
    const cmEl = $("#cm");
    if (cmEl) {
      cmEl.innerHTML = `
        <div class="cm-cell header"></div>
        <div class="cm-cell header"><b>Predicted Rejected</b></div>
        <div class="cm-cell header"><b>Predicted Approved</b></div>

        <div class="cm-cell header"><b>Actual Rejected</b></div>
        <div class="cm-cell correct" title="True Negatives: Risky loans accurately avoided">
          <b>${c.tn}</b><span>True Default Avoided</span>
        </div>
        <div class="cm-cell error" title="False Positives: Bad loans mistakenly approved">
          <b>${c.fp}</b><span>False Approval Risk</span>
        </div>

        <div class="cm-cell header"><b>Actual Approved</b></div>
        <div class="cm-cell error" title="False Negatives: Creditworthy applicant mistakenly turned away">
          <b>${c.fn}</b><span>Missed Opportunity</span>
        </div>
        <div class="cm-cell correct" title="True Positives: Solvent borrower successfully funded">
          <b>${c.tp}</b><span>Solvent Loan Granted</span>
        </div>`;
    }
  }
})();
