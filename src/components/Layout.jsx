import ThemeToggle from "./ThemeToggle";

export default function Layout({ children, role, onLogout }) {
  return (
    <div className="app-root">
      <aside className="sidebar">
        <div className="side-brand">LeakWatcher</div>
        <nav>
          <a href="/">Sensores</a>
          {role === "MASTER" && <a href="/users">Gerenciar Usuários</a>}
          <a href="/results">Resultados</a>
          <a onClick={onLogout} style={{ cursor: "pointer" }}>Sair</a>
        </nav>
        <div className="side-footer">
          <ThemeToggle />
          <div className="role-pill">{role}</div>
        </div>
      </aside>

      <main className="main-area">
        {children}
      </main>
    </div>
  );
}
