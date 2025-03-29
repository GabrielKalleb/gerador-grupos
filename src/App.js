import React from 'react';
import GroupGenerator from './components/GroupGenerator';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Sistema de Geração de Grupos</h1>
      </header>
      <main>
        <GroupGenerator />
      </main>
      <footer>
        <p>© 2025 - Gerador de Grupos</p>
      </footer>
    </div>
  );
}

export default App;