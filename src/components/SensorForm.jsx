import React, { useState } from "react";
import { api } from "../api";

export default function SensorForm({ initial, onSaved, onCancel }) {
  const isNew = !initial || !initial.ipAdress;

  const [ipAdress, setipAdress] = useState(initial?.ipAdress || "");
  const [name, setName] = useState(initial?.sensorName || "");
  const [type, setType] = useState(initial?.sensorType || "");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);

    const payload = {
      ipAdress: ipAdress,
      sensorName: name,
      sensorType: type
    };

    try {
      if (isNew) {
        await api.post("/sensors", payload);
      } else {
        await api.put(`/sensors/${ipAdress}`, payload);
      }

      onSaved && onSaved();
    } catch (err) {
      alert("Erro ao salvar sensor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal">
      <div className="modal-content">

        <h3>{isNew ? "Novo Sensor" : "Editar Sensor"}</h3>

        <form className="form" onSubmit={submit}>
          <input
            value={ipAdress}
            onChange={(e) => setipAdress(e.target.value)}
            placeholder="Endereço IP"
            required
            disabled={!isNew}
          />

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome do Sensor"
            required
          />

          <input
            value={type}
            onChange={(e) => setType(e.target.value)}
            placeholder="Tipo (1 letra)"
            maxLength={1}
            required
          />

          <div className="form-actions">
            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </button>

            <button className="btn ghost" type="button" onClick={onCancel}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
