import { useState } from "react";
import { api } from "../api";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const nav = useNavigate();

  async function submit(e) {
    e.preventDefault();
    try {
      const r = await api.post("/auth/login", { username, password });
      localStorage.setItem("jwt", r.data.token);   // <-- OK
      window.location.href = "/";
    } catch (e) {
      setError("Usuário ou senha inválidos.");
    }
  }

  return (
    <div className="center-page">
      <div className="card login-card">
        <form onSubmit={submit} className="form">
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
