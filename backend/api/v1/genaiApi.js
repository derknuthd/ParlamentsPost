const express = require("express");
const axios = require("axios");
const router = express.Router();
const rateLimit = require("express-rate-limit");

// Logging-Funktion (wie in den anderen APIs)
const LOG_LEVEL = process.env.LOG_LEVEL || "INFO";
const logLevels = ["DEBUG", "INFO", "WARN", "ERROR"];
function log(level, message, data = null) {
  if (logLevels.indexOf(level) >= logLevels.indexOf(LOG_LEVEL)) {
    const logMessage = `[${level}] ${message}`;
    if (data) {
      console.log(logMessage, data);
    } else {
      console.log(logMessage);
    }
  }
}

// Rate-Limiter für KI-Anfragen
const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS || "60", 10) * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || "10", 10),
  message: "Too many requests. Bitte später erneut versuchen."
});

// POST /genai-brief
router.post("/genai-brief", rateLimiter, async (req, res) => {
  try {
    log("DEBUG", "Request Body:", req.body);

    const { userData } = req.body;
    log("INFO", "Anfrage erhalten: POST /genai-brief", userData);

    if (!userData) {
      return res.status(400).json({ error: "userData fehlt." });
    }

    const model = process.env.OPENAI_MODEL;
    const maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS || "1200", 10);

    // Basis-Prompt aus dem Topic verwenden, falls vorhanden
    let basePrompt = "Du bist eine Hilfs-KI, die einen formalen Brief an einen Abgeordneten schreiben soll.";
    if (userData.topic && userData.topic.basePrompt) {
      basePrompt = userData.topic.basePrompt;
    }
    
    // Prompt-Blöcke der ausgewählten Subtopics sammeln
    let promptDetails = "";
    if (userData.selectedSubtopics && userData.selectedSubtopics.length > 0) {
      promptDetails = "Beachte folgende spezifische Anliegen:\n" + 
        userData.selectedSubtopics
          .map(subtopic => subtopic.promptBlock)
          .join("\n\n");
    }
    
    // Subtopic-Namen für die Themenübersicht sammeln
    let themenÜbersicht = "Keine spezifischen Themen angegeben.";
    if (userData.selectedSubtopics && userData.selectedSubtopics.length > 0) {
      themenÜbersicht = userData.selectedSubtopics
        .map(subtopic => subtopic.name)
        .join(", ");
    }

    const prompt = `
${basePrompt}

Erstelle nur den reinen Brieftext, also den Hauptinhalt des Schreibens.
Verwende dabei keine Formatierungsbefehle als Markdown, HTML oder ähnliches. 
Folgende Informationen sind bereits im Rahmen des Briefes enthalten und müssen von dir NICHT generiert werden:
- Absender
- Ort und Datum
- Empfängerinformationen
- Anrede (z. B. "Sehr geehrte/r Frau/Herr [Nachname]")
- Grußformel (z. B. "Mit freundlichen Grüßen")
- Unterschrift
- Name unter der Unterschrift

Das Rahmendokument enthält bereits die Anrede und die Grußformel. Dein Beitrag beginnt nach der Anrede und endet vor der Grußformel.

Informationen zu den Themen:
${themenÜbersicht}

${promptDetails}

Freitext vom Nutzer:
${userData.freitext || "Kein zusätzlicher Freitext angegeben."}

Der Brief richtet sich an: ${userData.abgeordneteName || "einen Abgeordneten"} (${userData.abgeordnetePartei || "Partei unbekannt"})

Formuliere den Hauptinhalt des Briefes auf Basis dieser Informationen. Nutze dabei einen höflichen und respektvollen Ton, der sich für ein formales Schreiben eignet. Schreibe sachlich, prägnant und ohne Wiederholungen.
    `;

    log("DEBUG", "Vollständiger Prompt:", prompt);
    
    const openaiRequestData = {
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.7,
    };
    
    log("DEBUG", "OpenAI Request:", JSON.stringify(openaiRequestData, null, 2));  

    const openaiResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      openaiRequestData,
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const generatedText =
      openaiResponse.data.choices?.[0]?.message?.content ||
      "(Konnte keinen Text generieren)";
    log("INFO", "KI-Text generiert.");

    return res.json({ briefText: generatedText });
  } catch (error) {
    log("ERROR", "Fehler bei POST /genai-brief:", error);
    res.status(500).json({ error: "Interner Serverfehler bei KI-Abfrage" });
  }
});

module.exports = router;