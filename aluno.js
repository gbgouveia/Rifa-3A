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
const studentReferral = document.getElementById("studentReferral");
const studentForm = document.getElementById("studentForm");
const studentMessage = document.getElementById("studentMessage");
const studentNumbersGrid = document.getElementById("studentNumbersGrid");
const selectedNumbersBox = document.getElementById("selectedNumbersBox");
const clearSelectionBtn = document.getElementById("clearSelectionBtn");

const studentTotal = document.getElementById("studentTotal");
const studentReserved = document.getElementById("studentReserved");
const studentAvailable = document.getElementById("studentAvailable");

const studentFilterButtons = document.querySelectorAll(".student-filter");

let db = null;
let participantsRef = null;
let participants = [];
let currentFilter = "todos";
let selectedNumbers = [];

function showMessage(text, type = "success") {
  studentMessage.textContent = text;
  studentMessage.className = `message ${type}`;

  setTimeout(() => {
    studentMessage.textContent = "";
    studentMessage.className = "message";
  }, 3500);
}

function isFirebaseConfigured() {
  return !!(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId);
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

function renderSelectedNumbersBox() {
  if (!selectedNumbers.length) {
    selectedNumbersBox.innerHTML = "Nenhum número selecionado.";
    return;
  }

  const sorted = [...selectedNumbers].sort((a, b) => a - b);

  selectedNumbersBox.innerHTML = sorted
    .map((num) => `<span class="number-pill">${num}</span>`)
    .join(" ");
}

function toggleSelectedNumber(number) {
  const index = selectedNumbers.indexOf(number);

  if (index >= 0) {
    selectedNumbers.splice(index, 1);
  } else {
    selectedNumbers.push(number);
  }

  renderSelectedNumbersBox();
  renderNumbers();
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
      if (selectedNumbers.includes(i)) {
        item.classList.add("selected");
      }

      item.addEventListener("click", () => {
        toggleSelectedNumber(i);
      });
    }

    studentNumbersGrid.appendChild(item);
  }

  applyFilter();
}

function getFormData() {
  return {
    nome: studentName.value.trim(),
    telefone: studentPhone.value.trim(),
    numeros: [...selectedNumbers],
    indicacao: studentReferral.value.trim()
  };
}

function validateForm(data) {
  if (!data.nome || !data.telefone) {
    throw new Error("Preencha nome e telefone.");
  }

  if (!data.numeros.length) {
    throw new Error("Selecione pelo menos um número.");
  }

  if (normalizePhone(data.telefone).length < 10) {
    throw new Error("Digite um telefone válido.");
  }

  const invalidNumbers = data.numeros.filter(
    (num) => num < 1 || num > TOTAL_NUMBERS || isReserved(num)
  );

  if (invalidNumbers.length) {
    throw new Error("Um ou mais números selecionados já foram reservados.");
  }
}

async function saveRegistration(data) {
  if (!db || !participantsRef) {
    throw new Error("Firebase não configurado.");
  }

  for (const numero of data.numeros) {
    await addDoc(participantsRef, {
      nome: data.nome,
      telefone: data.telefone,
      numero: Number(numero),
      indicacao: data.indicacao || "",
      criadoEm: serverTimestamp()
    });
  }
}

function clearForm() {
  studentForm.reset();
  selectedNumbers = [];
  renderSelectedNumbersBox();
  renderNumbers();
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

      selectedNumbers = selectedNumbers.filter((num) => !isReserved(num));

      updateCounters();
      renderSelectedNumbersBox();
      renderNumbers();
    },
    (error) => {
      console.error(error);
      showMessage("Erro ao atualizar os números em tempo real.", "error");
    }
  );
}

studentFilterButtons.forEach((btn) => {
  btn.addEventListener("click", () => setFilter(btn.dataset.filter));
});

clearSelectionBtn.addEventListener("click", () => {
  selectedNumbers = [];
  renderSelectedNumbersBox();
  renderNumbers();
});

studentForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const data = getFormData();
    validateForm(data);
    await saveRegistration(data);

    const qtd = data.numeros.length;
    showMessage(
      qtd === 1
        ? "Cadastro salvo com sucesso."
        : `Cadastro salvo com sucesso para ${qtd} números.`,
      "success"
    );

    clearForm();
  } catch (error) {
    console.error(error);
    showMessage(error.message || "Erro ao salvar cadastro.", "error");
  }
});

function start() {
  updateCounters();
  renderSelectedNumbersBox();
  renderNumbers();
  setFilter("todos");

  const ok = initFirebase();
  if (ok) {
    listenParticipants();
  }
}

start();