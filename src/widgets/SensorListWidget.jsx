import React, { useEffect, useState } from 'react'
import { api } from '../api'


export default function SensorListWidget(){
const [count,setCount] = useState(0)
useEffect(()=>{ api.get('/sensors').then(r=>setCount(r.data.length)).catch(()=>{}) },[])
return (
<div className="card">
<h3>Quantidade de sensores</h3>
<div className="big">{count}</div>
</div>
)
}