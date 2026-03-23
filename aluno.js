import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import {
  firebaseConfig,
  TOTAL_NUMBERS,
  COLLECTION_NAME
} from "./firebase-config.js";

const studentName = document.getElementById("studentName");
const studentPhone = document.getElementById("studentPhone");
const studentNumber = document.getElementById("studentNumber");
const studentReferral = document.getElementById("studentReferral");
const studentForm = document.getElementById("studentForm");
const studentMessage = document.getElementById("studentMessage");
const studentNumbersGrid = document.getElementById("studentNumbersGrid");

const studentTotal = document.getElementById("studentTotal");
const studentReserved = document.getElementById("studentReserved");
const studentAvailable = document.getElementById("studentAvailable");

const studentFilterButtons = document.querySelectorAll(".student-filter");

let db = null;
let participantsRef = null;
let participants = [];
let currentFilter = "todos";

function showMessage(text, type = "success") {
  studentMessage.textContent = text;
  studentMessage.className = `message ${type}`;

  setTimeout(() => {
    studentMessage.textContent = "";
    studentMessage.className = "message";
  }, 3500);
}

function isFirebaseConfigured() {
  return !!(
    firebaseConfig &&
    firebaseConfig.apiKey &&
    firebaseConfig.projectId
  );
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function isReserved(number) {
  return participants.some((item) => Number(item.numero) === Number(number));
}

function updateCounters() {
  const reserved = participants.length;
  const available = TOTAL_NUMBERS - reserved;

  studentTotal.textContent = TOTAL_NUMBERS;
  studentReserved.textContent = reserved;
  studentAvailable.textContent = available;
}

function clearSelectedVisual() {
  document.querySelectorAll(".number-item").forEach((item) => {
    item.classList.remove("selected");
  });
}

function syncSelectedInput() {
  const value = Number(studentNumber.value);
  clearSelectedVisual();

  if (!value || value < 1 || value > TOTAL_NUMBERS) return;

  document.querySelectorAll(".number-item").forEach((item) => {
    const num = Number(item.dataset.number);
    if (num === value && !item.classList.contains("reserved")) {
      item.classList.add("selected");
    }
  });
}

function applyFilter() {
  document.querySelectorAll(".number-item").forEach((item) => {
    item.classList.remove("hidden");

    const reserved = item.classList.contains("reserved");

    if (currentFilter === "disponiveis" && reserved) {
      item.classList.add("hidden");
    }

    if (currentFilter === "reservados" && !reserved) {
      item.classList.add("hidden");
    }
  });
}

function setFilter(filter) {
  currentFilter = filter;

  studentFilterButtons.forEach((btn) => {
    const active = btn.dataset.filter === filter;
    btn.classList.toggle("active", active);
    btn.classList.toggle("btn-dark", active);
    btn.classList.toggle("btn-light", !active);
  });

  applyFilter();
}

function renderNumbers() {
  studentNumbersGrid.innerHTML = "";

  for (let i = 1; i <= TOTAL_NUMBERS; i++) {
    const item = document.createElement("div");
    item.className = "number-item";
    item.dataset.number = i;
    item.textContent = i;

    if (isReserved(i)) {
      item.classList.add("reserved");
    } else {
      item.addEventListener("click", () => {
        clearSelectedVisual();
        item.classList.add("selected");
        studentNumber.value = i;
      });
    }

    studentNumbersGrid.appendChild(item);
  }

  syncSelectedInput();
  applyFilter();
}

function getFormData() {
  return {
    nome: studentName.value.trim(),
    telefone: studentPhone.value.trim(),
    numero: Number(studentNumber.value),
    indicacao: studentReferral.value.trim()
  };
}

function validateForm(data) {
  if (!data.nome || !data.telefone || !data.numero) {
    throw new Error("Preencha nome, telefone e número.");
  }

  if (data.numero < 1 || data.numero > TOTAL_NUMBERS) {
    throw new Error(`Escolha um número entre 1 e ${TOTAL_NUMBERS}.`);
  }

  if (isReserved(data.numero)) {
    throw new Error("Esse número já foi reservado.");
  }

  if (normalizePhone(data.telefone).length < 10) {
    throw new Error("Digite um telefone válido.");
  }
}

async function saveRegistration(data) {
  if (!db || !participantsRef) {
    throw new Error("Firebase não configurado.");
  }

  await addDoc(participantsRef, {
    nome: data.nome,
    telefone: data.telefone,
    numero: Number(data.numero),
    indicacao: data.indicacao || "",
    criadoEm: serverTimestamp()
  });
}

function clearForm() {
  studentForm.reset();
  clearSelectedVisual();
}

function initFirebase() {
  if (!isFirebaseConfigured()) {
    renderNumbers();
    updateCounters();
    showMessage("Configure o arquivo firebase-config.js primeiro.", "error");
    return false;
  }

  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
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
    },
    (error) => {
      console.error(error);
      showMessage("Erro ao atualizar os números em tempo real.", "error");
    }
  );
}

studentNumber.addEventListener("input", syncSelectedInput);

studentFilterButtons.forEach((btn) => {
  btn.addEventListener("click", () => setFilter(btn.dataset.filter));
});

studentForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const data = getFormData();
    validateForm(data);
    await saveRegistration(data);
    showMessage("Cadastro salvo com sucesso.", "success");
    clearForm();
  } catch (error) {
    console.error(error);
    showMessage(error.message || "Erro ao salvar cadastro.", "error");
  }
});

function start() {
  updateCounters();
  renderNumbers();
  setFilter("todos");

  const ok = initFirebase();
  if (ok) {
    listenParticipants();
  }
}

start();