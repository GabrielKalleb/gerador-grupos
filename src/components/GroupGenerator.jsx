import React, { useState, useRef } from 'react';
import './GroupGenerator.css'; // Arquivo CSS separado para estilização

const GroupGenerator = () => {
  const [numTables, setNumTables] = useState(3);
  const [peoplePerTable, setPeoplePerTable] = useState(4);
  const [numRounds, setNumRounds] = useState(3);
  const [participants, setParticipants] = useState([]);
  const [currentParticipant, setCurrentParticipant] = useState('');
  const [generatedGroups, setGeneratedGroups] = useState(null);
  const [individualRoutes, setIndividualRoutes] = useState(null);
  const fileInputRef = useRef(null);

  const addParticipant = () => {
    if (currentParticipant.trim() && !participants.includes(currentParticipant.trim())) {
      setParticipants([...participants, currentParticipant.trim()]);
      setCurrentParticipant('');
    }
  };

  const removeParticipant = (name) => {
    setParticipants(participants.filter(p => p !== name));
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const fileParticipants = text.split('\n')
          .map(line => line.trim())
          .filter(line => line !== '');
        
        // Add unique participants from file
        const uniqueParticipants = [...new Set([...participants, ...fileParticipants])];
        setParticipants(uniqueParticipants);
      };
      reader.readAsText(file);
    }
  };

  const generateGroups = () => {
    // Basic validation
    if (participants.length < numTables * peoplePerTable) {
      alert('Não há participantes suficientes para a configuração especificada');
      return;
    }

    // Simplified group generation algorithm with tracking
    let roundResults = [];
    let participantRoutes = {};
    let remainingParticipants = [...participants];

    // Initialize routes for each participant
    participants.forEach(p => {
      participantRoutes[p] = [];
    });

    for (let round = 0; round < numRounds; round++) {
      // Shuffle participants
      remainingParticipants.sort(() => Math.random() - 0.5);

      let roundGroups = Array.from({ length: numTables }, () => []);

      // Distribute participants
      remainingParticipants.forEach((participant, index) => {
        const tableNumber = index % numTables;
        roundGroups[tableNumber].push(participant);
        
        // Track individual routes
        participantRoutes[participant].push(`Rodada ${round + 1}: Mesa ${tableNumber + 1}`);
      });

      roundResults.push(roundGroups);
    }

    setGeneratedGroups(roundResults);
    setIndividualRoutes(participantRoutes);
  };

  const downloadReport = () => {
    if (!generatedGroups || !individualRoutes) return;

    // Create report content
    let reportContent = "Relatório de Distribuição de Grupos\n";
    reportContent += "=====================================\n\n";
    reportContent += `Configurações:\n`;
    reportContent += `- Número de Mesas: ${numTables}\n`;
    reportContent += `- Pessoas por Mesa: ${peoplePerTable}\n`;
    reportContent += `- Número de Rodadas: ${numRounds}\n`;
    reportContent += `- Total de Participantes: ${participants.length}\n\n`;

    // Group distribution
    reportContent += "Distribuição de Grupos:\n";
    generatedGroups.forEach((round, roundIndex) => {
      reportContent += `\nRodada ${roundIndex + 1}:\n`;
      round.forEach((table, tableIndex) => {
        reportContent += `  Mesa ${tableIndex + 1}: ${table.join(', ')}\n`;
      });
    });

    // Individual routes
    reportContent += "\nRoteiro Individual:\n";
    Object.entries(individualRoutes).forEach(([participant, routes]) => {
      reportContent += `${participant}: ${routes.join(' | ')}\n`;
    });

    // Create and download file
    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'relatorio_grupos.txt';
    link.click();
  };

  return (
    <div className="container">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Gerador de Grupos</h2>
        </div>
        <div className="card-content">
          <div className="grid-container">
            {/* Configuration Inputs */}
            <div className="config-grid">
              <div className="form-group">
                <label>Número de Mesas</label>
                <input 
                  type="number" 
                  value={numTables} 
                  onChange={(e) => setNumTables(Number(e.target.value))}
                  min="1"
                  className="input"
                />
              </div>
              <div className="form-group">
                <label>Pessoas por Mesa</label>
                <input 
                  type="number" 
                  value={peoplePerTable} 
                  onChange={(e) => setPeoplePerTable(Number(e.target.value))}
                  min="1"
                  className="input"
                />
              </div>
              <div className="form-group">
                <label>Número de Rodadas</label>
                <input 
                  type="number" 
                  value={numRounds} 
                  onChange={(e) => setNumRounds(Number(e.target.value))}
                  min="1"
                  className="input"
                />
              </div>
            </div>

            {/* Participant Input */}
            <div className="participant-input">
              <input 
                className="input"
                placeholder="Digite o nome do participante" 
                value={currentParticipant}
                onChange={(e) => setCurrentParticipant(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addParticipant()}
              />
              <button className="button primary" onClick={addParticipant}>Adicionar</button>
              
              {/* File Upload Button */}
              <input 
                type="file" 
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileUpload}
                accept=".txt"
              />
              <button 
                className="button outline" 
                onClick={() => fileInputRef.current.click()}
              >
                Importar Arquivo
              </button>
            </div>

            {/* Participant List */}
            <div className="participant-list">
              <h3>Participantes ({participants.length})</h3>
              <div className="participants-container">
                {participants.map(name => (
                  <div key={name} className="participant-tag">
                    {name}
                    <button 
                      onClick={() => removeParticipant(name)}
                      className="remove-btn"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="card-footer">
          <button 
            className="button outline"
            onClick={() => setParticipants([])}
          >
            Limpar Participantes
          </button>
          <button 
            className="button primary"
            onClick={generateGroups}
            disabled={participants.length < numTables * peoplePerTable}
          >
            Gerar Grupos
          </button>
        </div>
      </div>

      {/* Generated Groups Display */}
      {generatedGroups && (
        <div className="card margin-top">
          <div className="card-header">
            <h2 className="card-title">Grupos Gerados</h2>
          </div>
          <div className="card-content">
            {generatedGroups.map((round, roundIndex) => (
              <div key={roundIndex} className="round-container">
                <h3>Rodada {roundIndex + 1}</h3>
                <div className="tables-grid">
                  {round.map((table, tableIndex) => (
                    <div key={tableIndex} className="table-card">
                      <h4>Mesa {tableIndex + 1}</h4>
                      <ul>
                        {table.map(participant => (
                          <li key={participant}>{participant}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="card-footer">
            <button className="button primary" onClick={downloadReport}>
              Baixar Relatório
            </button>
          </div>
        </div>
      )}

      {/* Individual Routes Display */}
      {individualRoutes && (
        <div className="card margin-top">
          <div className="card-header">
            <h2 className="card-title">Roteiro Individual</h2>
          </div>
          <div className="card-content">
            {Object.entries(individualRoutes).map(([participant, routes]) => (
              <div key={participant} className="route-item">
                <strong>{participant}:</strong> {routes.join(' | ')}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupGenerator;