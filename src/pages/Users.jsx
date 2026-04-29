import React, { useEffect, useState } from "react";
import { api } from "../api";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [telefone, setTelefone] = useState(""); // <-- ADICIONADO
  const [role, setRole] = useState("VIEW");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  async function loadUsers() {
    const r = await api.get("/users");
    setUsers(r.data);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function createUser(e) {
    e.preventDefault();
    try {
      await api.post("/users", { username, password, role, telefone }); 
      setSuccess("Usuário criado com sucesso!");
      setError(null);
      setUsername("");
      setPassword("");
      setTelefone(""); 
      setRole("VIEW");
      loadUsers();
    } catch {
      setError("Erro ao criar usuário.");
      setSuccess(null);
    }
  }

  async function removeUser(id) {
    if (!confirm("Deseja remover este usuário?")) return;
    await api.delete(`/users/${id}`);
    loadUsers();
  }

  return (
    <div className="app-root">

      <aside className="sidebar">
        <div className="side-brand">LeakWatcher</div>

        <nav>
          <a href="/">Dashboard</a>
          <a href="/results">Resultados</a>
          <a onClick={() => { localStorage.clear(); window.location.href="/login"; }}
             style={{ cursor: "pointer" }}>
            Sair
          </a>
          
        </nav>

        <div className="side-footer">
          <div className="role-pill">MASTER</div>
        </div>
      </aside>

      <main className="main-area">
        <div className="topbar">
          <h1>Gerenciar Usuários</h1>
        </div>

        <div style={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
          marginBottom: "30px"
        }}>
          <div className="card" style={{ width: "350px", padding: "20px" }}>
            <h3 style={{ textAlign: "center" }}>Cadastrar Usuário</h3>

            <form onSubmit={createUser} className="form">
              <input
                className="input"
                placeholder="Usuário"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />

              <input
                className="input"
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              {/* TELEFONE */}
              <input
                className="input"
                placeholder="Telefone"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                required
              />

              <select
                className="input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="MASTER">MASTER</option>
                <option value="VIEW">VIEW</option>
              </select>

              <button className="btn primary" style={{ width: "100%" }}>
                Criar Usuário
              </button>

              {error && <p className="error">{error}</p>}
              {success && <p className="success">{success}</p>}
            </form>
          </div>
        </div>

        <table className="table">
            <thead>
            <tr>
              <th>ID</th>
              <th>Usuário</th>
              <th>Telefone</th>
              <th>Role</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.username}</td>
                <td>{u.telefone}</td> {/* ALTERADO */}
                <td>{u.role.replace("ROLE_", "")}</td>
                <td>
                  <button className="btn danger" onClick={() => removeUser(u.id)}>
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

      </main>

    </div>
  );
}