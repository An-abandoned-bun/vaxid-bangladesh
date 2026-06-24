import { firebaseConfig } from "./firebase-config.js";
import { geminiBackendUrl } from "./ai-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  addDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const app = initializeApp(firebaseConfig);

// Offline persistence for clinic/hospital updates.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

const $ = (id) => document.getElementById(id);

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function setDefaults() {
  const ids = ["dob", "vaccineDueDate", "vaccineCompletedDate", "visitDate"];
  ids.forEach((id) => {
    const el = $(id);
    if (el && !el.value) el.value = todayIso();
  });
}

function setConnectionStatus() {
  const el = $("connectionStatus");
  if (!el) return;
  if (navigator.onLine) {
    el.textContent = "Online";
    el.className = "badge online";
  } else {
    el.textContent = "Offline: clinic changes will sync later";
    el.className = "badge offline";
  }
}

function showJson(elementId, data) {
  $(elementId).textContent = JSON.stringify(data, null, 2);
}

function showText(elementId, text) {
  $(elementId).textContent = text;
}

function makeChildId() {
  if (crypto && crypto.randomUUID) {
    return "CH-" + crypto.randomUUID().slice(0, 8).toUpperCase();
  }
  return "CH-" + Math.random().toString(16).slice(2, 10).toUpperCase();
}

function makeQrUrl(childId) {
  const payload = `VAXID:${childId}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(payload)}`;
}

function copyChildIdToOtherFields(childId) {
  ["vaxChildId", "healthChildId", "aiChildId", "reminderChildId", "profileChildId"].forEach((id) => {
    const el = $(id);
    if (el) el.value = childId;
  });
}

async function getRecords(collectionName, childId) {
  const q = query(collection(db, collectionName), where("child_id", "==", childId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function rowsToTable(title, rows) {
  if (!rows.length) return `<h3>${title}</h3><p>No records found.</p>`;
  const cleanRows = rows.map((row) => {
    const copy = { ...row };
    Object.keys(copy).forEach((key) => {
      if (copy[key] && typeof copy[key] === "object" && copy[key].seconds) {
        copy[key] = new Date(copy[key].seconds * 1000).toISOString();
      }
    });
    return copy;
  });
  const keys = Object.keys(cleanRows[0]);
  const header = keys.map((key) => `<th>${key}</th>`).join("");
  const body = cleanRows.map((row) => {
    const cells = keys.map((key) => `<td>${row[key] ?? ""}</td>`).join("");
    return `<tr>${cells}</tr>`;
  }).join("");
  return `<h3>${title}</h3><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
}

function calculateRisk(vaccinations, healthRecords) {
  // Lightweight prototype ML risk model.
  // This is a logistic-regression style model with fixed demo weights.
  // In a production system, these weights should be trained/validated on approved public-health data.
  const missedCount = vaccinations.filter((v) => v.status === "missed").length;
  const reviewCount = vaccinations.filter((v) => v.status === "review_required").length;
  const lateOrDueCount = vaccinations.filter((v) => ["due", "due_soon"].includes(v.status)).length;
  const diagnosisText = healthRecords.map((r) => `${r.diagnosis || ""} ${r.doctor_notes || ""} ${r.medicine || ""}`).join(" ").toLowerCase();

  const reviewKeywords = [
    "allergy",
    "severe allergic",
    "immunocompromised",
    "immune",
    "convulsion",
    "seizure",
    "high fever",
    "fever",
    "reaction",
    "anaphylaxis"
  ];

  const needsDoctorReview = reviewKeywords.some((word) => diagnosisText.includes(word)) || reviewCount > 0;

  // Logistic model: p = 1 / (1 + e^-z)
  const z =
    -2.1 +
    missedCount * 1.25 +
    lateOrDueCount * 0.45 +
    reviewCount * 0.85 +
    (needsDoctorReview ? 1.1 : 0) +
    Math.min(healthRecords.length, 6) * 0.08;

  const probability = 1 / (1 + Math.exp(-z));
  const score = Math.round(probability * 100);

  let riskLevel = "Low";
  if (score >= 70) riskLevel = "High";
  else if (score >= 35) riskLevel = "Medium";

  return {
    risk_score: score,
    risk_probability: Number(probability.toFixed(3)),
    risk_level: riskLevel,
    missed_vaccine_count: missedCount,
    due_or_due_soon_count: lateOrDueCount,
    doctor_review_required: needsDoctorReview,
    model_type: "prototype_logistic_regression_style_ml"
  };
}

async function callGeminiBackend(mode, payload) {
  if (!geminiBackendUrl || geminiBackendUrl.includes("PASTE_YOUR")) {
    throw new Error("Gemini backend URL is not set. Paste your Cloudflare Worker URL in public/ai-config.js first.");
  }

  const response = await fetch(geminiBackendUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, ...payload })
  });

  let data = null;
  try {
    data = await response.json();
  } catch (_) {
    data = { error: await response.text() };
  }

  if (!response.ok || !data.ok) {
    throw new Error(data.error || `Gemini backend failed with HTTP ${response.status}`);
  }
  return data;
}

function buildSafeAiLikeMessage(child, vaccinations, healthRecords, risk) {
  const nextVaccine = vaccinations.find((v) => ["due", "due_soon", "missed", "review_required"].includes(v.status));
  const childName = child.child_name || "the child";
  const vaccineLine = nextVaccine
    ? `${nextVaccine.vaccine_name} is currently marked as ${nextVaccine.status}. Due date: ${nextVaccine.due_date || "not set"}.`
    : "No due or missed vaccine record was found.";

  const reviewLine = risk.doctor_review_required
    ? "Hospital records contain information that should be checked by a doctor before deciding vaccine timing, vaccine type, or any extra/double-dose question. The AI must not decide this alone."
    : "No special doctor-review warning was detected from the demo records.";

  return `VaxID review for ${childName}: ${vaccineLine}\n\nMissed-vaccine risk: ${risk.risk_level} (${risk.risk_score}/100).\n\n${reviewLine}\n\nParent/clinic message: Please follow the official EPI schedule and confirm any special vaccine or dose decision with an authorized doctor or clinic.`;
}

$("registerChildBtn")?.addEventListener("click", async () => {
  try {
    const childId = makeChildId();
    const qrPayload = `VAXID:${childId}`;
    const qrUrl = makeQrUrl(childId);

    const payload = {
      child_id: childId,
      child_name: $("childName").value.trim(),
      birth_certificate_no: $("birthCertificateNo").value.trim(),
      dob: $("dob").value,
      parent_name: $("parentName").value.trim(),
      parent_phone: $("parentPhone").value.trim(),
      preferred_clinic: $("preferredClinic").value.trim(),
      area: $("area").value.trim(),
      opted_in_vaccination: $("optedInVaccination").value === "yes",
      status: "alive",
      qr_payload: qrPayload,
      qr_png_url: qrUrl,
      source: "birth_registration_web_app",
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    };

    if (!payload.child_name) throw new Error("Child name is required.");
    if (!payload.birth_certificate_no) throw new Error("Birth certificate number is required.");

    await setDoc(doc(db, "children", childId), payload);
    copyChildIdToOtherFields(childId);

    $("registerResult").innerHTML = `Child registered successfully.\nChild ID: ${childId}\nQR payload: ${qrPayload}\n`;
    const img = document.createElement("img");
    img.className = "qr";
    img.src = qrUrl;
    img.alt = "Generated VaxID QR code";
    $("registerResult").appendChild(img);
  } catch (error) {
    showText("registerResult", `Error: ${error.message}`);
  }
});

$("saveVaccinationBtn")?.addEventListener("click", async () => {
  try {
    const childId = $("vaxChildId").value.trim();
    if (!childId) throw new Error("Child ID is required.");

    const payload = {
      child_id: childId,
      vaccine_name: $("vaccineName").value.trim(),
      due_date: $("vaccineDueDate").value,
      completed_date: $("vaccineCompletedDate").value || null,
      status: $("vaccineStatus").value,
      source: "clinic_web_app",
      entered_offline_capable: true,
      updated_at: serverTimestamp()
    };

    const ref = await addDoc(collection(db, "vaccination_records"), payload);
    showJson("vaccinationResult", {
      saved: true,
      record_id: ref.id,
      note: navigator.onLine
        ? "Saved online."
        : "Saved locally. Firestore will sync this when the device is online again."
    });
  } catch (error) {
    showText("vaccinationResult", `Error: ${error.message}`);
  }
});

$("saveHealthBtn")?.addEventListener("click", async () => {
  try {
    const childId = $("healthChildId").value.trim();
    if (!childId) throw new Error("Child ID is required.");

    const payload = {
      child_id: childId,
      hospital_name: $("hospitalName").value.trim(),
      visit_date: $("visitDate").value,
      diagnosis: $("diagnosis").value.trim(),
      doctor_notes: $("doctorNotes").value.trim(),
      medicine: $("medicine").value.trim(),
      source: "hospital_web_app",
      entered_offline_capable: true,
      updated_at: serverTimestamp()
    };

    const ref = await addDoc(collection(db, "health_records"), payload);
    showJson("healthResult", {
      saved: true,
      record_id: ref.id,
      note: navigator.onLine
        ? "Saved online."
        : "Saved locally. Firestore will sync this when the device is online again."
    });
  } catch (error) {
    showText("healthResult", `Error: ${error.message}`);
  }
});

$("runAiReviewBtn")?.addEventListener("click", async () => {
  try {
    const childId = $("aiChildId").value.trim();
    if (!childId) throw new Error("Child ID is required.");

    const childSnap = await getDoc(doc(db, "children", childId));
    if (!childSnap.exists()) throw new Error("Child not found.");

    const child = childSnap.data();
    const vaccinations = await getRecords("vaccination_records", childId);
    const healthRecords = await getRecords("health_records", childId);
    const risk = calculateRisk(vaccinations, healthRecords);

    const gemini = await callGeminiBackend("review", {
      child: { child_id: childId, ...child },
      vaccinations,
      healthRecords,
      risk
    });

    const ref = await addDoc(collection(db, "ai_messages"), {
      child_id: childId,
      message: gemini.text,
      risk,
      mode: "real_gemini_api_via_cloudflare_worker_free",
      model: gemini.model,
      created_at: serverTimestamp()
    });

    showJson("aiResult", {
      saved: true,
      ai_message_id: ref.id,
      child_id: childId,
      model: gemini.model,
      ...risk,
      gemini_message: gemini.text
    });
  } catch (error) {
    showText("aiResult", `Error: ${error.message}`);
  }
});

$("generateReminderBtn")?.addEventListener("click", async () => {
  try {
    const childId = $("reminderChildId").value.trim();
    if (!childId) throw new Error("Child ID is required.");

    const childSnap = await getDoc(doc(db, "children", childId));
    if (!childSnap.exists()) throw new Error("Child not found.");

    const child = childSnap.data();
    const vaccinations = await getRecords("vaccination_records", childId);
    const healthRecords = await getRecords("health_records", childId);
    const risk = calculateRisk(vaccinations, healthRecords);

    const gemini = await callGeminiBackend("reminder", {
      child: { child_id: childId, ...child },
      vaccinations,
      healthRecords,
      risk
    });

    const ref = await addDoc(collection(db, "reminders"), {
      child_id: childId,
      reminder_type: "Gemini SMS/text draft",
      message: gemini.text,
      status: "generated_by_gemini",
      model: gemini.model,
      created_at: serverTimestamp()
    });

    showJson("reminderResult", {
      saved: true,
      reminder_id: ref.id,
      model: gemini.model,
      message: gemini.text
    });
  } catch (error) {
    showText("reminderResult", `Error: ${error.message}`);
  }
});

$("loadProfileBtn")?.addEventListener("click", async () => {
  try {
    const childId = $("profileChildId").value.trim();
    if (!childId) throw new Error("Child ID is required.");

    const childSnap = await getDoc(doc(db, "children", childId));
    if (!childSnap.exists()) {
      showText("profileResult", "Child not found.");
      return;
    }

    const child = childSnap.data();
    const vaccinations = await getRecords("vaccination_records", childId);
    const health = await getRecords("health_records", childId);
    const reminders = await getRecords("reminders", childId);
    const messages = await getRecords("ai_messages", childId);

    let html = `<h3>Child</h3><pre>${JSON.stringify({ id: childId, ...child }, null, 2)}</pre>`;
    if (child.qr_png_url) {
      html += `<img class="qr" src="${child.qr_png_url}" alt="VaxID QR code" />`;
    }
    html += rowsToTable("Vaccination records", vaccinations);
    html += rowsToTable("Hospital records", health);
    html += rowsToTable("Reminders", reminders);
    html += rowsToTable("AI messages", messages);
    $("profileResult").innerHTML = html;
  } catch (error) {
    showText("profileResult", `Error: ${error.message}`);
  }
});

setDefaults();
setConnectionStatus();
window.addEventListener("online", setConnectionStatus);
window.addEventListener("offline", setConnectionStatus);
