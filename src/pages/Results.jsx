import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
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
import Layout from "../components/Layout";

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

const SENSOR_COLORS = [
  "#26c6da", "#ff6384", "#ffcd56",
  "#4bc0c0", "#9966ff", "#ff9f40",
];

const ZONE_ANNOTATIONS = {
  zoneOk:      { type: "box", yMin: 0,    yMax: 400,  backgroundColor: "rgba(76,175,80,0.05)",   borderWidth: 0 },
  zoneAlerta:  { type: "box", yMin: 400,  yMax: 1000, backgroundColor: "rgba(255,205,86,0.05)",  borderWidth: 0 },
  zoneCritico: { type: "box", yMin: 1000, yMax: 2000, backgroundColor: "rgba(255,159,64,0.07)",  borderWidth: 0 },
  zoneRisco:   { type: "box", yMin: 2000,             backgroundColor: "rgba(255,68,68,0.08)",   borderWidth: 0 },
  lineAlerta:  {
    type: "line", yMin: 400,  yMax: 400,
    borderColor: "rgba(255,205,86,0.4)", borderWidth: 1, borderDash: [4, 4],
    label: { content: "Alerta 400",   display: true, position: "end", color: "#ffcd56", font: { size: 10 } },
  },
  lineCritico: {
    type: "line", yMin: 1000, yMax: 1000,
    borderColor: "rgba(255,159,64,0.4)", borderWidth: 1, borderDash: [4, 4],
    label: { content: "Crítico 1000", display: true, position: "end", color: "#ff9f40", font: { size: 10 } },
  },
  lineRisco: {
    type: "line", yMin: 2000, yMax: 2000,
    borderColor: "rgba(255,68,68,0.5)",  borderWidth: 1, borderDash: [4, 4],
    label: { content: "Risco 2000",   display: true, position: "end", color: "#ff4444", font: { size: 10 } },
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

function computeEnhancedReports(rawReportsBySensor) {
  const alertEvents = [];
  const hourlyDistribution = Array(24).fill(0);
  const sensorStats = {};
  const timeInStatus = { OK: 0, ANOMALY: 0 }; // ANOMALY = tudo >= 400 ppm
  let totalReadings = 0;

  rawReportsBySensor.forEach(({ sensorName, reports }) => {
    const sorted = [...reports].sort((a, b) => new Date(a.reportTime) - new Date(b.reportTime));
    
    if (!sensorStats[sensorName]) {
      sensorStats[sensorName] = { 
        maxPpm: 0, 
        avgPpm: 0, 
        countRisco: 0, 
        countCritico: 0, 
        countAlerta: 0,
        countAnomalies: 0, // Tudo >= 400
        totalPpm: 0,
        readings: 0,
        delays: [],
      };
    }

    let eventStart = null;
    let eventStatus = null;
    let peak = 0;

    sorted.forEach((rep, idx) => {
      const isAnomalous = rep.gasLevel >= 400; // Tudo >= 400 é anomalia
      const repTime = new Date(rep.reportTime);
      const hour = repTime.getHours();
      
      // Stats per sensor
      sensorStats[sensorName].readings++;
      sensorStats[sensorName].totalPpm += rep.gasLevel;
      if (rep.gasLevel > sensorStats[sensorName].maxPpm) sensorStats[sensorName].maxPpm = rep.gasLevel;
      if (rep.status === "RISCO") sensorStats[sensorName].countRisco++;
      if (rep.status === "CRITICO") sensorStats[sensorName].countCritico++;
      if (rep.status === "ALERTA") sensorStats[sensorName].countAlerta++;
      if (isAnomalous) sensorStats[sensorName].countAnomalies++;

      // Global status time (OK vs ANOMALY)
      timeInStatus[isAnomalous ? "ANOMALY" : "OK"]++;
      totalReadings++;

      // Performance: delay between readings
      if (idx > 0) {
        const prevTime = new Date(sorted[idx-1].reportTime);
        const delay = (repTime - prevTime) / 1000; // seconds
        sensorStats[sensorName].delays.push(delay);
      }

      if (isAnomalous) {
        hourlyDistribution[hour]++;
        if (eventStart === null) {
          eventStart = repTime.getTime();
          eventStatus = rep.status;
          peak = rep.gasLevel;
        } else {
          if (rep.gasLevel > peak) peak = rep.gasLevel;
          const levels = ["ALERTA", "CRITICO", "RISCO"];
          if (levels.indexOf(rep.status) > levels.indexOf(eventStatus)) {
            eventStatus = rep.status;
          }
        }
      } else if (eventStart !== null) {
        alertEvents.push({
          sensorName,
          start: eventStart,
          end: repTime.getTime(),
          peak: Math.round(peak * 100) / 100,
          status: eventStatus,
          durationMs: repTime.getTime() - eventStart,
        });
        eventStart = null; peak = 0;
      }

      if (isAnomalous && idx === sorted.length - 1 && eventStart !== null) {
        alertEvents.push({
          sensorName,
          start: eventStart,
          end: repTime.getTime(),
          peak: Math.round(peak * 100) / 100,
          status: eventStatus,
          durationMs: repTime.getTime() - eventStart,
        });
      }
    });

    sensorStats[sensorName].avgPpm = sensorStats[sensorName].totalPpm / sensorStats[sensorName].readings;
  });

  // Ranking - ordenar por anomalias (400+), depois por pico máximo
  const ranking = Object.entries(sensorStats).map(([name, stats]) => ({
    sensorName: name,
    ...stats
  })).sort((a, b) => b.countAnomalies - a.countAnomalies || b.maxPpm - a.maxPpm);

  return { 
    alertEvents, 
    ranking, 
    hourlyDistribution, 
    timeInStatus, 
    totalReadings,
    sensorStats 
  };
}

function fmtDuration(ms) {
  if (ms < 60_000)    return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}min`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function fmtDate(ts) {
  return new Date(ts).toLocaleString("pt-BR");
}

// ============================================================
// Componentes Auxiliares
// ============================================================
function CollapsibleSection({ title, count, children, defaultOpen = true, icon = "▼" }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: isOpen ? 12 : 0,
          cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 24,
              borderRadius: 4,
              background: "var(--input-bg)",
              color: "var(--accent)",
              fontSize: 14,
              fontWeight: 600,
              transition: "transform 0.3s ease",
              transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)",
            }}
          >
            {icon}
          </span>
          <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "var(--text-dim)" }}>
            {title}
          </h2>
        </div>
        {count !== undefined && (
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {count}
          </span>
        )}
      </div>

      {isOpen && (
        <div style={{ animation: "fadeIn 0.3s ease" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function KPICard({ label, value, subValue, color = "var(--accent)" }) {
  return (
    <div style={{
      background: "var(--card)",
      padding: "16px",
      borderRadius: "12px",
      border: "1px solid var(--card-border)",
      flex: "1 1 180px",
      minWidth: "150px",
      boxShadow: "var(--shadow-card)"
    }}>
      <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "8px", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: "24px", fontWeight: "700", color: color }}>{value}</div>
      {subValue && <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>{subValue}</div>}
    </div>
  );
}

export default function Results() {
  const [sensors, setSensors]           = useState([]);
  const [selected, setSelected]         = useState([]);
  const [chartData, setChartData]       = useState(null);
  const [enhancedData, setEnhancedData] = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [role, setRole]                 = useState("");
  const [startDate, setStartDate]       = useState("");
  const [endDate, setEndDate]           = useState("");

  const baseDatasetsRef    = useRef([]);
  const rawReportsBySensor = useRef([]);

  useEffect(() => {
    api.get("/users")
      .then(() => setRole("MASTER"))
      .catch(() => setRole("VIEW"));
  }, []);

  function logout() {
    localStorage.clear();
    window.location.href = "/login";
  }

  useEffect(() => {
    api.get("/sensors")
      .then((r) => setSensors(r.data))
      .catch(() => setError("Não foi possível carregar os sensores."));
  }, []);

  const toggleSensor = useCallback((sensor) => {
    setSelected((prev) => {
      const exists = prev.some((s) => s.id === sensor.id);
      return exists ? prev.filter((s) => s.id !== sensor.id) : [...prev, sensor];
    });
  }, []);

  useEffect(() => {
    if (selected.length === 0) {
      setChartData(null);
      setEnhancedData(null);
      baseDatasetsRef.current    = [];
      rawReportsBySensor.current = [];
      return;
    }

    let cancelled = false;

    async function fetchReports() {
      setLoading(true);
      setError(null);

      try {
        const interval    = getIntervalMinutes(startDate, endDate);
        const datasets    = [];
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

          const grouped = {};
          reports.forEach((rep) => {
            const dt      = new Date(rep.reportTime);
            const rounded = new Date(dt);
            rounded.setMinutes(Math.floor(dt.getMinutes() / interval) * interval, 0, 0);
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
            label:            sensor.sensorName,
            data:             values,
            borderColor:      color,
            backgroundColor:  color + "22",
            tension:          0.4,
            fill:             true,
            pointRadius:      3,
            pointHoverRadius: 6,
          });
        }

        if (cancelled) return;

        baseDatasetsRef.current = datasets;
        rawReportsBySensor.current = rawBySensor;

        setChartData({ datasets });
        setEnhancedData(computeEnhancedReports(rawBySensor));
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setError("Erro ao carregar os dados. Tente novamente.");
          setChartData(null);
          setEnhancedData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchReports();
    return () => { cancelled = true; };
  }, [selected, startDate, endDate]);

  const offlineSensors = useMemo(() => {
    return sensors.filter(s => {
      if (!s.lastSeen) return true;
      const lastSeen = new Date(s.lastSeen);
      const diffMinutes = (new Date() - lastSeen) / 60000;
      return diffMinutes > 10; // Consider offline if no data for 10 min
    });
  }, [sensors]);

  function exportCsv() {
    const base = baseDatasetsRef.current;
    if (base.length === 0) return;
    const allTimestamps = [...new Set(base.flatMap((ds) => ds.data.map((p) => p.x)))].sort((a, b) => a - b);
    const header = ["Horario", ...base.map((ds) => ds.label)].join(";");
    const rows = allTimestamps.map((ts) => {
      const date = new Date(ts).toLocaleString("pt-BR");
      const values = base.map((ds) => {
        const point = ds.data.find((p) => p.x === ts);
        return point ? point.y.toFixed(2) : "";
      });
      return [date, ...values].join(";");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leakwatch_report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Layout role={role} onLogout={logout}>
      <div className="topbar">
        <h1>Dashboard de Resultados</h1>
        <div className="role-pill">{role}</div>
      </div>

      {/* KPI DASHBOARD */}
      {enhancedData && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          <KPICard 
            label="Total de Anomalias (≥400 ppm)" 
            value={enhancedData.alertEvents.length} 
            subValue="Períodos detectados"
            color={enhancedData.alertEvents.length > 0 ? "var(--danger)" : "var(--success)"}
          />
          <KPICard 
            label="Sensores Offline" 
            value={offlineSensors.length} 
            subValue="Ação requerida"
            color={offlineSensors.length > 0 ? "var(--danger)" : "var(--success)"}
          />
          <KPICard 
            label="Pico Máximo" 
            value={`${Math.max(...enhancedData.ranking.map(s => s.maxPpm)).toFixed(0)} ppm`} 
            subValue="Maior leitura registrada"
            color="var(--danger)"
          />
          <KPICard 
            label="% Tempo em Anomalia" 
            value={`${((enhancedData.timeInStatus.ANOMALY / enhancedData.totalReadings) * 100 || 0).toFixed(1)}%`} 
            subValue="Divergente de OK"
            color="var(--critical)"
          />
        </div>
      )}

      {/* FILTROS E SENSORES */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 15, marginBottom: 20 }}>
        <div className="card">
          <h2>Filtros de Período</h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--muted)" }}>
              Início <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--muted)" }}>
              Fim <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
          </div>
          {(startDate || endDate) && (
            <button className="btn small" style={{ marginTop: 10 }} onClick={() => { setStartDate(""); setEndDate(""); }}>Limpar</button>
          )}
        </div>

        <div className="card">
          <h2>Sensores</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {sensors.map((s, i) => {
              const active = selected.some((sel) => sel.id === s.id);
              const color = SENSOR_COLORS[i % SENSOR_COLORS.length];
              return (
                <button key={s.id} className="btn small" onClick={() => toggleSensor(s)}
                  style={{ opacity: active ? 1 : 0.4, border: `1px solid ${active ? color : "transparent"}` }}>
                  {s.sensorName}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* GRÁFICO PRINCIPAL */}
      <div className="card" style={{ minHeight: 300, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontWeight: 600 }}>Monitoramento em Tempo Real</span>
          <button className="btn small ghost" onClick={exportCsv} disabled={!chartData}>↓ CSV</button>
        </div>
        {loading ? <p>Carregando...</p> : error ? <p style={{color:"red"}}>{error}</p> : !chartData ? <p>Selecione um sensor.</p> : <Line data={chartData} options={chartOptions} />}
      </div>

      {/* NOVOS RELATÓRIOS */}
      {enhancedData && (
        <>
          {/* SENSORES OFFLINE */}
          <CollapsibleSection title="Status de Conectividade (Sensores Offline)" icon="📡" defaultOpen={offlineSensors.length > 0}>
            {offlineSensors.length === 0 ? (
              <p style={{ color: "var(--success)", fontSize: 13 }}>Todos os sensores estão operando normalmente.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr><th>Sensor</th><th>IP</th><th>Última Comunicação</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {offlineSensors.map(s => (
                    <tr key={s.id}>
                      <td>{s.sensorName}</td>
                      <td>{s.ipAdress}</td>
                      <td>{s.lastSeen ? fmtDate(s.lastSeen) : "Nunca"}</td>
                      <td><span className="status offline">OFFLINE</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CollapsibleSection>

          {/* RANKING DE CRITICIDADE */}
          <CollapsibleSection title="Ranking de Sensores Críticos" icon="🏆">
            <table className="table">
              <thead>
                <tr><th>Sensor</th><th>Pico Máx</th><th>Média PPM</th><th>Anomalias (≥400)</th><th>Status</th></tr>
              </thead>
              <tbody>
                {enhancedData.ranking.map((s, i) => (
                  <tr key={i}>
                    <td>{s.sensorName}</td>
                    <td style={{color:"var(--danger)", fontWeight:600}}>{s.maxPpm.toFixed(1)}</td>
                    <td>{s.avgPpm.toFixed(1)}</td>
                    <td style={{color:"var(--danger)", fontWeight:600}}>{s.countAnomalies}</td>
                    <td>{s.countAnomalies > 5 ? statusBadge("RISCO") : s.countAnomalies > 0 ? statusBadge("ALERTA") : statusBadge("OK")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CollapsibleSection>

          {/* HISTÓRICO DETALHADO POR NÍVEL */}
          <CollapsibleSection title="Histórico Detalhado de Eventos" icon="📜" count={`${enhancedData.alertEvents.length} eventos`}>
            <div style={{ display: "flex", gap: 10, marginBottom: 15 }}>
              {["RISCO", "CRITICO", "ALERTA"].map(level => (
                <div key={level} style={{ padding: "10px", borderRadius: "8px", background: "var(--input-bg)", flex: 1 }}>
                  <div style={{ fontSize: "11px", color: "var(--muted)" }}>{level}</div>
                  <div style={{ fontSize: "18px", fontWeight: "700" }}>{enhancedData.alertEvents.filter(e => e.status === level).length}</div>
                </div>
              ))}
            </div>
            <div style={{ maxHeight: "400px", overflowY: "auto" }}>
              <table className="table">
                <thead>
                  <tr><th>Sensor</th><th>Início</th><th>Duração</th><th>Pico</th><th>Nível</th></tr>
                </thead>
                <tbody>
                  {enhancedData.alertEvents.map((ev, i) => (
                    <tr key={i}>
                      <td>{ev.sensorName}</td>
                      <td>{fmtDate(ev.start)}</td>
                      <td>{fmtDuration(ev.durationMs)}</td>
                      <td>{ev.peak}</td>
                      <td>{statusBadge(ev.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>

          {/* HEATMAP DE HORÁRIOS */}
          <CollapsibleSection title="Análise de Horários de Risco (Heatmap)" icon="🔥">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 5, marginTop: 10 }}>
              {enhancedData.hourlyDistribution.map((count, hr) => {
                const opacity = Math.min(count / 10, 1);
                return (
                  <div key={hr} style={{
                    background: `rgba(255, 68, 68, ${0.1 + opacity * 0.9})`,
                    padding: "10px 5px",
                    borderRadius: "4px",
                    textAlign: "center",
                    border: count > 0 ? "1px solid var(--danger)" : "1px solid var(--card-border)"
                  }}>
                    <div style={{ fontSize: "10px", color: count > 5 ? "#fff" : "var(--muted)" }}>{hr}h</div>
                    <div style={{ fontSize: "12px", fontWeight: "700", color: count > 5 ? "#fff" : "var(--text)" }}>{count}</div>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "10px" }}>* Mostra a quantidade de leituras com anomalia (≥400 ppm) por hora do dia.</p>
          </CollapsibleSection>

          {/* TEMPO EM CADA ESTADO */}
          <CollapsibleSection title="Distribuição de Tempo por Estado" icon="📊">
            <div style={{ display: "flex", height: "30px", borderRadius: "15px", overflow: "hidden", margin: "20px 0" }}>
              {GAS_LEVELS.map(level => {
                const pct = (enhancedData.timeInStatus[level.status] / enhancedData.totalReadings) * 100 || 0;
                return (
                  <div key={level.status} style={{ 
                    width: `${pct}%`, 
                    background: level.color, 
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "10px",
                    color: "#fff",
                    minWidth: pct > 5 ? "auto" : "0"
                  }}>
                    {pct > 5 ? `${pct.toFixed(1)}%` : ""}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-around" }}>
              {GAS_LEVELS.map(level => (
                <div key={level.status} style={{ textAlign: "center" }}>
                  <div style={{ width: "12px", height: "12px", background: level.color, borderRadius: "50%", display: "inline-block", marginRight: "5px" }}></div>
                  <span style={{ fontSize: "12px" }}>{level.status}</span>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* DESEMPENHO E CALIBRAÇÃO */}
          <CollapsibleSection title="Diagnóstico de Desempenho do Sensor" icon="⚙️">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 15 }}>
              {Object.entries(enhancedData.sensorStats).map(([name, stats]) => {
                const avgDelay = stats.delays.reduce((a, b) => a + b, 0) / stats.delays.length || 0;
                const status = avgDelay > 60 ? "Atrasado" : "Normal";
                return (
                  <div key={name} style={{ flex: 1, minWidth: "200px", padding: "15px", background: "var(--input-bg)", borderRadius: "10px" }}>
                    <div style={{ fontWeight: "600", marginBottom: "10px" }}>{name}</div>
                    <div style={{ fontSize: "12px", color: "var(--muted)" }}>Intervalo Médio: <b>{avgDelay.toFixed(1)}s</b></div>
                    <div style={{ fontSize: "12px", color: "var(--muted)" }}>Status de Rede: <b style={{ color: status === "Normal" ? "var(--success)" : "var(--danger)" }}>{status}</b></div>
                    <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "5px" }}>Falsos Alertas (&lt;30s): <b>{enhancedData.alertEvents.filter(e => e.sensorName === name && e.durationMs < 30000).length}</b></div>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>
        </>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        .table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .table th, .table td { padding: 10px; border-bottom: 1px solid var(--card-border); text-align: left; }
        .table th { color: var(--muted); font-size: 11px; text-transform: uppercase; }
        .status.offline { background: rgba(255, 68, 68, 0.1); color: var(--danger); padding: 2px 8px; borderRadius: 4px; font-size: 11px; }
      `}</style>
    </Layout>
  );
}
