// Importa as funções necessárias do Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    runTransaction, 
    addDoc, 
    serverTimestamp,
    query,
    orderBy,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// Configuração do Firebase corrigida (sem a linha 'databaseURL' que é para outro serviço)
const firebaseConfig = {
  apiKey: "AIzaSyAuiav_5OuwycP6v7Gb-XcKsKMVYLLjNNQ",
  authDomain: "oficio-76192.firebaseapp.com",
  projectId: "oficio-76192",
  storageBucket: "oficio-76192.appspot.com",
  messagingSenderId: "585889113993",
  appId: "1:585889113993:web:0d559822c6857a1a26a358",
  measurementId: "G-PWE5JWY4N6"
};

// Inicializa o Firebase e o Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    // Seleciona todos os elementos importantes da página
    const sections = document.querySelectorAll('.section');
    const forms = document.querySelectorAll('form');
    const modal = document.getElementById('confirmation-modal');
    const closeModalButton = document.querySelector('.close-button');
    const printButton = document.getElementById('print-button');
    const searchInput = document.getElementById('history-search');

    let currentPrintData = null;
    let localHistory = []; // Cache local dos documentos para busca rápida

    // Função para preencher a data e hora atual nos formulários
    const setDate = (sectionId) => {
        const dateInput = document.getElementById(`data-${sectionId}`);
        dateInput.value = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    };

    // Lógica para expandir as seções ao clicar
    sections.forEach(section => {
        section.addEventListener('click', () => {
            if (section.classList.contains('expanded')) return;
            sections.forEach(s => s.classList.remove('expanded'));
            section.classList.add('expanded');
            setDate(section.id);
        });
    });

    // Lógica de submissão para todos os formulários
    forms.forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitButton = form.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Enviando...';

            const type = form.id.replace('form-', '');
            const counterRef = doc(db, 'counters', 'doc_counters');

            try {
                // Roda uma transação no Firestore para garantir que o contador seja único e atômico
                const newCode = await runTransaction(db, async (transaction) => {
                    const counterDoc = await transaction.get(counterRef);
                    
                    let nextCounter;
                    if (!counterDoc.exists()) {
                        nextCounter = 1;
                    } else {
                        const currentCounter = counterDoc.data()[type] || 0;
                        nextCounter = currentCounter + 1;
                    }
                    
                    const year = new Date().getFullYear();
                    const paddedCounter = String(nextCounter).padStart(4, '0');
                    const generatedCode = `${paddedCounter}/${year}`;

                    transaction.set(counterRef, { [type]: nextCounter }, { merge: true });
                    
                    return generatedCode;
                });

                // Prepara os dados do documento para salvar
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());
                data.codigo = newCode;
                data.type = getDocumentType(type);
                data.timestamp = serverTimestamp();

                await addDoc(collection(db, "documents"), data);
                
                showModal(data);
                form.reset();
                setDate(type);

            } catch (error) {
                console.error("Erro ao enviar o documento: ", error);
                alert("Ocorreu um erro ao enviar. Verifique o console para mais detalhes.");
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = `Enviar ${getDocumentType(type)}`;
            }
        });
    });
    
    // Converte o ID do tipo para um nome legível
    const getDocumentType = (typeId) => {
        const types = {
            'oficio': 'Ofício',
            'circular': 'Ofício Circular',
            'ci': 'Comunicação Interna'
        };
        return types[typeId] || 'Documento';
    };

    // Renderiza a tabela de histórico
    const renderHistory = (filter = '') => {
        const tableBody = document.querySelector('#history-table tbody');
        tableBody.innerHTML = '';
        const lowercasedFilter = filter.toLowerCase().trim();

        const filteredHistory = localHistory.filter(item => 
            Object.values(item).some(value => 
                String(value).toLowerCase().includes(lowercasedFilter)
            )
        );

        if (filteredHistory.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6">Nenhum documento encontrado.</td></tr>';
            return;
        }

        filteredHistory.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.type}</td>
                <td>${item.codigo}</td>
                <td>${item.data}</td>
                <td>${item.de}</td>
                <td>${item.para}</td>
                <td>${item.assunto}</td>
            `;
            tableBody.appendChild(row);
        });
    };

    // Escuta por atualizações em tempo real no Firestore
    const q = query(collection(db, "documents"), orderBy("timestamp", "desc"));
    onSnapshot(q, (querySnapshot) => {
        localHistory = [];
        querySnapshot.forEach((doc) => {
            localHistory.push(doc.data());
        });
        renderHistory(searchInput.value);
    }, (error) => {
        console.error("ERRO DO FIREBASE: ", error);
        console.warn("PROVÁVEL SOLUÇÃO: A API do Firestore pode não estar ativada ou o índice pode estar faltando. Siga as instruções anteriores para corrigir.");
        const tableBody = document.querySelector('#history-table tbody');
        tableBody.innerHTML = '<tr><td colspan="6">Erro de conexão com o banco de dados. Verifique o console (F12).</td></tr>';
    });


    // Evento para filtrar o histórico
    searchInput.addEventListener('keyup', () => {
        renderHistory(searchInput.value);
    });

    // Funções do Modal
    const showModal = (data) => {
        document.getElementById('modal-generated-code').textContent = data.codigo;
        currentPrintData = data;
        modal.style.display = 'flex';
    };

    const closeModal = () => {
        modal.style.display = 'none';
        currentPrintData = null;
    };

    closeModalButton.addEventListener('click', closeModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Função de Impressão (sem logo)
    printButton.addEventListener('click', () => {
        if (!currentPrintData) return;
        const { type, codigo, data, de, para, assunto, ementa } = currentPrintData;
        
        const printContent = `
            <div style="font-family: 'Times New Roman', serif; padding: 40px; color: black;">
                <h1 style="text-align: center; margin-bottom: 40px;">${type.toUpperCase()} Nº ${codigo}</h1>
                <p style="text-align: right; margin-bottom: 30px;">Data: ${data}</p>
                <p><strong>De:</strong> ${de}</p>
                <p><strong>Para:</strong> ${para}</p>
                <p style="margin-top: 20px;"><strong>Assunto:</strong> ${assunto}</p>
                <hr style="margin: 20px 0;">
                <h3 style="margin-bottom: 15px;">Ementa:</h3>
                <p style="text-align: justify; white-space: pre-wrap;">${ementa || 'Não preenchido.'}</p>
                <br><br><br><br>
                <p style="text-align: center;">______________________________________</p>
                <p style="text-align: center;">Assinatura do Responsável</p>
                <p style="text-align: center;">${de}</p>
            </div>
        `;
        
        const printArea = document.getElementById('print-area');
        printArea.innerHTML = printContent;
        window.print();
        printArea.innerHTML = '';
    });
});

