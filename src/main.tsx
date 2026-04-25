import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// 接收主进程消息
window.electronAPI.on('main-process-message', (message) => {
  // eslint-disable-next-line no-console
  console.log(message)
})
