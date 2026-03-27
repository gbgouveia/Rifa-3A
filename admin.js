import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
  firebaseConfig,
  TOTAL_NUMBERS,
  COLLECTION_NAME,
  EXCEL_FILE_NAME
} from "./firebase-config.js";

const loginScreen = document.getElementById("loginScreen");
const adminApp = document.getElementById("adminApp");

const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginMessage = document.getElementById("loginMessage");

const adminUserEmail = document.getElementById("adminUserEmail");
const logoutBtn = document.getElementById("logoutBtn");

const adminTotal = document.getElementById("adminTotal");
const adminReserved = document.getElementById("adminReserved");
const adminAvailable = document.getElementById("adminAvailable");

const adminNumbersGrid = document.getElementById("adminNumbersGrid");
const adminFilterButtons = document.querySelectorAll(".admin-filter");
const printFullGridBtn = document.getElementById("printFullGridBtn");

const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const exportBtn = document.getElementById("exportBtn");
const printReservedBtn = document.getElementById("printReservedBtn");
const searchInfo = document.getElementById("searchInfo");
const participantsList = document.getElementById("participantsList");
const adminMessage = document.getElementById("adminMessage");

const orderFilter = document.getElementById("orderFilter");
const dateFrom = document.getElementById("dateFrom");
const dateTo = document.getElementById("dateTo");
const timeFrom = document.getElementById("timeFrom");
const timeTo = document.getElementById("timeTo");
const applyDateFilterBtn = document.getElementById("applyDateFilterBtn");
const clearDateFilterBtn = document.getElementById("clearDateFilterBtn");
const showRankingBtn = document.getElementById("showRankingBtn");
const rankingList = document.getElementById("rankingList");

let db = null;
let auth = null;
let participantsRef = null;
let participants = [];
let currentFilter = "todos";
let currentSearch = "";
let currentDateFrom = "";
let currentDateTo = "";
let currentTimeFrom = "";
let currentTimeTo = "";

function showMessage(text, type = "success", target = adminMessage) {
  target.textContent = text;
  target.className = `message ${type}`;

  setTimeout(() => {
    target.textContent = "";
    target.className = "message";
  }, 3500);
}

function isFirebaseConfigured() {
  return !!(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isReserved(number) {
  return participants.some((item) => Number(item.numero) === Number(number));
}

function updateCounters() {
  const reserved = participants.length;
  const available = TOTAL_NUMBERS - reserved;

  adminTotal.textContent = TOTAL_NUMBERS;
  adminReserved.textContent = reserved;
  adminAvailable.textContent = available;
}

function getCreatedAtDate(item) {
  if (!item.criadoEm) return null;

  if (typeof item.criadoEm.toDate === "function") {
    return item.criadoEm.toDate();
  }

  if (item.criadoEm.seconds) {
    return new Date(item.criadoEm.seconds * 1000);
  }

  return null;
}

function formatDateTime(item) {
  const date = getCreatedAtDate(item);
  if (!date) return "Não informado";

  return date.toLocaleString("pt-BR");
}

function setFilter(filter) {
  currentFilter = filter;

  adminFilterButtons.forEach((btn) => {
    const active = btn.dataset.filter === filter;
    btn.classList.toggle("active", active);
    btn.classList.toggle("btn-dark", active);
    btn.classList.toggle("btn-light", !active);
  });

  renderNumbers();
}

function renderNumbers() {
  adminNumbersGrid.innerHTML = "";

  for (let i = 1; i <= TOTAL_NUMBERS; i++) {
    const item = document.createElement("div");
    item.className = "number-item";
    item.textContent = i;

    const reserved = isReserved(i);
    if (reserved) {
      item.classList.add("reserved");
    }

    if (currentFilter === "disponiveis" && reserved) {
      item.classList.add("hidden");
    }

    if (currentFilter === "reservados" && !reserved) {
      item.classList.add("hidden");
    }

    adminNumbersGrid.appendChild(item);
  }
}

function buildStartDateTime() {
  if (!currentDateFrom) return null;
  return new Date(`${currentDateFrom}T${currentTimeFrom || "00:00"}`);
}

function buildEndDateTime() {
  if (!currentDateTo) return null;
  return new Date(`${currentDateTo}T${currentTimeTo || "23:59"}`);
}

function participantPassesDateFilter(item) {
  const createdAt = getCreatedAtDate(item);
  if (!createdAt) return true;

  const start = buildStartDateTime();
  const end = buildEndDateTime();

  if (start && createdAt < start) return false;
  if (end && createdAt > end) return false;

  return true;
}

function applyOrdering(data) {
  const ordered = [...data];
  const mode = orderFilter.value;

  if (mode === "numero_asc") {
    ordered.sort((a, b) => Number(a.numero) - Number(b.numero));
  }

  if (mode === "numero_desc") {
    ordered.sort((a, b) => Number(b.numero) - Number(a.numero));
  }

  if (mode === "data_asc") {
    ordered.sort((a, b) => {
      const da = getCreatedAtDate(a)?.getTime() || 0;
      const db = getCreatedAtDate(b)?.getTime() || 0;
      return da - db;
    });
  }

  if (mode === "data_desc") {
    ordered.sort((a, b) => {
      const da = getCreatedAtDate(a)?.getTime() || 0;
      const db = getCreatedAtDate(b)?.getTime() || 0;
      return db - da;
    });
  }

  return ordered;
}

function filteredParticipants() {
  let data = [...participants];

  const term = normalizeText(currentSearch);
  if (term) {
    data = data.filter((item) => {
      const nome = normalizeText(item.nome);
      const telefone = normalizeText(item.telefone);
      const numero = normalizeText(String(item.numero));
      const indicacao = normalizeText(item.indicacao);

      return (
        nome.includes(term) ||
        telefone.includes(term) ||
        numero.includes(term) ||
        indicacao.includes(term)
      );
    });
  }

  data = data.filter(participantPassesDateFilter);
  data = applyOrdering(data);

  searchInfo.textContent = term
    ? `Busca: "${currentSearch}" • ${data.length} resultado(s).`
    : `Mostrando ${data.length} participante(s).`;

  return data;
}

function renderParticipants() {
  const data = filteredParticipants();
  participantsList.innerHTML = "";

  if (!data.length) {
    participantsList.innerHTML = `
      <div class="empty-box">Nenhum participante encontrado.</div>
    `;
    return;
  }

  data.forEach((item) => {
    const card = document.createElement("div");
    card.className = "participant-card";

    card.innerHTML = `
      <div class="participant-content">
        <p><strong>Nome:</strong> ${item.nome}</p>
        <p><strong>Telefone:</strong> ${item.telefone}</p>
        <p><strong>Número:</strong> <span class="number-pill">${item.numero}</span></p>
        <p><strong>Quem indicou / Vendedor:</strong> ${item.indicacao || "Não informado"}</p>
        <p><strong>Data e hora:</strong> ${formatDateTime(item)}</p>
      </div>

      <div class="participant-actions">
        <button
          type="button"
          class="btn btn-light delete-btn"
          data-id="${item.id}"
          data-name="${item.nome}"
          data-number="${item.numero}"
        >
          Excluir
        </button>
      </div>
    `;

    participantsList.appendChild(card);
  });

  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const name = btn.dataset.name;
      const number = btn.dataset.number;

      const confirmed = confirm(`Deseja excluir ${name}, número ${number}?`);
      if (!confirmed) return;

      try {
        await deleteDoc(doc(db, COLLECTION_NAME, id));
        showMessage("Participante excluído com sucesso.", "success");
      } catch (error) {
        console.error(error);
        showMessage("Erro ao excluir participante.", "error");
      }
    });
  });
}

function renderRanking() {
  const data = filteredParticipants();
  const rankingMap = {};

  data.forEach((item) => {
    const seller = (item.indicacao || "Sem indicação").trim() || "Sem indicação";
    rankingMap[seller] = (rankingMap[seller] || 0) + 1;
  });

  const ranking = Object.entries(rankingMap)
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total);

  rankingList.innerHTML = "";

  if (!ranking.length) {
    rankingList.innerHTML = `<div class="empty-box">Nenhum dado para ranking.</div>`;
    return;
  }

  ranking.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "participant-card";

    card.innerHTML = `
      <div class="participant-content">
        <p><strong>#${index + 1}</strong></p>
        <p><strong>Vendedor / Indicação:</strong> ${item.nome}</p>
        <p><strong>Total vendido:</strong> <span class="number-pill">${item.total}</span></p>
      </div>
    `;

    rankingList.appendChild(card);
  });
}

function exportExcel() {
  if (!participants.length) {
    showMessage("Não há participantes para exportar.", "error");
    return;
  }

  const data = filteredParticipants().map((item) => ({
    Nome: item.nome,
    Telefone: item.telefone,
    Numero: item.numero,
    Indicacao: item.indicacao || "",
    DataHora: formatDateTime(item),
    ID: item.id
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Rifa");
  XLSX.writeFileXLSX(workbook, EXCEL_FILE_NAME);
}

function printReservedTable() {
  const reserved = [...participants].sort((a, b) => Number(a.numero) - Number(b.numero));

  if (!reserved.length) {
    showMessage("Não há números reservados para imprimir.", "error");
    return;
  }

  const rows = reserved.map((item) => `
    <tr>
      <td>${item.numero}</td>
      <td>${item.nome}</td>
      <td>${item.telefone}</td>
      <td>${item.indicacao || "Não informado"}</td>
      <td>${formatDateTime(item)}</td>
    </tr>
  `).join("");

  const printWindow = window.open("", "_blank");

  printWindow.document.write(`
    <html>
      <head>
        <title>Tabela de Números Reservados</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ccc; padding: 10px; text-align: left; }
          th { background: #f3f4f6; }
        </style>
      </head>
      <body>
        <h1>Tabela de Números Reservados</h1>
        <p>Total de reservados: ${reserved.length}</p>
        <table>
          <thead>
            <tr>
              <th>Número</th>
              <th>Nome</th>
              <th>Telefone</th>
              <th>Indicação</th>
              <th>Data e Hora</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function printFullGrid() {
  const cells = [];

  for (let i = 1; i <= TOTAL_NUMBERS; i++) {
    const reserved = isReserved(i);

    cells.push(`
      <div class="cell ${reserved ? "reserved" : "available"}">
        ${i}
      </div>
    `);
  }

  const printWindow = window.open("", "_blank");

  printWindow.document.write(`
    <html>
      <head>
        <title>Tabela da Rifa</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 3mm;
          }

          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          html, body {
            margin: 0;
            padding: 0;
            width: 210mm;
            height: 297mm;
            font-family: Arial, Helvetica, sans-serif;
            background: white;
            color: #111;
          }

          body {
            padding: 2mm;
          }

          .page {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
          }

          .header {
            text-align: center;
            margin-bottom: 2mm;
            flex: 0 0 auto;
          }

          .header h1 {
            margin: 0;
            font-size: 11px;
            line-height: 1.1;
          }

          .header p {
            margin: 1mm 0 0 0;
            font-size: 8px;
            line-height: 1.1;
          }

          .legend {
            display: flex;
            justify-content: center;
            gap: 6mm;
            margin: 2mm 0 2mm 0;
            font-size: 8px;
            flex: 0 0 auto;
          }

          .legend-item {
            display: flex;
            align-items: center;
            gap: 1.5mm;
          }

          .legend-box {
            width: 4mm;
            height: 4mm;
            border: 0.3mm solid #555;
          }

          .legend-box.available {
            background: #ffffff;
          }

          .legend-box.reserved {
            background: #111827 !important;
            border-color: #111827 !important;
          }

          .grid {
            flex: 1 1 auto;
            display: grid;
            grid-template-columns: repeat(10, 1fr);
            gap: 1mm;
            align-content: stretch;
          }

          .cell {
            min-height: 12.6mm;
            height: 12.6mm;
            border: 0.35mm solid #666;
            border-radius: 1.5mm;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 9px;
            font-weight: 700;
            line-height: 1;
            background: #ffffff !important;
            color: #111111 !important;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .cell.reserved {
            background: #111827 !important;
            color: #ffffff !important;
            border-color: #111827 !important;
          }

          .cell.available {
            background: #ffffff !important;
            color: #111111 !important;
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <h1>Tabela Completa da Rifa</h1>
            <p>Números escuros = reservados</p>
          </div>

          <div class="legend">
            <div class="legend-item">
              <span class="legend-box available"></span>
              <span>Disponível</span>
            </div>
            <div class="legend-item">
              <span class="legend-box reserved"></span>
              <span>Reservado</span>
            </div>
          </div>

          <div class="grid">
            ${cells.join("")}
          </div>
        </div>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
  }, 300);
}

function initFirebase() {
  if (!isFirebaseConfigured()) {
    showMessage("Configure o firebase-config.js antes de usar o painel.", "error", loginMessage);
    return false;
  }

  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  participantsRef = collection(db, COLLECTION_NAME);

  return true;
}

function listenParticipants() {
  const q = query(participantsRef, orderBy("numero", "asc"));

  onSnapshot(
    q,
    (snapshot) => {
      participants = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data()
      }));

      updateCounters();
      renderNumbers();
      renderParticipants();
      renderRanking();
    },
    (error) => {
      console.error(error);
      showMessage("Erro ao sincronizar os dados.", "error");
    }
  );
}

function showAdmin(user) {
  loginScreen.classList.add("hidden");
  adminApp.classList.remove("hidden");
  adminUserEmail.textContent = user.email;
}

function showLogin() {
  adminApp.classList.add("hidden");
  loginScreen.classList.remove("hidden");
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    await signInWithEmailAndPassword(
      auth,
      loginEmail.value.trim(),
      loginPassword.value
    );
    loginForm.reset();
    showMessage("Login realizado com sucesso.", "success", loginMessage);
  } catch (error) {
    console.error(error);
    showMessage("Email ou senha inválidos.", "error", loginMessage);
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    showMessage("Logout realizado com sucesso.", "success");
  } catch (error) {
    console.error(error);
    showMessage("Erro ao sair.", "error");
  }
});

adminFilterButtons.forEach((btn) => {
  btn.addEventListener("click", () => setFilter(btn.dataset.filter));
});

searchInput.addEventListener("input", (event) => {
  currentSearch = event.target.value;
  renderParticipants();
  renderRanking();
});

clearSearchBtn.addEventListener("click", () => {
  currentSearch = "";
  searchInput.value = "";
  renderParticipants();
  renderRanking();
});

orderFilter.addEventListener("change", () => {
  renderParticipants();
  renderRanking();
});

applyDateFilterBtn.addEventListener("click", () => {
  currentDateFrom = dateFrom.value;
  currentDateTo = dateTo.value;
  currentTimeFrom = timeFrom.value;
  currentTimeTo = timeTo.value;
  renderParticipants();
  renderRanking();
});

clearDateFilterBtn.addEventListener("click", () => {
  currentDateFrom = "";
  currentDateTo = "";
  currentTimeFrom = "";
  currentTimeTo = "";

  dateFrom.value = "";
  dateTo.value = "";
  timeFrom.value = "";
  timeTo.value = "";

  renderParticipants();
  renderRanking();
});

showRankingBtn.addEventListener("click", renderRanking);
exportBtn.addEventListener("click", exportExcel);
printReservedBtn.addEventListener("click", printReservedTable);
printFullGridBtn.addEventListener("click", printFullGrid);

function start() {
  updateCounters();
  renderNumbers();
  renderParticipants();
  renderRanking();
  setFilter("todos");

  const ok = initFirebase();
  if (!ok) return;

  onAuthStateChanged(auth, (user) => {
    if (user) {
      showAdmin(user);
      listenParticipants();
    } else {
      showLogin();
    }
  });
}

start();