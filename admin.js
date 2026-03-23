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

const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const exportBtn = document.getElementById("exportBtn");
const searchInfo = document.getElementById("searchInfo");
const participantsList = document.getElementById("participantsList");
const adminMessage = document.getElementById("adminMessage");

let db = null;
let auth = null;
let participantsRef = null;
let participants = [];
let currentFilter = "todos";
let currentSearch = "";

function showMessage(text, type = "success", target = adminMessage) {
  target.textContent = text;
  target.className = `message ${type}`;

  setTimeout(() => {
    target.textContent = "";
    target.className = "message";
  }, 3500);
}

function isFirebaseConfigured() {
  return !!(
    firebaseConfig &&
    firebaseConfig.apiKey &&
    firebaseConfig.projectId
  );
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
        <p><strong>Quem indicou:</strong> ${item.indicacao || "Não informado"}</p>
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

function exportExcel() {
  if (!participants.length) {
    showMessage("Não há participantes para exportar.", "error");
    return;
  }

  const data = participants.map((item) => ({
    Nome: item.nome,
    Telefone: item.telefone,
    Numero: item.numero,
    Indicacao: item.indicacao || "",
    ID: item.id
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Rifa");
  XLSX.writeFileXLSX(workbook, EXCEL_FILE_NAME);
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
});

clearSearchBtn.addEventListener("click", () => {
  currentSearch = "";
  searchInput.value = "";
  renderParticipants();
});

exportBtn.addEventListener("click", exportExcel);

function start() {
  updateCounters();
  renderNumbers();
  renderParticipants();
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