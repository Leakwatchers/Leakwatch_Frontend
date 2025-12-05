import React, { useEffect, useState } from "react";
import { api } from "../api";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Legend,
  Tooltip
} from "chart.js";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Legend, Tooltip);

export default function Results() {
  const [sensors, setSensors] = useState([]);
  const [selected, setSelected] = useState(null);
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    loadSensors();
  }, []);

  async function loadSensors() {
  try {
    const r = await api.get("/sensors"); // <-- AGORA CORRETO
    setSensors(r.data);
  } catch (e) {
    console.error("Erro ao carregar sensores:", e);
  }
}


  async function loadReports(sensorName) {
    setSelected(sensorName);

    try {
      const r = await api.get(`/api/reports/sensor/${sensorName}`);

      const reports = r.data;

      // Ordenar por horário
      reports.sort(
        (a, b) => new Date(a.reportTime) - new Date(b.reportTime)
      );

      // Labels a cada 10min
      const labels = reports.map(rep => {
        const dt = new Date(rep.reportTime);
        return dt.getHours().toString().padStart(2, "0") +
               ":" +
               Math.floor(dt.getMinutes() / 10) * 10
                 .toString()
                 .padStart(2, "0");
      });

      const values = reports.map(rep => rep.gasLevel);

      setChartData({
        labels,
        datasets: [
          {
            label: `Nível de gás - ${sensorName}`,
            data: values,
            borderColor: "#26c6da",
            backgroundColor: "rgba(0, 188, 212, 0.25)",
            tension: 0.4,
            fill: true,
            pointRadius: 3,
          }
        ]
      });

    } catch (e) {
      console.error("Erro ao carregar relatórios:", e);
      setChartData(null);
    }
  }

  return (
    <div className="app-root">

      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="side-brand">LeakWatcher</div>

        <nav>
          <a href="/">Dashboard</a>
          <a href="/results">Resultados</a>
          <a href="/users">Gerenciar Usuários</a>
        </nav>
      </aside>

      {/* MAIN */}
      <main className="main-area">

        <div className="topbar">
          <h1>Resultados de Monitoramento</h1>
        </div>

        {/* LISTA DE SENSORES */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2>Sensores Disponíveis</h2>

          {sensors.length === 0 && <p>Nenhum sensor encontrado.</p>}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {sensors.map(s => (
              <button
                key={s.id}
                className="btn primary"
                onClick={() => loadReports(s.name)}
                style={{
                  padding: "10px 20px",
                  borderRadius: 10,
                  cursor: "pointer"
                }}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* GRÁFICO */}
        <div className="card">
          <h2>Histórico de Nível de Gás</h2>

          {!chartData ? (
            <p>Selecione um sensor para visualizar.</p>
          ) : (
            <Line data={chartData} />
          )}
        </div>

      </main>
    </div>
  );
}
