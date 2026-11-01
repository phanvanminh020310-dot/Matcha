import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import '@xyflow/react/dist/style.css'

// CÔNG CỤ GỠ LỖI Ở CHẾ ĐỘ PHÁT TRIỂN (biến mất hoàn toàn trong bản build GitHub Pages):
//   __matchaTurso.tursoTest() … để kiểm tra đồng bộ Turso ngay trong Console.
if (import.meta.env.DEV || import.meta.env.VITE_TURSO_DEBUG) {
  void import('./lib/turso').then((m) => { (window as unknown as Record<string, unknown>).__matchaTurso = m })
  void import('./lib/db').then((m) => { (window as unknown as Record<string, unknown>).__matchaDb = m })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
