import React, { useEffect, useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SensorsPage from './pages/SensorsPage'
import NotFound from './pages/NotFound'
import { api } from './api'


export default function App(){
const [role, setRole] = useState(localStorage.getItem('role') || null)
const navigate = useNavigate()


useEffect(()=>{
const token = localStorage.getItem('token')
if (token && !role) detectRole()
if (!token) navigate('/login')
}, [])


async function detectRole(){
try{
await api.get('/users')
localStorage.setItem('role','MASTER')
setRole('MASTER')
}catch(err){
if (err.response && err.response.status === 403){
localStorage.setItem('role','VIEW')
setRole('VIEW')
}
}
}


function onLogout(){
localStorage.removeItem('token')
localStorage.removeItem('role')
setRole(null)
navigate('/login')
}


return (
<Routes>
<Route path="/login" element={<Login onRoleChange={setRole} />} />
<Route path="/" element={<Dashboard onLogout={onLogout} role={role} />}>
{/* Dashboard has nested routing */}
</Route>


<Route path="/sensors" element={<SensorsPage role={role} />} />
<Route path="*" element={<NotFound/>} />
</Routes>
)
}