import React, { useState, useRef } from 'react';
import './GroupGenerator.css'; // Arquivo CSS separado para estilização

// Importa as bibliotecas
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import mammoth from 'mammoth';

// --- Configuração do Worker PDF ---
// Escolha UMA opção (A ou B) do passo 2 e coloque aqui.
// Exemplo usando a Opção A (CDN):
// Encontre o número da versão correto no seu package-lock.json ou node_modules/pdfjs-dist/package.json
const PDF_JS_VERSION = '4.0.0'; // <-- !! ATUALIZE PARA A SUA VERSÃO INSTALADA !!
if (typeof window !== 'undefined' && 'Worker' in window) { // Garante que isso rode apenas no navegador
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDF_JS_VERSION}/pdf.worker.min.js`;
}
// -------------------------------

const GroupGenerator = () => {
  const [numTables, setNumTables] = useState(0);
  const [peoplePerTable, setPeoplePerTable] = useState(0);
  const [numRounds, setNumRounds] = useState(0);
  const [participants, setParticipants] = useState([]);
  const [currentParticipant, setCurrentParticipant] = useState('');
  const [generatedGroups, setGeneratedGroups] = useState(null);
  const [individualRoutes, setIndividualRoutes] = useState(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef(null);
  // Novo estado para armazenar informações de encontros recorrentes
  const [recurringEncounters, setRecurringEncounters] = useState(null);

  const addParticipant = () => {
    if (currentParticipant.trim() && !participants.includes(currentParticipant.trim())) {
      setParticipants([...participants, currentParticipant.trim()]);
      setCurrentParticipant('');
    }
  };

  const removeParticipant = (name) => {
    setParticipants(participants.filter(p => p !== name));
  };

  // --- Função handleFileUpload Atualizada ---
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsLoadingFile(true);
    setFileError('');
    let fileParticipants = [];

    try {
      const fileExtension = file.name.split('.').pop().toLowerCase();
      const reader = new FileReader();

      // --- Wrapper de Promise para FileReader ---
      const readFile = (readAs) => {
        return new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = (error) => reject(error);

          switch (readAs) {
            case 'text':
              // Define explicitamente UTF-8, boa prática para arquivos de texto
              reader.readAsText(file, 'UTF-8');
              break;
            case 'arrayBuffer':
              reader.readAsArrayBuffer(file);
              break;
            default:
              reject(new Error("Tipo de leitura inválido (readAs)"));
          }
        });
      };
      // --- Fim do wrapper de Promise ---

      if (fileExtension === 'txt') {
        const text = await readFile('text');
        // Divide por nova linha, tratando ambos Windows (\r\n) e Unix (\n)
        fileParticipants = text.split(/\r?\n/)
          .map(line => line.trim())
          .filter(line => line !== '');

      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        const arrayBuffer = await readFile('arrayBuffer');
        const workbook = XLSX.read(arrayBuffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        // Assumindo que os nomes estão na primeira coluna (A)
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        fileParticipants = data
          .map(row => row[0]) // Pega o valor da primeira célula
          .filter(value => value != null && String(value).trim() !== '') // Filtra vazios/nulos
          .map(value => String(value).trim()); // Garante que é string e remove espaços

      } else if (fileExtension === 'pdf') {
        const arrayBuffer = await readFile('arrayBuffer');
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          // Concatena o texto dos itens, adiciona espaço entre eles e nova linha entre páginas
          fullText += textContent.items.map(item => item.str).join(' ') + '\n';
        }
        // Divide o texto completo por novas linhas
        fileParticipants = fullText.split(/\r?\n/)
          .map(line => line.trim())
          .filter(line => line !== '');

      } else if (fileExtension === 'docx') {
        const arrayBuffer = await readFile('arrayBuffer');
        const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
        // Divide o texto extraído por novas linhas
        fileParticipants = result.value.split(/\r?\n/)
           .map(line => line.trim())
           .filter(line => line !== '');

      } else {
        throw new Error('Tipo de arquivo não suportado. Use .txt, .xlsx, .pdf ou .docx');
      }

      // Adiciona participantes únicos do arquivo
      if (fileParticipants.length > 0) {
          const uniqueParticipants = [...new Set([...participants, ...fileParticipants])];
          setParticipants(uniqueParticipants);
      } else {
           // Define um erro se nenhum participante foi encontrado
           setFileError('Nenhum participante encontrado no arquivo.');
      }

    } catch (error) {
      // Loga o erro no console e define a mensagem de erro para o usuário
      console.error("Erro ao processar arquivo:", error);
      setFileError(`Erro ao ler o arquivo: ${error.message}`);
    } finally {
      // Garante que o estado de carregamento seja desativado
      setIsLoadingFile(false);
      // Reseta o input de arquivo para permitir selecionar o mesmo arquivo novamente
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  // --- Fim da função handleFileUpload Atualizada ---

  // Nova função para analisar encontros recorrentes
  const analyzeEncounters = (roundGroups) => {
    // Matriz para rastrear encontros
    // O formato será: { participantA: { participantB: count, ... }, ... }
    const encounters = {};
    
    // Inicializa a matriz de encontros para todos os participantes
    participants.forEach(p => {
      encounters[p] = {};
    });
    
    // Para cada rodada e cada mesa, registra encontros entre todos os participantes
    roundGroups.forEach((round) => {
      round.forEach((table) => {
        // Para cada par de pessoas na mesma mesa
        for (let i = 0; i < table.length; i++) {
          for (let j = i + 1; j < table.length; j++) {
            const person1 = table[i];
            const person2 = table[j];
            
            // Incrementa o contador para este par
            if (!encounters[person1][person2]) {
              encounters[person1][person2] = 1;
            } else {
              encounters[person1][person2]++;
            }
            
            // Também registra na direção oposta para facilitar a consulta
            if (!encounters[person2][person1]) {
              encounters[person2][person1] = 1;
            } else {
              encounters[person2][person1]++;
            }
          }
        }
      });
    });
    
    // Encontra encontros recorrentes (mais de uma vez)
    const recurring = {};
    let totalRecurringEncounters = 0;
    
    participants.forEach(person1 => {
      const personRecurring = [];
      Object.keys(encounters[person1]).forEach(person2 => {
        // Contamos apenas em uma direção para evitar duplicação
        if (person1 < person2 && encounters[person1][person2] > 1) {
          personRecurring.push({
            person: person2,
            count: encounters[person1][person2]
          });
          totalRecurringEncounters++;
        }
      });
      
      if (personRecurring.length > 0) {
        recurring[person1] = personRecurring;
      }
    });
    
    return {
      detailedRecurring: recurring,
      totalRecurringEncounters: totalRecurringEncounters
    };
  };

  const generateGroups = () => {
    // Validações mantidas (apenas aviso para participantes insuficientes)
    if (participants.length === 0) {
      alert('Adicione participantes antes de gerar grupos.');
      return;
    }
    if (participants.length < numTables * peoplePerTable) {
      alert(`Aviso: O número de participantes (${participants.length}) é menor que o necessário para preencher todas as mesas (${numTables * peoplePerTable}).`);
    }
    if (participants.length > numTables * peoplePerTable) {
      alert(`Aviso: O número de participantes (${participants.length}) é maior que o planejado para as mesas (${numTables * peoplePerTable}). Os participantes excedentes serão distribuídos uniformemente.`);
    }
  
    let roundResults = [];
    let participantRoutes = {};
    const encounterHistory = new Map();
  
    // Inicialização
    participants.forEach(p => {
      participantRoutes[p] = [];
      encounterHistory.set(p, new Set());
    });
  
    for (let round = 0; round < numRounds; round++) {
      let groups = Array.from({ length: numTables }, () => []);
      let participantsCopy = [...participants];
      
      // Rotação inteligente para novas combinações
      if (round > 0) {
        participantsCopy = [participantsCopy[0], ...participantsCopy.slice(1).sort(() => Math.random() - 0.5)];
      }
  
      // Algoritmo de distribuição uniforme aprimorado
      while (participantsCopy.length > 0) {
        // Encontra a próxima mesa com menor número de participantes
        let bestTable = 0;
        let minParticipants = groups[0].length;
        
        for (let i = 1; i < numTables; i++) {
          if (groups[i].length < minParticipants) {
            minParticipants = groups[i].length;
            bestTable = i;
          }
        }
  
        // Seleciona o próximo participante com menor histórico de conflitos para esta mesa
        let bestParticipantIndex = 0;
        let minConflicts = Infinity;
        
        participantsCopy.forEach((p, idx) => {
          const conflicts = groups[bestTable].reduce((acc, member) => 
            acc + (encounterHistory.get(p).has(member) ? 1 : 0), 0);
          if (conflicts < minConflicts) {
            minConflicts = conflicts;
            bestParticipantIndex = idx;
          }
        });
  
        // Aloca o participante selecionado
        const [participant] = participantsCopy.splice(bestParticipantIndex, 1);
        groups[bestTable].push(participant);
        participantRoutes[participant].push(`Rodada ${round + 1}: Mesa ${bestTable + 1}`);
        
        // Atualiza histórico de encontros
        groups[bestTable].forEach(member => {
          if (member !== participant) {
            encounterHistory.get(participant).add(member);
            encounterHistory.get(member).add(participant);
          }
        });
      }
  
      roundResults.push(groups);
    }
  
    // Analisa encontros recorrentes após gerar todos os grupos
    const encounterAnalysis = analyzeEncounters(roundResults);
  
    setGeneratedGroups(roundResults);
    setIndividualRoutes(participantRoutes);
    setRecurringEncounters(encounterAnalysis);
  };

  const downloadReport = () => {
    if (!generatedGroups || !individualRoutes) return;

    // Cria o conteúdo do relatório
    let reportContent = "Relatório de Distribuição de Grupos\n";
    reportContent += "=====================================\n\n";
    reportContent += `Configurações:\n`;
    reportContent += `- Número de Mesas: ${numTables}\n`;
    // Reporta o número *ideal* de pessoas por mesa, o real pode variar
    reportContent += `- Pessoas por Mesa (Ideal): ${peoplePerTable}\n`;
    reportContent += `- Número de Rodadas: ${numRounds}\n`;
    reportContent += `- Total de Participantes: ${participants.length}\n\n`;

    // Distribuição de Grupos por Rodada
    reportContent += "Distribuição de Grupos por Rodada:\n";
    generatedGroups.forEach((round, roundIndex) => {
      reportContent += `\nRodada ${roundIndex + 1}:\n`;
      round.forEach((table, tableIndex) => {
        // Trata mesas vazias na exibição do relatório
        reportContent += `  Mesa ${tableIndex + 1}: ${table.length > 0 ? table.join(', ') : '(Vazia)'}\n`;
      });
    });

    // Roteiro Individual
    reportContent += "\nRoteiro Individual:\n";
    // Ordena alfabeticamente para facilitar a leitura do relatório
    Object.entries(individualRoutes)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([participant, routes]) => {
            reportContent += `${participant}: ${routes.join(' | ')}\n`;
        });

    // Adiciona informação de encontros recorrentes ao relatório
    if (recurringEncounters) {
      reportContent += "\nEncontros Recorrentes:\n";
      reportContent += "=====================\n\n";
      
      // Verifica se existem encontros recorrentes
      if (recurringEncounters.totalRecurringEncounters === 0) {
        reportContent += "Não foram detectados encontros recorrentes nesta distribuição.\n";
      } else {
        reportContent += `Total de encontros recorrentes: ${recurringEncounters.totalRecurringEncounters}\n\n`;
        
        // Lista encontros recorrentes por pessoa
        Object.entries(recurringEncounters.detailedRecurring)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .forEach(([person, encounters]) => {
            const totalRecurringForPerson = encounters.reduce((sum, encounter) => sum + encounter.count - 1, 0);
            reportContent += `${person} teve ${totalRecurringForPerson} encontro(s) recorrente(s):\n`;
            
            encounters
              .sort((a, b) => b.count - a.count) // Ordena por número de encontros (decrescente)
              .forEach(({ person: otherPerson, count }) => {
                reportContent += `  - ${person} - ${otherPerson} (${count} vezes)\n`;
              });
              
            reportContent += "\n";
          });
      }
    }

    // Cria e baixa o arquivo
    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'relatorio_grupos.txt';
    document.body.appendChild(link); // Necessário para Firefox
    link.click();
    document.body.removeChild(link); // Limpa
    URL.revokeObjectURL(link.href); // Libera memória
  };

  return (
    <div className="container">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Gerador de Grupos</h2>
        </div>
        <div className="card-content">
          <div className="grid-container">
            {/* Inputs de Configuração */}
            <div className="config-grid">
              <div className="form-group">
                <label>Número de Mesas</label>
                <input
                  type="number"
                  value={numTables === 0 ? '' : numTables}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      setNumTables(0);
                    } else {
                      setNumTables(Math.max(0, Number(value)));
                    }
                  }}
                  min="0"
                  className="input"
                />
              </div>
              <div className="form-group">
                <label>Pessoas por Mesa</label>
                <input
                  type="number"
                  value={peoplePerTable === 0 ? '' : peoplePerTable}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      setPeoplePerTable(0);
                    } else {
                      setPeoplePerTable(Math.max(0, Number(value)));
                    }
                  }}
                  min="0"
                  className="input"
                />
              </div>
              <div className="form-group">
                <label>Número de Rodadas</label>
                <input
                  type="number"
                  value={numRounds === 0 ? '' : numRounds}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      setNumRounds(0);
                    } else {
                      setNumRounds(Math.max(0, Number(value)));
                    }
                  }}
                  min="0"
                  className="input"
                />
              </div>
            </div>

            {/* Input de Participante */}
            <div className="participant-input">
              <input
                className="input"
                placeholder="Digite o nome do participante"
                value={currentParticipant}
                onChange={(e) => setCurrentParticipant(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addParticipant()}
              />
              <button className="button primary" onClick={addParticipant}>Adicionar</button>

              {/* Botão de Upload de Arquivo */}
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileUpload}
                // Atualiza os tipos de arquivo aceitos
                accept=".txt,.xlsx,.xls,.pdf,.docx"
              />
              <button
                className="button outline"
                onClick={() => fileInputRef.current.click()}
                // Desabilita enquanto carrega
                disabled={isLoadingFile}
              >
                {isLoadingFile ? 'Carregando...' : 'Importar Arquivo'}
              </button>
               {/* Exibe Erro do Arquivo */}
               {fileError && <p className="error-message">{fileError}</p>}
            </div>

                  
            {/* Lista de Participantes */}
            <div className="participant-list">
              <h3>Participantes ({participants.length})</h3>
              <div className="participants-container">
                {participants.map(name => (
                  <div key={name} className="participant-tag">
                    {name}
                    <button
                      onClick={() => removeParticipant(name)}
                      className="remove-btn"
                      // Melhora acessibilidade
                      aria-label={`Remover ${name}`}
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
            onClick={() => {
              setParticipants([]);
              // Limpa também os resultados ao limpar participantes
              setGeneratedGroups(null);
              setIndividualRoutes(null);
              setRecurringEncounters(null); // Também limpa encontros recorrentes
              setFileError(''); // Limpa erro de arquivo também
            }}
          >
            Limpar Tudo
          </button>
          <button
            className="button primary"
            onClick={generateGroups}
            // Desabilita se não houver participantes
            disabled={participants.length === 0}
          >
            Gerar Grupos
          </button>
        </div>
      </div>

      {/* Exibição dos Grupos Gerados */}
      {generatedGroups && (
         <div className="card margin-top">
           <div className="card-header">
             <h2 className="card-title">Grupos Gerados</h2>
           </div>
           {/* Adiciona classe para rolagem se necessário */}
           <div className="card-content results-section">
             {generatedGroups.map((round, roundIndex) => (
               <div key={roundIndex} className="round-container">
                 <h3>Rodada {roundIndex + 1}</h3>
                 <div className="tables-grid">
                   {round.map((table, tableIndex) => (
                     <div key={tableIndex} className="table-card">
                       <h4>Mesa {tableIndex + 1}</h4>
                       {table.length > 0 ? (
                         <ul>
                           {table.map(participant => (
                             <li key={participant}>{participant}</li>
                           ))}
                         </ul>
                       ) : (
                         // Estiliza mesas vazias
                         <p className="empty-table">(Vazia)</p>
                       )}
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

       {/* Exibição dos Roteiros Individuais */}
       {individualRoutes && (
         <div className="card margin-top">
           <div className="card-header">
             <h2 className="card-title">Roteiro Individual</h2>
           </div>
            {/* Adiciona classe para rolagem se necessário */}
           <div className="card-content results-section">
             {Object.entries(individualRoutes)
                // Ordena alfabeticamente pelo nome do participante
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([participant, routes]) => (
                  <div key={participant} className="route-item">
                    <strong>{participant}:</strong> {routes.join(' | ')}
                  </div>
             ))}
           </div>
         </div>
       )}

       {/* NOVA SEÇÃO: Exibição dos Encontros Recorrentes */}
       {recurringEncounters && (
         <div className="card margin-top">
           <div className="card-header">
             <h2 className="card-title">Verificação de Encontros Recorrentes</h2>
           </div>
           <div className="card-content results-section">
             {/* Cabeçalho com total de encontros recorrentes */}
             <div className="summary-container">
               <h3>
                 {recurringEncounters.totalRecurringEncounters === 0 
                   ? "Nenhum encontro recorrente detectado" 
                   : `Total de encontros recorrentes: ${recurringEncounters.totalRecurringEncounters}`}
               </h3>
             </div>
             
             {/* Detalhes de encontros recorrentes por pessoa */}
             {Object.keys(recurringEncounters.detailedRecurring).length > 0 ? (
               <div className="recurring-encounters">
                 {Object.entries(recurringEncounters.detailedRecurring)
                   .sort((a, b) => a[0].localeCompare(b[0])) // Ordena alfabeticamente
                   .map(([person, encounters]) => {
                     // Calcula o total de encontros recorrentes para esta pessoa
                     const totalRecurringForPerson = encounters.reduce(
                       (sum, encounter) => sum + encounter.count - 1, 0
                     );
                     
                     return (
                       <div key={person} className="encounter-item">
                         <h4>{person} teve {totalRecurringForPerson} encontro(s) recorrente(s):</h4>
                         <ul>
                           {encounters
                             .sort((a, b) => b.count - a.count) // Ordena por frequência
                             .map(({ person: otherPerson, count }, index) => (
                               <li key={index}>
                                 {person} - {otherPerson} ({count} vezes)
                               </li>
                             ))}
                         </ul>
                       </div>
                     );
                   })}
               </div>
             ) : (
               <p className="no-recurring">A distribuição atual não gerou encontros recorrentes.</p>
             )}
           </div>
         </div>
       )}
     </div>
   );
 };

export default GroupGenerator;
