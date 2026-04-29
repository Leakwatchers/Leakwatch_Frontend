import React, { useEffect, useState, useCallback, useRef } from "react";
import { api } from "../api";
import "chartjs-adapter-date-fns";

import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Legend,
  Tooltip,
  Filler,
  TimeScale,
} from "chart.js";

import annotationPlugin from "chartjs-plugin-annotation";

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  TimeScale,
  Legend,
  Tooltip,
  Filler,
  annotationPlugin
);

// ─── status config ────────────────────────────────────────────────────────────

const GAS_LEVELS = [
  { status: "OK",      min: 0,    max: 400,  color: "#4caf50", label: "OK (0–400 ppm)"          },
  { status: "ALERTA",  min: 400,  max: 1000, color: "#ffcd56", label: "Alerta (400–1000 ppm)"    },
  { status: "CRITICO", min: 1000, max: 2000, color: "#ff9f40", label: "Crítico (1000–2000 ppm)"  },
  { status: "RISCO",   min: 2000, max: null, color: "#ff4444", label: "Risco (> 2000 ppm)"       },
];

function statusConfig(status) {
  return GAS_LEVELS.find((l) => l.status === status) ?? GAS_LEVELS[0];
}

function statusBadge(status) {
  const cfg = statusConfig(status);
  return (
    <span style={{
      background: cfg.color + "22",
      color: cfg.color,
      border: `1px solid ${cfg.color}55`,
      borderRadius: 6,
      padding: "2px 8px",
      fontSize: 12,
      fontWeight: 600,
    }}>
      {status}
    </span>
  );
}

// ─── constants ────────────────────────────────────────────────────────────────

const SENSOR_COLORS = [
  "#26c6da", "#ff6384", "#ffcd56",
  "#4bc0c0", "#9966ff", "#ff9f40",
];

// Zone annotations for the chart (fixed thresholds)
const ZONE_ANNOTATIONS = {
  zoneOk: {
    type: "box",
    yMin: 0, yMax: 400,
    backgroundColor: "rgba(76,175,80,0.05)",
    borderWidth: 0,
  },
  zoneAlerta: {
    type: "box",
    yMin: 400, yMax: 1000,
    backgroundColor: "rgba(255,205,86,0.05)",
    borderWidth: 0,
  },
  zoneCritico: {
    type: "box",
    yMin: 1000, yMax: 2000,
    backgroundColor: "rgba(255,159,64,0.07)",
    borderWidth: 0,
  },
  zoneRisco: {
    type: "box",
    yMin: 2000,
    backgroundColor: "rgba(255,68,68,0.08)",
    borderWidth: 0,
  },
  lineAlerta: {
    type: "line",
    yMin: 400, yMax: 400,
    borderColor: "rgba(255,205,86,0.4)",
    borderWidth: 1,
    borderDash: [4, 4],
    label: { content: "Alerta 400", display: true, position: "end", color: "#ffcd56", font: { size: 10 } },
  },
  lineCritico: {
    type: "line",
    yMin: 1000, yMax: 1000,
    borderColor: "rgba(255,159,64,0.4)",
    borderWidth: 1,
    borderDash: [4, 4],
    label: { content: "Crítico 1000", display: true, position: "end", color: "#ff9f40", font: { size: 10 } },
  },
  lineRisco: {
    type: "line",
    yMin: 2000, yMax: 2000,
    borderColor: "rgba(255,68,68,0.5)",
    borderWidth: 1,
    borderDash: [4, 4],
    label: { content: "Risco 2000", display: true, position: "end", color: "#ff4444", font: { size: 10 } },
  },
};

const chartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  animation: { duration: 400 },
  interaction: { mode: "index", intersect: false },
  scales: {
    x: {
      type: "time",
      time: { unit: "minute", tooltipFormat: "dd/MM HH:mm" },
      grid: { color: "rgba(255,255,255,0.06)" },
      ticks: { color: "#8899aa", maxRotation: 0 },
    },
    y: {
      grid: { color: "rgba(255,255,255,0.06)" },
      ticks: { color: "#8899aa" },
      min: 0,
    },
  },
  plugins: {
    legend: {
      labels: { color: "#cdd6e0", boxWidth: 14, padding: 16 },
      onClick: (e, item, legend) => {
        const meta = legend.chart.getDatasetMeta(item.datasetIndex);
        meta.hidden = !meta.hidden;
        legend.chart.update();
      },
    },
    tooltip: {
      backgroundColor: "rgba(10,18,30,0.92)",
      titleColor: "#e0eaf4",
      bodyColor: "#8899aa",
      borderColor: "rgba(255,255,255,0.08)",
      borderWidth: 1,
      padding: 10,
    },
    annotation: { annotations: ZONE_ANNOTATIONS },
  },
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function getIntervalMinutes(start, end) {
  if (!start || !end) return 5;
  const diff = (new Date(end) - new Date(start)) / 60_000;
  if (diff <= 15)   return 1;
  if (diff <= 30)   return 3;
  if (diff <= 60)   return 5;
  if (diff <= 120)  return 10;
  if (diff <= 240)  return 20;
  if (diff <= 480)  return 30;
  if (diff <= 1440) return 60;
  return 480;
}

/**
 * Compute alert reports from raw reports (which already have `status` from the API).
 * Groups consecutive non-OK readings into events.
 */
function computeAlertReports(rawReportsBySensor) {
  const alertEvents = [];

  rawReportsBySensor.forEach(({ sensorName, reports }) => {
    const sorted = [...reports].sort(
      (a, b) => new Date(a.reportTime) - new Date(b.reportTime)
    );

    let eventStart  = null;
    let eventStatus = null;
    let peak        = 0;

    sorted.forEach((rep, idx) => {
      const isAlert = rep.status !== "OK";

      if (isAlert && eventStart === null) {
        eventStart  = new Date(rep.reportTime).getTime();
        eventStatus = rep.status;
        peak        = rep.gasLevel;
      } else if (isAlert && eventStart !== null) {
        if (rep.gasLevel > peak) peak = rep.gasLevel;
        // escalate status if worse
        const levels = ["ALERTA", "CRITICO", "RISCO"];
        if (levels.indexOf(rep.status) > levels.indexOf(eventStatus)) {
          eventStatus = rep.status;
        }
      } else if (!isAlert && eventStart !== null) {
        alertEvents.push({
          sensorName,
          start:      eventStart,
          end:        new Date(rep.reportTime).getTime(),
          peak:       Math.round(peak * 100) / 100,
          status:     eventStatus,
          durationMs: new Date(rep.reportTime).getTime() - eventStart,
        });
        eventStart = null; peak = 0;
      }

      // still in alert at last point
      if (isAlert && idx === sorted.length - 1 && eventStart !== null) {
        alertEvents.push({
          sensorName,
          start:      eventStart,
          end:        new Date(rep.reportTime).getTime(),
          peak:       Math.round(peak * 100) / 100,
          status:     eventStatus,
          durationMs: new Date(rep.reportTime).getTime() - eventStart,
        });
      }
    });
  });

  const freqMap = {};
  alertEvents.forEach((e) => {
    freqMap[e.sensorName] = (freqMap[e.sensorName] || 0) + 1;
  });
  const frequency = Object.entries(freqMap)
    .map(([sensorName, count]) => ({ sensorName, count }))
    .sort((a, b) => b.count - a.count);

  const durMap = {};
  alertEvents.forEach((e) => {
    if (!durMap[e.sensorName]) durMap[e.sensorName] = [];
    durMap[e.sensorName].push(e.durationMs);
  });
  const avgReturn = Object.entries(durMap).map(([sensorName, arr]) => ({
    sensorName,
    avgMs: arr.reduce((a, b) => a + b, 0) / arr.length,
  }));

  return { alertEvents, frequency, avgReturn };
}

function fmtDuration(ms) {
  if (ms < 60_000)    return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}min`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function fmtDate(ts) {
  return new Date(ts).toLocaleString("pt-BR");
}

// ─── component ────────────────────────────────────────────────────────────────

export default function Results() {
  const [sensors, setSensors]         = useState([]);
  const [selected, setSelected]       = useState([]);
  const [chartData, setChartData]     = useState(null);
  const [alertReports, setAlertReports] = useState(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [role, setRole]               = useState("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate]     = useState("");

  const baseDatasetsRef    = useRef([]);
  const rawReportsBySensor = useRef([]);

  // ── detect role ──────────────────────────────────────────────────────────
  useEffect(() => {
    api.get("/users")
      .then(() => setRole("MASTER"))
      .catch(() => setRole("VIEW"));
  }, []);

  function logout() {
    localStorage.clear();
    window.location.href = "/login";
  }

  // ── load sensors ─────────────────────────────────────────────────────────
  useEffect(() => {
    api.get("/sensors")
      .then((r) => setSensors(r.data))
      .catch(() => setError("Não foi possível carregar os sensores."));
  }, []);

  // ── toggle sensor ────────────────────────────────────────────────────────
  const toggleSensor = useCallback((sensor) => {
    setSelected((prev) => {
      const exists = prev.some((s) => s.id === sensor.id);
      return exists ? prev.filter((s) => s.id !== sensor.id) : [...prev, sensor];
    });
  }, []);

  // ── fetch reports ────────────────────────────────────────────────────────
  useEffect(() => {
    if (selected.length === 0) {
      setChartData(null);
      setAlertReports(null);
      baseDatasetsRef.current    = [];
      rawReportsBySensor.current = [];
      return;
    }

    let cancelled = false;

    async function fetchReports() {
      setLoading(true);
      setError(null);

      try {
        const interval  = getIntervalMinutes(startDate, endDate);
        const datasets  = [];
        const rawBySensor = [];

        for (let i = 0; i < selected.length; i++) {
          const sensor = selected[i];
          const params = new URLSearchParams();
          if (startDate) params.append("start", startDate);
          if (endDate)   params.append("end",   endDate);

          const { data: reports } = await api.get(
            `/api/reports/sensor/${sensor.id}?${params}`
          );

          reports.sort((a, b) => new Date(a.reportTime) - new Date(b.reportTime));

          rawBySensor.push({ sensorName: sensor.sensorName, reports });

          // group into time buckets and average
          const grouped = {};
          reports.forEach((rep) => {
            const dt      = new Date(rep.reportTime);
            const rounded = new Date(dt);
            rounded.setMinutes(
              Math.floor(dt.getMinutes() / interval) * interval, 0, 0
            );
            const key = rounded.getTime();
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(rep.gasLevel);
          });

          const values = Object.entries(grouped).map(([time, arr]) => ({
            x: Number(time),
            y: arr.reduce((a, b) => a + b, 0) / arr.length,
          }));

          const color = SENSOR_COLORS[i % SENSOR_COLORS.length];
          datasets.push({
            label:           sensor.sensorName,
            data:            values,
            borderColor:     color,
            backgroundColor: color + "22",
            tension:         0.4,
            fill:            true,
            pointRadius:     3,
            pointHoverRadius: 6,
          });
        }

        if (cancelled) return;

        baseDatasetsRef.current    = datasets;
        rawReportsBySensor.current = rawBySensor;

        setChartData({ datasets });
        setAlertReports(computeAlertReports(rawBySensor));
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setError("Erro ao carregar os dados. Tente novamente.");
          setChartData(null);
          setAlertReports(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchReports();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, startDate, endDate]);

  // ── export CSV ───────────────────────────────────────────────────────────
  function exportCsv() {
    const base = baseDatasetsRef.current;
    if (base.length === 0) return;

    const allTimestamps = [
      ...new Set(base.flatMap((ds) => ds.data.map((p) => p.x))),
    ].sort((a, b) => a - b);

    const header = ["Horario", ...base.map((ds) => ds.label)].join(";");
    const rows   = allTimestamps.map((ts) => {
      const date   = new Date(ts).toLocaleString("pt-BR");
      const values = base.map((ds) => {
        const point = ds.data.find((p) => p.x === ts);
        return point ? point.y.toFixed(2) : "";
      });
      return [date, ...values].join(";");
    });

    const csv  = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `leakwatch_${new Date().toISOString().slice(0, 16).replace("T", "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div className="app-root">

      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="side-brand">LeakWatcher</div>
        <nav>
          <a href="/">Sensores</a>
          {role === "MASTER" && <a href="/users">Gerenciar Usuários</a>}
          <a href="/results">Resultados</a>
          <a onClick={logout} style={{ cursor: "pointer" }}>Sair</a>
        </nav>
        <div className="side-footer">
          <div className="role-pill">{role}</div>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <main className="main-area">
        <div className="topbar">
          <h1>Resultados</h1>
          <div className="role-pill">{role}</div>
        </div>

        {/* LEGENDA DE NÍVEIS */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {GAS_LEVELS.map((l) => (
            <span key={l.status} style={{
              background: l.color + "18",
              color: l.color,
              border: `1px solid ${l.color}44`,
              borderRadius: 6,
              padding: "3px 10px",
              fontSize: 12,
              fontWeight: 500,
            }}>
              {l.label}
            </span>
          ))}
        </div>

        {/* FILTROS */}
        <div className="card" style={{ marginBottom: 15, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#8899aa" }}>
            Início
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#8899aa" }}>
            Fim
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>

          {(startDate || endDate) && (
            <button
              className="btn"
              style={{ marginTop: 16, alignSelf: "flex-end" }}
              onClick={() => { setStartDate(""); setEndDate(""); }}
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* SENSORES */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ marginBottom: 12 }}>Sensores</h2>
          {sensors.length === 0 ? (
            <p style={{ color: "#8899aa", fontSize: 14 }}>Nenhum sensor encontrado.</p>
          ) : (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {sensors.map((s, i) => {
                const active = selected.some((sel) => sel.id === s.id);
                const color  = SENSOR_COLORS[i % SENSOR_COLORS.length];
                return (
                  <button
                    key={s.id}
                    className="btn primary"
                    onClick={() => toggleSensor(s)}
                    style={{
                      opacity:     active ? 1 : 0.45,
                      borderRadius: 10,
                      padding:     "10px 20px",
                      borderColor: active ? color : "transparent",
                      boxShadow:   active ? `0 0 0 2px ${color}44` : "none",
                      transition:  "opacity 0.2s, box-shadow 0.2s",
                    }}
                  >
                    <span style={{
                      display: "inline-block", width: 8, height: 8,
                      borderRadius: "50%", background: color,
                      marginRight: 7, verticalAlign: "middle",
                    }} />
                    {s.sensorName}
                    <span style={{ opacity: 0.6, marginLeft: 6, fontSize: 12 }}>
                      ({s.ipAdress})
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* GRÁFICO */}
        <div className="card" style={{ minHeight: 260 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontWeight: 600, color: "#cdd6e0" }}>Gráfico</span>
            <button
              className="btn"
              onClick={exportCsv}
              disabled={!chartData}
              style={{ opacity: chartData ? 1 : 0.4, fontSize: 13, padding: "6px 14px" }}
            >
              ↓ Exportar CSV
            </button>
          </div>
          {loading ? (
            <p style={{ color: "#8899aa" }}>Carregando dados...</p>
          ) : error ? (
            <p style={{ color: "#ff6b6b" }}>{error}</p>
          ) : !chartData ? (
            <p style={{ color: "#8899aa" }}>Selecione ao menos um sensor para visualizar o gráfico.</p>
          ) : (
            <Line data={chartData} options={chartOptions} />
          )}
        </div>

        {/* ── RELATÓRIOS DE ALERTA ── */}
        {alertReports && (
          <>
            {/* 1. Histórico de alertas */}
            <div className="card" style={{ marginTop: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h2 style={{ margin: 0 }}>Histórico de Alertas</h2>
                <span style={{ fontSize: 12, color: "#8899aa" }}>
                  {alertReports.alertEvents.length} evento(s)
                </span>
              </div>

              {alertReports.alertEvents.length === 0 ? (
                <p style={{ color: "#8899aa", fontSize: 14 }}>Nenhum alerta no período selecionado.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", color: "#8899aa", textAlign: "left" }}>
                        <th style={{ padding: "8px 12px" }}>Sensor</th>
                        <th style={{ padding: "8px 12px" }}>Início</th>
                        <th style={{ padding: "8px 12px" }}>Fim</th>
                        <th style={{ padding: "8px 12px" }}>Duração</th>
                        <th style={{ padding: "8px 12px" }}>Pico (ppm)</th>
                        <th style={{ padding: "8px 12px" }}>Nível</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alertReports.alertEvents.map((ev, i) => (
                        <tr key={i} style={{
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                        }}>
                          <td style={{ padding: "8px 12px", color: "#cdd6e0", fontWeight: 500 }}>{ev.sensorName}</td>
                          <td style={{ padding: "8px 12px", color: "#cdd6e0" }}>{fmtDate(ev.start)}</td>
                          <td style={{ padding: "8px 12px", color: "#cdd6e0" }}>{fmtDate(ev.end)}</td>
                          <td style={{ padding: "8px 12px" }}>
                            <span style={{
                              background: "rgba(255,100,100,0.15)", color: "#ff8888",
                              borderRadius: 6, padding: "2px 8px", fontSize: 12,
                            }}>
                              {fmtDuration(ev.durationMs)}
                            </span>
                          </td>
                          <td style={{ padding: "8px 12px", color: "#ff8888", fontWeight: 600 }}>{ev.peak}</td>
                          <td style={{ padding: "8px 12px" }}>{statusBadge(ev.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 2. Frequência por sensor */}
            <div className="card" style={{ marginTop: 20 }}>
              <h2 style={{ marginBottom: 16 }}>Frequência de Alertas por Sensor</h2>
              {alertReports.frequency.length === 0 ? (
                <p style={{ color: "#8899aa", fontSize: 14 }}>Nenhum alerta registrado.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {alertReports.frequency.map((item, i) => {
                    const max   = Math.max(...alertReports.frequency.map((f) => f.count));
                    const pct   = (item.count / max) * 100;
                    const color = SENSOR_COLORS[
                      baseDatasetsRef.current.findIndex((d) => d.label === item.sensorName) % SENSOR_COLORS.length
                    ] || "#26c6da";
                    return (
                      <div key={i}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                          <span style={{ color: "#cdd6e0" }}>{item.sensorName}</span>
                          <span style={{ color: "#8899aa" }}>{item.count} alerta(s)</span>
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 6, height: 10, overflow: "hidden" }}>
                          <div style={{
                            width: `${pct}%`, height: "100%",
                            background: color, borderRadius: 6,
                            transition: "width 0.4s ease",
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Tempo médio de retorno ao normal */}
            <div className="card" style={{ marginTop: 20, marginBottom: 20 }}>
              <h2 style={{ marginBottom: 16 }}>Tempo Médio de Retorno ao Normal</h2>
              {alertReports.avgReturn.length === 0 ? (
                <p style={{ color: "#8899aa", fontSize: 14 }}>Nenhum dado disponível.</p>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                  {alertReports.avgReturn.map((item, i) => {
                    const color = SENSOR_COLORS[
                      baseDatasetsRef.current.findIndex((d) => d.label === item.sensorName) % SENSOR_COLORS.length
                    ] || "#26c6da";
                    return (
                      <div key={i} style={{
                        background: "rgba(255,255,255,0.04)",
                        border: `1px solid ${color}33`,
                        borderRadius: 12,
                        padding: "16px 24px",
                        minWidth: 160,
                        textAlign: "center",
                      }}>
                        <div style={{ fontSize: 11, color: "#8899aa", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
                          {item.sensorName}
                        </div>
                        <div style={{ fontSize: 28, fontWeight: 700, color }}>
                          {fmtDuration(item.avgMs)}
                        </div>
                        <div style={{ fontSize: 11, color: "#8899aa", marginTop: 4 }}>
                          média por evento
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}