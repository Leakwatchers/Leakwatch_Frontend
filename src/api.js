import axios from "axios";

export const api = axios.create({
  baseURL: "http://localhost:8080"
});

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("jwt");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});
