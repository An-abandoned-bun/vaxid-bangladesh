export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return json({ ok: false, error: "Use POST only." }, 405, corsHeaders);
    }

    try {
      if (!env.GEMINI_API_KEY) {
        return json({ ok: false, error: "Missing GEMINI_API_KEY secret in Cloudflare Worker settings." }, 500, corsHeaders);
      }

      const body = await request.json();
      const mode = body.mode || "review";
      const child = body.child || {};
      const vaccinations = Array.isArray(body.vaccinations) ? body.vaccinations : [];
      const healthRecords = Array.isArray(body.healthRecords) ? body.healthRecords : [];
      const risk = body.risk || {};

      const model = env.GEMINI_MODEL || "gemini-2.5-flash-lite";
      const prompt = buildPrompt(mode, child, vaccinations, healthRecords, risk);

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${env.GEMINI_API_KEY}`;

      const geminiResponse = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: mode === "reminder" ? 220 : 650
          }
        })
      });

      const geminiJson = await geminiResponse.json();

      if (!geminiResponse.ok) {
        return json({
          ok: false,
          error: geminiJson?.error?.message || "Gemini API request failed.",
          details: geminiJson
        }, geminiResponse.status, corsHeaders);
      }

      const text = extractText(geminiJson);
      return json({ ok: true, mode, model, text }, 200, corsHeaders);
    } catch (error) {
      return json({ ok: false, error: error.message || String(error) }, 500, corsHeaders);
    }
  }
};

function buildPrompt(mode, child, vaccinations, healthRecords, risk) {
  const safeChild = {
    child_id: child.child_id,
    child_name: child.child_name,
    dob: child.dob,
    area: child.area,
    preferred_clinic: child.preferred_clinic,
    opted_in_vaccination: child.opted_in_vaccination
  };

  const compactVaccinations = vaccinations.slice(0, 20).map((v) => ({
    vaccine_name: v.vaccine_name,
    due_date: v.due_date,
    completed_date: v.completed_date,
    status: v.status
  }));

  const compactHealth = healthRecords.slice(0, 20).map((r) => ({
    hospital_name: r.hospital_name,
    visit_date: r.visit_date,
    diagnosis: r.diagnosis,
    doctor_notes: r.doctor_notes,
    medicine: r.medicine
  }));

  const sharedRules = `
You are VaxID Bangladesh's child vaccination support assistant.
Use ONLY the data provided.
Do NOT diagnose disease.
Do NOT prescribe medicine.
Do NOT decide that a child needs a double dose or a special vaccine.
If diagnosis/health records suggest fever, allergy, severe reaction, immune issues, seizure/convulsion, or uncertainty, say: "Doctor review required for vaccine timing/type/dose."
The final decision must be made by an authorized doctor or vaccination clinic.
Write in simple English suitable for a Bangladeshi parent/clinic worker.
`;

  if (mode === "reminder") {
    return `${sharedRules}
Task: Create ONE short SMS/text reminder under 320 characters.
Include child name if available, next vaccine/due status if available, preferred clinic if available, and a doctor-review warning only if needed.
Do not include JSON.

Child: ${JSON.stringify(safeChild)}
Vaccination records: ${JSON.stringify(compactVaccinations)}
Hospital records: ${JSON.stringify(compactHealth)}
ML risk result: ${JSON.stringify(risk)}
`;
  }

  return `${sharedRules}
Task: Create a safe AI health/vaccine review for the clinic dashboard.
Include these headings:
1. Summary
2. ML missed-vaccine risk
3. Hospital-record safety check
4. Parent/clinic message
5. Action needed
Keep it under 220 words.

Child: ${JSON.stringify(safeChild)}
Vaccination records: ${JSON.stringify(compactVaccinations)}
Hospital records: ${JSON.stringify(compactHealth)}
ML risk result: ${JSON.stringify(risk)}
`;
}

function extractText(geminiJson) {
  const parts = geminiJson?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p.text || "").join("\n").trim();
  return text || "Gemini returned no text.";
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json"
    }
  });
}
