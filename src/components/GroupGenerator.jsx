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
  const [numTables, setNumTables] = useState(3);
  const [peoplePerTable, setPeoplePerTable] = useState(4);
  const [numRounds, setNumRounds] = useState(3);
  const [participants, setParticipants] = useState([]);
  const [currentParticipant, setCurrentParticipant] = useState('');
  const [generatedGroups, setGeneratedGroups] = useState(null);
  const [individualRoutes, setIndividualRoutes] = useState(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false); // Adiciona estado de carregamento
  const [fileError, setFileError] = useState(''); // Adiciona estado de erro
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


  const generateGroups = () => {
    // Validação básica
    if (participants.length === 0) {
        alert('Adicione participantes antes de gerar grupos.');
        return;
    }
    // Mantém o aviso, mas permite gerar se houver participantes
    if (participants.length < numTables * peoplePerTable) {
      alert(`Aviso: O número de participantes (${participants.length}) é menor que o necessário para preencher todas as mesas (${numTables * peoplePerTable}). Algumas mesas podem ficar vazias ou com menos pessoas.`);
    }
     // Validação crítica: impossível distribuir se participantes < mesas
     if (participants.length < numTables) {
        alert(`Erro: O número de participantes (${participants.length}) é menor que o número de mesas (${numTables}). Impossível distribuir.`);
        return;
     }

    // Algoritmo simplificado de geração de grupos com rastreamento
    let roundResults = [];
    let participantRoutes = {};
    let currentParticipants = [...participants]; // Usa uma cópia para embaralhar a cada rodada

    // Inicializa as rotas para cada participante
    participants.forEach(p => {
      participantRoutes[p] = [];
    });

    for (let round = 0; round < numRounds; round++) {
      // Embaralha os participantes para esta rodada
      let shuffledParticipants = [...currentParticipants].sort(() => Math.random() - 0.5);

      let roundGroups = Array.from({ length: numTables }, () => []);

      // Distribui os participantes ciclicamente pelas mesas
      shuffledParticipants.forEach((participant, index) => {
        const tableIndex = index % numTables; // Atribui às mesas 0, 1, 2, ..., numTables-1

        // Adiciona participante à mesa se ela não estiver cheia (respeita peoplePerTable)
        // Se participants.length < numTables * peoplePerTable, algumas mesas terão menos pessoas.
        if (roundGroups[tableIndex].length < peoplePerTable) {
            roundGroups[tableIndex].push(participant);
            // Rastreia rotas individuais
            participantRoutes[participant].push(`Rodada ${round + 1}: Mesa ${tableIndex + 1}`);
        } else {
            // Este caso pode acontecer se participants.length > numTables * peoplePerTable
            // Por simplicidade, atualmente ignoramos participantes extras por rodada.
            // Um algoritmo mais complexo seria necessário para garantir que todos participem se possível,
            // ou para lidar com participantes excedentes.
            // Por enquanto, registre que eles não conseguiram uma mesa nesta rodada (ou trate de forma diferente)
             participantRoutes[participant].push(`Rodada ${round + 1}: (Não alocado)`); // Ou omita esta entrada
        }
      });

      // O código acima já distribui ciclicamente, o que é razoável para poucos participantes.
      // Lugares vazios ocorrerão naturalmente se não houver pessoas suficientes.

      roundResults.push(roundGroups);
    }

    setGeneratedGroups(roundResults);
    setIndividualRoutes(participantRoutes);
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
                  value={numTables}
                  // Garante que o valor não seja menor que 1
                  onChange={(e) => setNumTables(Math.max(1, Number(e.target.value)))}
                  min="1"
                  className="input"
                />
              </div>
              <div className="form-group">
                <label>Pessoas por Mesa</label>
                <input
                  type="number"
                  value={peoplePerTable}
                  // Garante que o valor não seja menor que 1
                  onChange={(e) => setPeoplePerTable(Math.max(1, Number(e.target.value)))}
                  min="1"
                  className="input"
                />
              </div>
              <div className="form-group">
                <label>Número de Rodadas</label>
                <input
                  type="number"
                  value={numRounds}
                  // Garante que o valor não seja menor que 1
                  onChange={(e) => setNumRounds(Math.max(1, Number(e.target.value)))}
                  min="1"
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
     </div>
   );
 };

export default GroupGenerator;