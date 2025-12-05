
import { useEffect, useState } from "react";
import { api } from "../api"; // Certifique-se que api.js adiciona Authorization: Bearer token

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("view");
  const [error, setError] = useState(null);

  async function loadUsers() {
    try {
      setLoading(true);
      const resp = await api.get("/users");
      setUsers(resp.data);
    } catch (e) {
      setError("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function criarUsuario(e) {
    e.preventDefault();
    setError(null);

    try {
      await api.post("/users", {
        username,
        password,
        role
      });

      setUsername("");
      setPassword("");
      setRole("view");
      loadUsers();
    } catch (e) {
      setError("Erro ao criar usuário. Nome já existe?");
    }
  }

  async function removerUsuario(id) {
    if (!confirm("Tem certeza que deseja remover?")) return;
    try {
      await api.delete(`/users/${id}`);
      loadUsers();
    } catch (e) {
      setError("Erro ao remover usuário");
    }
  }

  return (
    <div>
      <h1>Gerenciamento de Usuários</h1>

      <div className="card form-card" style={{ maxWidth: "480px", marginBottom: "22px" }}>
        <h2>Novo Usuário</h2>

        <form className="form" onSubmit={criarUsuario}>
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

          <select
            className="input"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="master">MASTER</option>
            <option value="view">VIEW</option>
          </select>

          <button className="btn primary" type="submit">Criar Usuário</button>
        </form>

        {error && <div className="error">{error}</div>}
      </div>

      <div className="card">
        <h2>Lista de Usuários</h2>

        {loading ? (
          <p>Carregando...</p>
        ) : (
          <table className="table sensors-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Role</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.username}</td>
                  <td>
                    <span className="role-pill">{u.role.replace("ROLE_", "")}</span>
                  </td>
                  <td>
                    <button
                      className="btn danger small"
                      onClick={() => removerUsuario(u.id)}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
