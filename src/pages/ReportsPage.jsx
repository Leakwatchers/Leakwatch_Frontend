import { useEffect, useState } from "react";
import { api } from "../api";


export default function ReportsPage() {
const [reports, setReports] = useState([]);
const [loading, setLoading] = useState(true);


async function load() {
setLoading(true);
const r = await api.get("/api/reports");
setReports(r.data);
setLoading(false);
}


useEffect(() => { load(); }, []);


return (
<div>
<h1>Relatórios</h1>
<div className="card">
{loading ? "Carregando..." : (
<table className="table sensors-table">
<thead>
<tr>
<th>MAC</th>
<th>Nível</th>
<th>Status</th>
<th>Data/Hora</th>
</tr>
</thead>
<tbody>
{reports.map((r) => (
<tr>
<td>{r.macAddress}</td>
<td>{r.gasLevel}</td>
<td>{r.status}</td>
<td>{new Date(r.reportTime).toLocaleString()}</td>
</tr>
))}
</tbody>
</table>
)}
</div>
</div>
);
}