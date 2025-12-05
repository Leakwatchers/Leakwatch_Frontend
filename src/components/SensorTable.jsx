import React, { useEffect, useState } from "react";
import { api } from "../api";
import SensorForm from "./SensorForm";

export default function SensorTable({ role }) {
  const [sensors, setSensors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/sensors");
      setSensors(res.data);
    } catch (err) {
      setError("Falha ao carregar sensores");
    } finally {
      setLoading(false);
    }
  }

  async function removeSensor(mac) {
    if (!confirm("Remover sensor?")) return;
    try {
      await api.delete(`/sensors/${mac}`);
      load();
    } catch {
      alert("Erro ao remover");
    }
  }

  async function pingSensor(mac) {
    try {
      await api.post(`/sensors/${mac}/ping`);
      setTimeout(() => load(), 2000);
    } catch {
      alert("Falha ao enviar PING");
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>Sensores</h2>
        {role === "MASTER" && (
          <button className="btn primary" onClick={() => setEditing({})}>
            Novo Sensor
          </button>
        )}
      </div>

      {loading ? (
        <div>Carregando...</div>
      ) : (
        <table className="table sensors-table">
          <thead>
            <tr>
              <th style={{ width: "170px" }}>MAC</th>
              <th style={{ width: "150px" }}>Nome</th>
              <th style={{ width: "80px" }}>Tipo</th>
              <th style={{ width: "110px" }}>Conectado</th>
              <th style={{ width: "200px" }}>Ações</th>
            </tr>
          </thead>

          <tbody>
            {sensors.map((s) => (
              <tr key={s.macAddress}>
                <td>{s.macAddress}</td>
                <td>{s.sensorName}</td>
                <td>{s.sensorType}</td>
                <td>
                  {s.isConnected ? (
                    <span className="status online">Sim</span>
                  ) : (
                    <span className="status offline">Não</span>
                  )}
                </td>

                <td>
                  <button className="btn small" onClick={() => pingSensor(s.macAddress)}>
                    PING
                  </button>

                  {role === "MASTER" && (
                    <>
                      <button
                        className="btn small ghost"
                        onClick={() => setEditing(s)}
                        style={{ marginLeft: "5px" }}
                      >
                        Editar
                      </button>

                      <button
                        className="btn small danger"
                        onClick={() => removeSensor(s.macAddress)}
                        style={{ marginLeft: "5px" }}
                      >
                        Excluir
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <SensorForm
          initial={editing}
          onSaved={() => {
            setEditing(null);
            load();
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {error && <div className="error">{error}</div>}
    </div>
  );
}
