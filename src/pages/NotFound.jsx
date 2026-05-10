import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {

  return (
    <div
      className="center-page"
      style={{
        flexDirection: "column",
        textAlign: "center",
        gap: 16,
      }}
    >

      <h1
        style={{
          fontSize: 72,
          margin: 0,
          fontWeight: 800,
        }}
      >
        404
      </h1>

      <h2
        style={{
          margin: 0,
        }}
      >
        Página não encontrada
      </h2>

      <p
        style={{
          color: "#8899aa",
          maxWidth: 400,
        }}
      >
        A página que você tentou acessar não existe
        ou foi removida.
      </p>

      <Link
        to="/"
        className="btn primary"
        style={{
          textDecoration: "none",
        }}
      >
        Voltar ao início
      </Link>

    </div>
  );
}