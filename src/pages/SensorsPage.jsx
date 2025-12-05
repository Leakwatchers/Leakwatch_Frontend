import React from 'react'
import SensorTable from '../components/SensorTable'


export default function SensorsPage({ role }){
return (
<div className="app-root">
<aside className="sidebar">
<div className="side-brand">LeakWatcher</div>
<nav>
<a href="/">Dashboard</a>
<a href="/sensors">Sensores</a>
</nav>
</aside>


<main className="main-area">
<header className="topbar">
<h1>Sensores</h1>
<div className="role-pill">{role}</div>
</header>


<div className="content">
<SensorTable role={role} />
</div>
</main>
</div>
)
}