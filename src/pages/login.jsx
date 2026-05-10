import { useState } from "react";
import { api } from "../api";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import ThemeToggle from "../components/ThemeToggle";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const nav = useNavigate();

  async function submit(e) {
    e.preventDefault();
    try {
      const r = await api.post("/auth/login", { username, password });
      localStorage.setItem("jwt", r.data.token);
      window.location.href = "/";
    } catch (e) {
      setError("Usuário ou senha inválidos.");
    }
  }

  return (
    <div className="center-page">

      {/* Botão de tema fixo no canto superior direito */}
      <div style={{ position: "fixed", top: 16, right: 16 }}>
        <ThemeToggle />
      </div>

      <div className="card login-card">
        <form onSubmit={submit} className="form">
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            <img src={logo} alt="LeakWatcher" className="logo" />
          </div>
          <h2>Entrar</h2>
          <input
            className="input"
            placeholder="Usuário"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            className="input"
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="btn primary">Login</button>
          {error && <p className="error">{error}</p>}
        </form>
      </div>

    </div>
  );
}