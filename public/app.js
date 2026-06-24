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
  serverTimestamp,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

const $ = (id) => document.getElementById(id);

const FACILITIES = {
  Dhaka: [
    "Dhaka Medical College Hospital", "Sir Salimullah Medical College Mitford Hospital", "Shaheed Suhrawardy Medical College Hospital",
    "Mugda Medical College Hospital", "Kurmitola General Hospital", "Dhaka Shishu Hospital", "Bangabandhu Sheikh Mujib Medical University",
    "National Institute of Cardiovascular Diseases", "National Institute of Diseases of the Chest and Hospital", "National Institute of Neurosciences Hospital",
    "Central Police Hospital", "Mohakhali EPI Center", "Azimpur Maternity and Child Health Training Institute", "Dhaka South City Corporation EPI Center",
    "Dhaka North City Corporation EPI Center", "Ibn Sina Specialized Hospital", "Square Hospital", "Labaid Specialized Hospital", "United Hospital",
    "Evercare Hospital Dhaka", "Bangladesh Specialized Hospital", "Anwer Khan Modern Medical College Hospital", "Holy Family Red Crescent Medical College Hospital",
    "Uttara Adhunik Medical College Hospital", "Kuwait Bangladesh Friendship Government Hospital", "Savar Upazila Health Complex",
    "Dhamrai Upazila Health Complex", "Narayanganj 300 Bed Hospital", "Narayanganj General Hospital", "Gazipur Shaheed Tajuddin Ahmad Medical College Hospital",
    "Gazipur Sadar Hospital", "Tongi Upazila Health Complex", "Kaliganj EPI Center", "Manikganj District Hospital", "Munshiganj General Hospital",
    "Narsingdi District Hospital", "Faridpur Medical College Hospital", "Madaripur District Hospital", "Shariatpur District Hospital",
    "Gopalganj 250 Bed General Hospital", "Rajbari District Hospital"
  ],
  Chattogram: [
    "Chattogram Medical College Hospital", "Chattogram General Hospital", "Chattogram Maa-O-Shishu Hospital", "Bangabandhu Memorial Hospital Chattogram",
    "Chittagong City Corporation EPI Center", "Cox's Bazar Sadar Hospital", "Cox's Bazar Medical College Hospital", "Cumilla Medical College Hospital",
    "Cumilla General Hospital", "Feni Sadar Hospital", "Noakhali 250 Bed General Hospital", "Noakhali Medical College Hospital",
    "Lakshmipur District Hospital", "Chandpur 250 Bed General Hospital", "Brahmanbaria District Hospital", "Rangamati General Hospital",
    "Khagrachari District Hospital", "Bandarban Sadar Hospital", "Sitakunda Upazila Health Complex", "Patiya Upazila Health Complex",
    "Hathazari Upazila Health Complex", "Mirsharai Upazila Health Complex", "Lohagara Upazila Health Complex", "Raozan Upazila Health Complex"
  ],
  Rajshahi: [
    "Rajshahi Medical College Hospital", "Rajshahi Sadar Hospital", "Rajshahi City Corporation EPI Center", "Naogaon 250 Bed General Hospital",
    "Natore Sadar Hospital", "Pabna General Hospital", "Pabna Medical College Hospital", "Bogura Shaheed Ziaur Rahman Medical College Hospital",
    "Bogura 250 Bed Mohammad Ali Hospital", "Joypurhat District Hospital", "Sirajganj 250 Bed General Hospital", "Sirajganj Shaheed M. Monsur Ali Medical College Hospital",
    "Chapainawabganj District Hospital", "Godagari Upazila Health Complex", "Puthia Upazila Health Complex", "Bagha Upazila Health Complex",
    "Tanore Upazila Health Complex", "Atrai Upazila Health Complex", "Gurudaspur Upazila Health Complex"
  ],
  Khulna: [
    "Khulna Medical College Hospital", "Khulna General Hospital", "Khulna City Corporation EPI Center", "Jashore 250 Bed General Hospital",
    "Jashore Medical College Hospital", "Kushtia General Hospital", "Kushtia Medical College Hospital", "Satkhira Sadar Hospital",
    "Bagerhat District Hospital", "Jhenaidah Sadar Hospital", "Magura District Hospital", "Narail Sadar Hospital", "Chuadanga Sadar Hospital",
    "Meherpur General Hospital", "Mongla Upazila Health Complex", "Dumuria Upazila Health Complex", "Koyra Upazila Health Complex",
    "Paikgacha Upazila Health Complex", "Abhaynagar Upazila Health Complex"
  ],
  Barishal: [
    "Sher-e-Bangla Medical College Hospital", "Barishal General Hospital", "Barishal City Corporation EPI Center", "Patuakhali Medical College Hospital",
    "Patuakhali Sadar Hospital", "Bhola 250 Bed General Hospital", "Barguna District Hospital", "Jhalokathi Sadar Hospital",
    "Pirojpur District Hospital", "Gournadi Upazila Health Complex", "Bakerganj Upazila Health Complex", "Banaripara Upazila Health Complex",
    "Char Fasson Upazila Health Complex", "Lalmohan Upazila Health Complex", "Mathbaria Upazila Health Complex"
  ],
  Sylhet: [
    "Sylhet MAG Osmani Medical College Hospital", "Sylhet Sadar Hospital", "Sylhet City Corporation EPI Center", "Moulvibazar 250 Bed District Hospital",
    "Habiganj District Hospital", "Sunamganj Sadar Hospital", "Beanibazar Upazila Health Complex", "Golapganj Upazila Health Complex",
    "Jaintapur Upazila Health Complex", "Balaganj Upazila Health Complex", "Sreemangal Upazila Health Complex", "Kulaura Upazila Health Complex",
    "Chhatak Upazila Health Complex", "Jagannathpur Upazila Health Complex"
  ],
  Rangpur: [
    "Rangpur Medical College Hospital", "Rangpur Sadar Hospital", "Rangpur City Corporation EPI Center", "Dinajpur M Abdur Rahim Medical College Hospital",
    "Dinajpur General Hospital", "Kurigram Sadar Hospital", "Lalmonirhat District Hospital", "Gaibandha District Hospital",
    "Nilphamari Sadar Hospital", "Thakurgaon Modern Sadar Hospital", "Panchagarh District Hospital", "Saidpur 100 Bed Hospital",
    "Pirganj Upazila Health Complex", "Badarganj Upazila Health Complex", "Mithapukur Upazila Health Complex", "Ulipur Upazila Health Complex"
  ],
  Mymensingh: [
    "Mymensingh Medical College Hospital", "Mymensingh Sadar Hospital", "Mymensingh City Corporation EPI Center", "Jamalpur 250 Bed General Hospital",
    "Sherpur District Hospital", "Netrokona Modern District Hospital", "Kishoreganj 250 Bed General Hospital", "Bhaluka Upazila Health Complex",
    "Trishal Upazila Health Complex", "Muktagacha Upazila Health Complex", "Gaffargaon Upazila Health Complex", "Ishwarganj Upazila Health Complex",
    "Haluaghat Upazila Health Complex", "Dewanganj Upazila Health Complex", "Bajitpur Jahurul Islam Medical College Hospital"
  ]
};

const VACCINES = [
  "BCG",
  "OPV-0",
  "OPV-1",
  "OPV-2",
  "OPV-3",
  "Pentavalent-1",
  "Pentavalent-2",
  "Pentavalent-3",
  "PCV-1",
  "PCV-2",
  "PCV-3",
  "IPV-1",
  "IPV-2",
  "MR-1",
  "MR-2",
  "Measles-Rubella",
  "Td",
  "Td-1",
  "Td-2",
  "HPV",
  "Hepatitis B Birth Dose",
  "Hepatitis B",
  "Rotavirus-1",
  "Rotavirus-2",
  "Rotavirus-3",
  "Influenza",
  "Typhoid Conjugate Vaccine",
  "Varicella",
  "Hepatitis A",
  "Meningococcal",
  "Japanese Encephalitis",
  "Rabies PEP",
  "Cholera",
  "COVID-19"
];

const AREAS = [
  "Bagerhat", "Bandarban", "Barguna", "Barishal", "Bhola", "Bogura", "Brahmanbaria", "Chandpur", "Chapainawabganj",
  "Chattogram", "Chuadanga", "Comilla", "Cox's Bazar", "Dhaka", "Dinajpur", "Faridpur", "Feni", "Gaibandha",
  "Gazipur", "Gopalganj", "Habiganj", "Jamalpur", "Jashore", "Jhalokathi", "Jhenaidah", "Joypurhat", "Khagrachari",
  "Khulna", "Kishoreganj", "Kurigram", "Kushtia", "Lakshmipur", "Lalmonirhat", "Madaripur", "Magura", "Manikganj",
  "Meherpur", "Moulvibazar", "Munshiganj", "Mymensingh", "Naogaon", "Narail", "Narayanganj", "Narsingdi", "Natore",
  "Netrokona", "Nilphamari", "Noakhali", "Pabna", "Panchagarh", "Patuakhali", "Pirojpur", "Rajbari", "Rajshahi",
  "Rangamati", "Rangpur", "Satkhira", "Shariatpur", "Sherpur", "Sirajganj", "Sunamganj", "Sylhet", "Tangail",
  "Thakurgaon", "Uttara", "Mirpur", "Dhanmondi", "Mohakhali", "Banani", "Gulshan", "Motijheel", "Savar", "Tongi",
  "Kaliganj", "Gazipur Sadar", "Narayanganj Sadar", "Cox's Bazar Sadar", "Cumilla Sadar", "Mymensingh Sadar"
];

function allFacilities() {
  return Object.entries(FACILITIES).flatMap(([region, names]) => names.map((name) => ({ region, name })));
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function setDefaults() {
  // No sample names/dates are pre-filled. The form starts clean.
  updateBirthCertificatePlaceholder();
}

function setConnectionStatus() {
  const el = $("connectionStatus");
  if (!el) return;
  if (navigator.onLine) {
    el.textContent = "Online";
    el.className = "status-pill";
  } else {
    el.textContent = "Offline sync enabled";
    el.className = "status-pill offline";
  }
}

function makeChildId() {
  if (crypto && crypto.randomUUID) return "CH-" + crypto.randomUUID().slice(0, 8).toUpperCase();
  return "CH-" + Math.random().toString(16).slice(2, 10).toUpperCase();
}

function makeProfileUrl(childId) {
  return `${window.location.origin}/profile.html?id=${encodeURIComponent(childId)}`;
}

function makeQrUrl(childId) {
  const payload = makeProfileUrl(childId);
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payload)}`;
}

function copyChildIdToOtherFields(childId) {
  ["vaxChildId", "healthChildId", "aiChildId", "reminderChildId", "profileChildId"].forEach((id) => {
    if ($(id)) $(id).value = childId;
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fillDatalist(listId, items) {
  const list = $(listId);
  if (!list) return;
  list.innerHTML = items.map((item) => `<option value="${escapeHtml(item)}"></option>`).join("");
}

function fillFacilityList(regionInputId, listId) {
  const region = $(regionInputId).value;
  fillDatalist(listId, FACILITIES[region] || []);
}

function fillVaccineList() {
  fillDatalist("vaccineList", VACCINES);
}

function fillAreaList() {
  fillDatalist("areaList", AREAS);
}

function nextBirthCertificateNoFromCounter(current, year) {
  const next = Number(current || 0) + 1;
  return `BC-${year}-${String(next).padStart(6, "0")}`;
}

async function updateBirthCertificatePlaceholder() {
  // Placeholders are intentionally disabled. If the birth certificate field is blank,
  // the system still auto-generates the next ID during registration.
}

async function getNextBirthCertificateNo() {
  const year = new Date().getFullYear();
  const counterRef = doc(db, "system_counters", "birth_certificate");

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);
    const data = snap.exists() ? snap.data() : {};
    const current = data.year === year ? Number(data.current || 0) : 0;
    const next = current + 1;
    transaction.set(counterRef, {
      year,
      current: next,
      updated_at: serverTimestamp()
    }, { merge: true });
    return `BC-${year}-${String(next).padStart(6, "0")}`;
  });
}

async function getRecords(collectionName, childId) {
  const q = query(collection(db, collectionName), where("child_id", "==", childId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function getPatientRecords(childId) {
  const oldRecords = await getRecords("health_records", childId);
  const newRecords = await getRecords("patient_records", childId);
  return [...oldRecords, ...newRecords].sort((a, b) => (b.visit_date || "").localeCompare(a.visit_date || ""));
}

function normalizeTimestamp(value) {
  if (value && typeof value === "object" && value.seconds) return new Date(value.seconds * 1000).toISOString();
  return value ?? "";
}

function renderMessageLines(text) {
  return `<div class="sms-preview"><pre>${escapeHtml(text)}</pre></div>`;
}

function getDueSummary(vaccinations) {
  const missed = vaccinations.filter((v) => v.status === "missed").length;
  const dueSoon = vaccinations.filter((v) => ["due_soon", "due"].includes(v.status)).length;
  const completed = vaccinations.filter((v) => v.status === "completed").length;
  return { missed, dueSoon, completed };
}

function calculateRisk(vaccinations, patientRecords) {
  const missedCount = vaccinations.filter((v) => v.status === "missed").length;
  const dueSoonCount = vaccinations.filter((v) => ["due", "due_soon"].includes(v.status)).length;
  const recordText = patientRecords.map((r) => `${r.diagnosis || ""} ${r.doctor_notes || ""} ${r.medicine || ""}`).join(" ").toLowerCase();
  const variantKeywords = [
    "allergy",
    "severe allergy",
    "anaphylaxis",
    "immunocompromised",
    "immune",
    "immunosuppression",
    "chemotherapy",
    "radiotherapy",
    "radiation therapy",
    "cancer",
    "malignancy",
    "tumor",
    "steroid",
    "transplant",
    "seizure",
    "convulsion",
    "neurological",
    "premature",
    "low birth weight"
  ];
  const doctorReviewRequired = variantKeywords.some((word) => recordText.includes(word));

  const z = -2.2 + missedCount * 1.4 + dueSoonCount * 0.55 + (doctorReviewRequired ? 1.1 : 0) + Math.min(patientRecords.length, 6) * 0.06;
  const probability = 1 / (1 + Math.exp(-z));
  const riskScore = Math.round(probability * 100);
  let riskLevel = "Low";
  if (riskScore >= 70) riskLevel = "High";
  else if (riskScore >= 35) riskLevel = "Medium";

  return {
    risk_score: riskScore,
    risk_probability: Number(probability.toFixed(3)),
    risk_level: riskLevel,
    missed_vaccine_count: missedCount,
    due_or_due_soon_count: dueSoonCount,
    doctor_review_required: doctorReviewRequired,
    model_type: "prototype_logistic_regression_style_ml"
  };
}

async function callGroqBackend(mode, payload) {
  if (!geminiBackendUrl || geminiBackendUrl.includes("PASTE_YOUR")) {
    throw new Error("Set your Cloudflare Worker URL in public/ai-config.js first.");
  }
  const response = await fetch(geminiBackendUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, ...payload })
  });
  let data;
  try { data = await response.json(); } catch { data = { error: await response.text() }; }
  if (!response.ok || !(data.ok || data.success)) {
    throw new Error(data.error || `Groq backend failed with HTTP ${response.status}`);
  }
  return {
    text: data.text || data.ai_response || data.message || "",
    model: data.model || data.model_used || "groq"
  };
}

function renderRegisterResult(resultEl, payload) {
  resultEl.innerHTML = `
    <div class="qr-card">
      <img class="qr" src="${escapeHtml(payload.qr_png_url)}" alt="VaxID QR code" />
      <div>
        <h3 class="result-title">Registration completed</h3>
        <div class="result-meta">
          <span class="chip">Region: ${escapeHtml(payload.region)}</span>
          <span class="chip">Venue: ${escapeHtml(payload.preferred_clinic)}</span>
        </div>
        <p class="small-note"><a class="action-link" href="${escapeHtml(makeProfileUrl(payload.child_id))}" target="_blank" rel="noopener">Open child profile page</a></p>
        <div class="kv">
          <div>Child name</div><div>${escapeHtml(payload.child_name)}</div>
          <div>Birth certificate</div><div>${escapeHtml(payload.birth_certificate_no)}</div>
          <div>Parent/guardian</div><div>${escapeHtml(payload.parent_name)} (${escapeHtml(payload.parent_phone)})</div>
          <div>Enrollment</div><div>${payload.opted_in_vaccination ? "Enrolled in vaccination program" : "Not enrolled"}</div>
        </div>
      </div>
    </div>`;
}

function renderSimpleSuccess(resultEl, title, lines = [], note = "") {
  resultEl.innerHTML = `
    <div class="notice">
      <h3 class="result-title">${escapeHtml(title)}</h3>
      ${lines.length ? `<div class="kv">${lines.map(([k,v]) => `<div>${escapeHtml(k)}</div><div>${escapeHtml(v)}</div>`).join("")}</div>` : ""}
      ${note ? `<p>${escapeHtml(note)}</p>` : ""}
    </div>`;
}


function normalizeAiText(text) {
  return String(text || "")
    .replace(/\\n/g, "\n")
    .replace(/\r/g, "")
    .trim();
}

function getDoctorReviewFromAiText(text) {
  const clean = normalizeAiText(text).toLowerCase();

  // Exact structured line check first.
  const exactMatch = clean.match(/doctor\s+review\s+required\s*:\s*(yes|no)/i);
  if (exactMatch) return exactMatch[1].toLowerCase() === "yes";

  // Safety fallback for serious warning language.
  const warningTerms = [
    "contraindication",
    "doctor review required",
    "consult a doctor",
    "authorized doctor",
    "radiotherapy",
    "chemotherapy",
    "cancer",
    "immunocompromised",
    "severe allergy",
    "anaphylaxis",
    "seizure",
    "convulsion"
  ];

  return warningTerms.some((term) => clean.includes(term));
}

function extractNumberedSections(text, wantedNumbers) {
  const clean = normalizeAiText(text);
  if (!clean) return "";

  const lines = clean.split("\n");
  const sections = [];
  let current = null;

  for (const line of lines) {
    const match = line.match(/^\s*(\d+)\.\s*(.*)$/);
    if (match) {
      if (current) sections.push(current);
      current = {
        number: Number(match[1]),
        content: [line.trim()]
      };
    } else if (current) {
      current.content.push(line);
    }
  }

  if (current) sections.push(current);

  const selected = sections
    .filter((section) => wantedNumbers.includes(section.number))
    .map((section) => section.content.join("\n").trim())
    .filter(Boolean);

  return selected.length ? selected.join("\n\n") : clean;
}

function makeAiReviewDisplayText(text) {
  return extractNumberedSections(text, [1, 2, 3, 4]);
}

function makeVaccinationAlertDisplayText(text) {
  const selected = extractNumberedSections(text, [5, 6]);
  return selected || normalizeAiText(text);
}


function renderAiResult(resultEl, data) {
  const { risk, model, text, dueSummary } = data;
  const displayText = makeAiReviewDisplayText(text);
  const aiSaysReviewRequired = getDoctorReviewFromAiText(text);
  const doctorReviewRequired = Boolean(risk.doctor_review_required || aiSaysReviewRequired);
  const chipClass = risk.risk_level === "High" ? "chip danger" : risk.risk_level === "Medium" ? "chip warn" : "chip";
  const warningClass = dueSummary.missed > 0 || doctorReviewRequired ? "notice warn" : "notice";
  resultEl.innerHTML = `
    <div class="ai-box ${warningClass}">
      <h3 class="result-title">AI review completed</h3>
      <div class="result-meta">
        <span class="${chipClass}">Risk: ${escapeHtml(risk.risk_level)} (${risk.risk_score})</span>
        <span class="chip ${doctorReviewRequired ? 'warn' : ''}">Doctor review: ${doctorReviewRequired ? 'Required' : 'Not required'}</span>
        <span class="chip ${dueSummary.missed ? 'danger' : dueSummary.dueSoon ? 'warn' : ''}">Missed: ${dueSummary.missed} | Due/due soon: ${dueSummary.dueSoon}</span>
      </div>
      <p><strong>Medical compatibility check:</strong> AI compares patient records, prescribed medicines/treatment notes, and vaccination records to flag possible vaccine variant, timing, or medicine-vaccine review needs. It does not make the final medical decision.</p>
      ${renderMessageLines(displayText)}
    </div>`;
}

function renderReminderResult(resultEl, data) {
  const urgencyClass = data.dueSummary.missed > 0 ? "danger" : data.dueSummary.dueSoon > 0 ? "warn" : "";
  const displayText = makeVaccinationAlertDisplayText(data.text);
  resultEl.innerHTML = `
    <div class="sms-box">
      <h3 class="result-title">Vaccination alert generated</h3>
      <div class="result-meta">
        <span class="chip ${urgencyClass}">Missed: ${data.dueSummary.missed} | Due/due soon: ${data.dueSummary.dueSoon}</span>
      </div>
      ${renderMessageLines(displayText)}
    </div>`;
}

function rowsToTable(title, rows) {
  if (!rows.length) return `<h3>${escapeHtml(title)}</h3><p>No records found.</p>`;
  const cleaned = rows.map((row) => {
    const out = {};
    Object.entries(row).forEach(([k, v]) => out[k] = normalizeTimestamp(v));
    return out;
  });
  const keys = Object.keys(cleaned[0]);
  return `
    <h3>${escapeHtml(title)}</h3>
    <table>
      <thead><tr>${keys.map((k) => `<th>${escapeHtml(k)}</th>`).join("")}</tr></thead>
      <tbody>${cleaned.map((row) => `<tr>${keys.map((k) => `<td>${escapeHtml(row[k])}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>`;
}

$("registerChildBtn")?.addEventListener("click", async () => {
  try {
    const childId = makeChildId();
    const payload = {
      child_id: childId,
      child_name: $("childName").value.trim(),
      birth_certificate_no: $("birthCertificateNo").value.trim() || await getNextBirthCertificateNo(),
      dob: $("dob").value,
      parent_name: $("parentName").value.trim(),
      parent_phone: $("parentPhone").value.trim(),
      preferred_clinic: $("preferredClinic").value.trim(),
      area: $("area").value.trim(),
      region: $("regionSelect").value,
      opted_in_vaccination: $("optedInVaccination").value === "yes",
      status: "alive",
      qr_payload: makeProfileUrl(childId),
      profile_url: makeProfileUrl(childId),
      qr_png_url: makeQrUrl(childId),
      source: "birth_registration_web_app",
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    };
    if (!payload.child_name || !payload.birth_certificate_no) throw new Error("Please enter child name and birth certificate number.");
    await setDoc(doc(db, "children", childId), payload);
    copyChildIdToOtherFields(childId);
    renderRegisterResult($("registerResult"), payload);
    setTimeout(() => window.dispatchEvent(new Event("vaxidGenerateBirthNo")), 300);
    updateBirthCertificatePlaceholder();
  } catch (error) {
    $("registerResult").innerHTML = `<div class="notice danger"><strong>Error:</strong> ${escapeHtml(error.message)}</div>`;
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
    const note = navigator.onLine ? "Saved online." : "Saved locally and will sync automatically when the device is online.";
    renderSimpleSuccess($("vaccinationResult"), "Vaccination update saved", [
      ["Record ID", ref.id], ["Child ID", childId], ["Vaccine", payload.vaccine_name], ["Status", payload.status], ["Due date", payload.due_date]
    ], note);
  } catch (error) {
    $("vaccinationResult").innerHTML = `<div class="notice danger"><strong>Error:</strong> ${escapeHtml(error.message)}</div>`;
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
    const ref = await addDoc(collection(db, "patient_records"), payload);
    const note = navigator.onLine ? "Patient record saved online." : "Patient record stored locally and will sync automatically later.";
    renderSimpleSuccess($("healthResult"), "Patient record saved", [
      ["Record ID", ref.id], ["Child ID", childId], ["Hospital / clinic", payload.hospital_name], ["Visit date", payload.visit_date], ["Condition", payload.diagnosis]
    ], note);
  } catch (error) {
    $("healthResult").innerHTML = `<div class="notice danger"><strong>Error:</strong> ${escapeHtml(error.message)}</div>`;
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
    const patientRecords = await getPatientRecords(childId);
    const risk = calculateRisk(vaccinations, patientRecords);
    const dueSummary = getDueSummary(vaccinations);
    const ai = await callGroqBackend("review", {
      task: "Review vaccination history and past patient records. Only check whether any past medical condition suggests doctor review for a different vaccine variant, special precautions, or timing adjustment. Do not choose the vaccine variant yourself. Also mention any missed or due-soon vaccination warnings.",
      child: { child_id: childId, ...child },
      vaccinations,
      healthRecords: patientRecords,
      risk
    });
    await addDoc(collection(db, "ai_messages"), {
      child_id: childId,
      message: ai.text,
      risk,
      mode: "groq_ai_review",
      model: ai.model,
      created_at: serverTimestamp()
    });
    renderAiResult($("aiResult"), { risk, model: ai.model, text: ai.text, dueSummary });
  } catch (error) {
    $("aiResult").innerHTML = `<div class="notice danger"><strong>Error:</strong> ${escapeHtml(error.message)}</div>`;
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
    const patientRecords = await getPatientRecords(childId);
    const risk = calculateRisk(vaccinations, patientRecords);
    const dueSummary = getDueSummary(vaccinations);
    const reminder = await callGroqBackend("reminder", {
      task: "VACCINATION ALERT SMS ONLY. Return only one clean parent-facing SMS message. Do not use numbering, section headings, quotes, bullets, markdown, clinic action, AI review, or hospital warning headings. Mention the child name, missed vaccine or due vaccine if any, due date if available, and preferred clinic or hospital. If patient records suggest doctor review, briefly say to consult the doctor before vaccination. Keep it under 320 characters. Do not diagnose or prescribe.",
      child: { child_id: childId, ...child },
      vaccinations,
      healthRecords: patientRecords,
      risk
    });
    await addDoc(collection(db, "reminders"), {
      child_id: childId,
      reminder_type: "Groq SMS/text draft",
      message: reminder.text,
      status: "generated_by_groq",
      model: reminder.model,
      created_at: serverTimestamp()
    });
    renderReminderResult($("reminderResult"), { model: reminder.model, text: reminder.text, dueSummary });
  } catch (error) {
    $("reminderResult").innerHTML = `<div class="notice danger"><strong>Error:</strong> ${escapeHtml(error.message)}</div>`;
  }
});

$("loadProfileBtn")?.addEventListener("click", async () => {
  try {
    const childId = $("profileChildId").value.trim();
    if (!childId) throw new Error("Child ID is required.");
    const childSnap = await getDoc(doc(db, "children", childId));
    if (!childSnap.exists()) {
      $("profileResult").innerHTML = `<div class="notice warn">Child not found.</div>`;
      return;
    }
    const child = childSnap.data();
    const vaccinations = await getRecords("vaccination_records", childId);
    const patientRecords = await getPatientRecords(childId);
    const reminders = await getRecords("reminders", childId);
    const messages = await getRecords("ai_messages", childId);
    const risk = calculateRisk(vaccinations, patientRecords);
    const dueSummary = getDueSummary(vaccinations);
    $("profileResult").innerHTML = `
      <div class="notice">
        <h3 class="result-title">Child profile overview</h3>
        <div class="result-meta">
          <span class="chip">Risk: ${escapeHtml(risk.risk_level)} (${risk.risk_score})</span>
          <span class="chip ${dueSummary.missed ? 'danger' : dueSummary.dueSoon ? 'warn' : ''}">Missed: ${dueSummary.missed} | Due/due soon: ${dueSummary.dueSoon}</span>
        </div>
        <div class="qr-card">
          <div>
            <img class="qr" src="${escapeHtml(makeQrUrl(childId))}" alt="QR" />
            <p class="small-note"><a class="action-link" href="${escapeHtml(makeProfileUrl(childId))}" target="_blank" rel="noopener">Open scan profile page</a></p>
          </div>
          <div class="kv">
            <div>Child name</div><div>${escapeHtml(child.child_name)}</div>
            <div>Birth certificate</div><div>${escapeHtml(child.birth_certificate_no)}</div>
            <div>Parent/guardian</div><div>${escapeHtml(child.parent_name || "")}</div>
            <div>Phone</div><div>${escapeHtml(child.parent_phone || "")}</div>
            <div>Region</div><div>${escapeHtml(child.region || "")}</div>
            <div>Preferred venue</div><div>${escapeHtml(child.preferred_clinic || "")}</div>
          </div>
        </div>
      </div>
      ${rowsToTable("Vaccination records", vaccinations)}
      ${rowsToTable("Patient records", patientRecords)}
      ${rowsToTable("Reminder records", reminders)}
      ${rowsToTable("AI review records", messages)}
    `;
  } catch (error) {
    $("profileResult").innerHTML = `<div class="notice danger"><strong>Error:</strong> ${escapeHtml(error.message)}</div>`;
  }
});

setDefaults();
setConnectionStatus();
fillFacilityList("regionSelect", "facilityList");
fillFacilityList("hospitalRegionSelect", "hospitalFacilityList");
fillVaccineList();
fillAreaList();
$("regionSelect")?.addEventListener("change", () => fillFacilityList("regionSelect", "facilityList"));
$("hospitalRegionSelect")?.addEventListener("change", () => fillFacilityList("hospitalRegionSelect", "hospitalFacilityList"));
window.addEventListener("online", setConnectionStatus);
window.addEventListener("offline", setConnectionStatus);
