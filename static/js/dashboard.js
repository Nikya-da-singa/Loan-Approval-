/**
 * LoanLens – Macro Lending Analytics & Dashboard Suite
 */

window.Dash = (() => {
  const $ = s => document.querySelector(s);
  const inr = n => "₹" + Math.round(n).toLocaleString("en-IN");

  const PRIMARY = "#6366F1";
  const CYAN = "#06B6D4";
  const AMBER = "#F59E0B";
  const GOOD = "#10B981";
  const BAD = "#F43F5E";
  const MUTED = "#94A3B8";

  const charts = {};
  let started = false;
  let rocLoaded = false;

  function getThemeGridColor() {
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";
    return isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";
  }

  function getThemeTextColor() {
    const isDark = document.documentElement.getAttribute("data-theme") !== "light";
    return isDark ? "#94A3B8" : "#64748B";
  }

  if (window.Chart) {
    Chart.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif";
    Chart.defaults.font.weight = 600;
    Chart.defaults.color = getThemeTextColor();
  }

  function draw(id, cfg) {
    const el = $("#" + id);
    if (!el) return;
    if (charts[id]) {
      charts[id].data = cfg.data;
      if (cfg.options) charts[id].options = cfg.options;
      charts[id].update();
      return;
    }
    charts[id] = new Chart(el, cfg);
  }

  // Generic Bar Chart for Approval Rates with lowest cohort highlighted in Amber
  function rateChart(id, d) {
    const nonEmpty = d.rate.filter((_, i) => d.count[i] > 0);
    const low = Math.min(...nonEmpty);

    draw(id, {
      type: "bar",
      data: {
        labels: d.labels,
        datasets: [{
          data: d.rate,
          borderRadius: 8,
          maxBarThickness: 52,
          backgroundColor: d.rate.map((r, i) => (d.count[i] > 0 && r === low ? AMBER : PRIMARY)),
          hoverBackgroundColor: d.rate.map((r, i) => (d.count[i] > 0 && r === low ? "#D97706" : "#4F46E5"))
        }]
      },
      options: {
        maintainAspectRatio: false,
        responsive: true,
        scales: {
          y: {
            min: 0,
            max: 100,
            grid: { color: getThemeGridColor() },
            ticks: { color: getThemeTextColor(), callback: v => v + "%" }
          },
          x: {
            grid: { display: false },
            ticks: { color: getThemeTextColor() }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.9)",
            titleColor: "#F8FAFC",
            bodyColor: "#CBD5E1",
            padding: 12,
            cornerRadius: 10,
            callbacks: {
              label: c => ` ${c.parsed.y}% Approved (${d.count[c.dataIndex]} Applicants)`
            }
          }
        }
      }
    });
  }

  // Executive KPI Row Renderer
  function renderKpis(k) {
    const cards = [
      { label: "Cohort Applicants", val: k.applicants.toLocaleString("en-IN"), icon: "👥" },
      { label: "Overall Approval Rate", val: k.approval_rate + "%", icon: "📊" },
      { label: "Avg. Monthly Income", val: inr(k.avg_income), icon: "💰" },
      { label: "Avg. Credit Score", val: k.avg_credit, icon: "🛡️" },
      { label: "SDG 8 Business Rate", val: k.business_rate === null ? "–" : k.business_rate + "%", icon: "🚀", hl: true }
    ];

    const kpiEl = $("#dKpis");
    if (!kpiEl) return;
    kpiEl.innerHTML = cards.map(c => `
      <div class="kpi-card ${c.hl ? "highlight" : ""}">
        <div class="kpi-header-row">
          <small>${c.label}</small>
          <span class="kpi-icon-pill">${c.icon}</span>
        </div>
        <b>${c.val}</b>
      </div>`).join("");
  }

  // Populate Filter Select Elements
  function fillFilters(opts) {
    const map = { fPurpose: "loan_purpose", fEmployment: "employment", fArea: "property_area" };
    Object.entries(map).forEach(([id, key]) => {
      const el = $("#" + id);
      if (!el || el.options.length > 0) return;
      el.innerHTML = ["All", ...opts[key]].map(o => `<option value="${o}">${o === "All" ? "All " + key.replace(/_/g, " ") : o}</option>`).join("");
      el.addEventListener("change", load);
    });
  }

  // Main Dashboard Data Fetch & Render
  async function load() {
    const q = new URLSearchParams({
      loan_purpose: ($("#fPurpose") || {}).value || "All",
      employment: ($("#fEmployment") || {}).value || "All",
      property_area: ($("#fArea") || {}).value || "All"
    });

    try {
      const d = await (await fetch("/api/dashboard?" + q)).json();
      fillFilters(d.options);

      const dEmpty = $("#dEmpty");
      const dBody = $("#dBody");
      if (dEmpty) dEmpty.hidden = !d.empty;
      if (dBody) dBody.hidden = d.empty;
      if (d.empty) return;

      renderKpis(d.kpis);
      rateChart("cCredit", d.credit);
      rateChart("cEmp", d.employment);
      rateChart("cPurpose", d.purpose);
      rateChart("cArea", d.area);

      // Income Distribution (Stacked Bars)
      draw("cIncome", {
        type: "bar",
        data: {
          labels: d.income.labels,
          datasets: [
            { label: "Approved", data: d.income.approved, backgroundColor: GOOD, borderRadius: 6, maxBarThickness: 44 },
            { label: "Rejected", data: d.income.rejected, backgroundColor: BAD, borderRadius: 6, maxBarThickness: 44 }
          ]
        },
        options: {
          maintainAspectRatio: false,
          responsive: true,
          scales: {
            x: { stacked: true, grid: { display: false }, ticks: { color: getThemeTextColor() } },
            y: { stacked: true, grid: { color: getThemeGridColor() }, ticks: { color: getThemeTextColor() } }
          },
          plugins: {
            legend: { position: "bottom", labels: { color: getThemeTextColor(), boxWidth: 12, borderRadius: 3 } },
            tooltip: {
              backgroundColor: "rgba(15, 23, 42, 0.9)",
              titleColor: "#F8FAFC",
              bodyColor: "#CBD5E1",
              padding: 12,
              cornerRadius: 10
            }
          }
        }
      });

      // Overall Outcome Donut
      draw("cStatus", {
        type: "doughnut",
        data: {
          labels: ["Approved", "Rejected"],
          datasets: [{
            data: [d.status.approved, d.status.rejected],
            backgroundColor: [GOOD, BAD],
            borderWidth: 0,
            hoverOffset: 6
          }]
        },
        options: {
          maintainAspectRatio: false,
          responsive: true,
          cutout: "68%",
          plugins: {
            legend: { position: "bottom", labels: { color: getThemeTextColor(), boxWidth: 12, borderRadius: 3 } },
            tooltip: {
              backgroundColor: "rgba(15, 23, 42, 0.9)",
              titleColor: "#F8FAFC",
              bodyColor: "#CBD5E1",
              padding: 12,
              cornerRadius: 10
            }
          }
        }
      });
    } catch (e) {
      console.error("Dashboard load failed:", e);
    }
  }

  // ROC-AUC Curves Loader
  async function loadRoc() {
    if (rocLoaded) return;
    rocLoaded = true;
    try {
      const data = await (await fetch("/api/roc")).json();
      const colors = [MUTED, "#8B5CF6", AMBER, CYAN, GOOD];

      const sets = data.map((m, i) => ({
        label: `${m.model} (AUC ${m.auc})`,
        data: m.points,
        borderColor: colors[i % colors.length],
        backgroundColor: colors[i % colors.length],
        borderWidth: 2.5,
        pointRadius: 0,
        tension: 0.25,
        showLine: true
      }));

      // Baseline Diagonal
      sets.push({
        label: "Random Guess Baseline",
        data: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
        borderColor: "rgba(148, 163, 184, 0.5)",
        borderDash: [6, 6],
        borderWidth: 1.5,
        pointRadius: 0,
        showLine: true
      });

      draw("cRoc", {
        type: "scatter",
        data: { datasets: sets },
        options: {
          maintainAspectRatio: false,
          responsive: true,
          animation: false,
          scales: {
            x: {
              type: "linear",
              min: 0,
              max: 1,
              title: { display: true, text: "False Positive Rate (1 - Specificity)", color: getThemeTextColor() },
              grid: { color: getThemeGridColor() },
              ticks: { color: getThemeTextColor() }
            },
            y: {
              type: "linear",
              min: 0,
              max: 1,
              title: { display: true, text: "True Positive Rate (Sensitivity / Recall)", color: getThemeTextColor() },
              grid: { color: getThemeGridColor() },
              ticks: { color: getThemeTextColor() }
            }
          },
          plugins: {
            legend: { position: "bottom", labels: { color: getThemeTextColor(), boxWidth: 12, padding: 14 } },
            tooltip: { enabled: false }
          }
        }
      });
    } catch (e) {
      console.error("ROC data load failed:", e);
    }
  }

  // Prediction Audit History Loader
  let historyDataCache = [];

  async function loadHistory() {
    try {
      const rows = await (await fetch("/api/history")).json();
      historyDataCache = rows;
      const ok = rows.filter(r => r.approved).length;

      const hSummary = $("#hSummary");
      if (hSummary) {
        hSummary.textContent = rows.length
          ? `${rows.length} ${rows.length === 1 ? "assessment logged" : "assessments logged"} · ${ok} Approved (${Math.round((ok / rows.length) * 100)}%), ${rows.length - ok} Rejected.`
          : "No predictions recorded yet. Run an assessment on the first tab to begin logging audit records.";
      }

      const hClear = $("#hClear");
      const hExport = $("#hExport");
      if (hClear) hClear.hidden = !rows.length;
      if (hExport) hExport.hidden = !rows.length;

      const hTable = $("#hTable");
      if (hTable) {
        hTable.innerHTML = rows.length ? `
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Applicant Profile</th>
              <th>Loan Purpose</th>
              <th>Total Income</th>
              <th>Loan Requested</th>
              <th>Credit Score</th>
              <th>Model Evaluated</th>
              <th>Confidence</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>` +
          rows.slice(0, 25).map(r => `
            <tr>
              <td class="mono" style="font-size:0.82rem; color:var(--text-muted);">${r.time}</td>
              <td><b>${r.age} yrs</b>, ${r.employment}</td>
              <td><span style="padding:0.15rem 0.5rem; border-radius:6px; background:var(--bg-glass-pill); font-size:0.8rem; font-weight:600;">${r.purpose}</span></td>
              <td class="mono">${inr(r.income)}</td>
              <td class="mono">₹${r.loan} Lakh</td>
              <td class="mono">${r.credit}</td>
              <td>${r.model}</td>
              <td class="mono"><b>${Math.round(r.probability * 100)}%</b></td>
              <td>
                <span class="status-badge ${r.approved ? "approved" : "rejected"}">
                  <span class="pulse-dot" style="background:${r.approved ? "var(--good)" : "var(--bad)"}; width:6px; height:6px;"></span>
                  <span>${r.approved ? "Approved" : "Rejected"}</span>
                </span>
              </td>
            </tr>`).join("") +
          `</tbody>` : "";
      }
    } catch (e) {
      console.error("History load failed:", e);
    }
  }

  // Export History as CSV
  function exportCSV() {
    if (!historyDataCache.length) return;
    const headers = ["Timestamp", "Age", "Employment", "Purpose", "Income (INR)", "Loan (Lakh)", "Credit Score", "Model", "Probability", "Approved"];
    const rows = historyDataCache.map(r => [
      `"${r.time}"`, r.age, `"${r.employment}"`, `"${r.purpose}"`, r.income, r.loan, r.credit, `"${r.model}"`, r.probability, r.approved ? "YES" : "NO"
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `LoanLens_Audit_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function open() {
    if (!started) {
      started = true;
      const fReset = $("#fReset");
      if (fReset) {
        fReset.addEventListener("click", () => {
          ["#fPurpose", "#fEmployment", "#fArea"].forEach(s => {
            const el = $(s);
            if (el) el.value = "All";
          });
          load();
        });
      }

      const hClear = $("#hClear");
      if (hClear) {
        hClear.addEventListener("click", async () => {
          if (confirm("Clear all logged prediction records?")) {
            await fetch("/api/history", { method: "DELETE" });
            loadHistory();
          }
        });
      }

      const hExport = $("#hExport");
      if (hExport) {
        hExport.addEventListener("click", exportCSV);
      }

      load();
      loadRoc();
    }
    loadHistory();
  }

  return { open };
})();
