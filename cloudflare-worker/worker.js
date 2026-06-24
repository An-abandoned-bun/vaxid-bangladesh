export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === "GET") {
      return json({
        ok: true,
        service: "VaxID Groq AI Worker",
        message: "Worker is running. Send POST requests from the VaxID app."
      }, 200, corsHeaders);
    }

    if (request.method !== "POST") {
      return json({ ok: false, error: "Use POST only." }, 405, corsHeaders);
    }

    try {
      const body = await request.json();

      const task = body.task || "Review the VaxID child vaccination and patient record safely.";
      const child = body.child || {};
      const vaccinations = body.vaccinations || [];
      const patientRecords = body.patientRecords || body.healthRecords || [];
      const dueSummary = body.dueSummary || {};
      const risk = body.risk || {};

      const model = env.GROQ_MODEL || "llama-3.1-8b-instant";

      const systemPrompt = `
You are the VaxID Bangladesh healthcare support assistant.

Safety rules:
- Do not diagnose.
- Do not prescribe medicine.
- Do not choose vaccine dose.
- Do not replace doctors.
- Do not claim certainty about medicine-vaccine incompatibility.
- Only flag possible risks for authorized doctor or vaccination clinic review.
- Keep the answer practical, short, and safe.
`;

      const userPrompt = `
Task:
${task}

Child profile:
${JSON.stringify(child, null, 2)}

Vaccination records:
${JSON.stringify(vaccinations, null, 2)}

Patient records and medicines:
${JSON.stringify(patientRecords, null, 2)}

Due summary:
${JSON.stringify(dueSummary, null, 2)}

Local ML risk:
${JSON.stringify(risk, null, 2)}
`;

      const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.GROQ_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.2,
          max_tokens: 650
        })
      });

      const groqJson = await groqResponse.json();

      if (!groqResponse.ok) {
        return json({
          ok: false,
          success: false,
          provider: "groq",
          error: groqJson?.error?.message || "Groq API request failed.",
          details: groqJson
        }, groqResponse.status, corsHeaders);
      }

      const text = groqJson?.choices?.[0]?.message?.content || "";

      return json({
        ok: true,
        success: true,
        provider: "groq",
        model,
        model_used: model,
        text,
        ai_response: text
      }, 200, corsHeaders);

    } catch (error) {
      return json({
        ok: false,
        success: false,
        error: error.message || "Worker error"
      }, 500, corsHeaders);
    }
  }
};

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json"
    }
  });
}
