import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/login";
import Dashboard from "./pages/dashboard";
import Users from "./pages/Users";
import Results from "./pages/Results";


export default function App() {
  const token = localStorage.getItem("jwt");

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={token ? <Dashboard /> : <Navigate to="/login" />}
      />

      <Route
        path="/users"
        element={token ? <Users /> : <Navigate to="/login" />}
      />

      <Route
        path="/results"
        element={token ? <Results /> : <Navigate to="/login" />}
      />

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
