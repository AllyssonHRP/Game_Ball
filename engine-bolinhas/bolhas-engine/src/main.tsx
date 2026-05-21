import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Se você apagou o arquivo index.css, remova a linha abaixo.
// Se você manteve o arquivo, pode deixar a linha.
import './index.css' 

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)