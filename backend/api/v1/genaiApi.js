// genaiApi.js
const express = require("express");
const axios = require("axios");
const router = express.Router();

// Import Service-Module
const logService = require('../../services/logService');

// POST /genai-brief - Hier kein Rate-Limiter mehr, da er in server.js definiert ist
router.post("/genai-brief", async (req, res) => {
  try {
    logService.debug("Request Body:", req.body);

    const { userData } = req.body;
    
    if (!userData) {
      logService.warn("Ungültige Anfrage: userData fehlt");
      return res.status(400).json({ 
        error: "Ungültige Anfrage", 
        message: "userData fehlt." 
      });
    }
    
    logService.info("Anfrage erhalten: POST /genai-brief", userData);

    // Validierung der Freitextlänge
    const MAX_FREITEXT_LENGTH = parseInt(process.env.MAX_FREITEXT_LENGTH || "1000", 10);
    if (userData.freitext && userData.freitext.length > MAX_FREITEXT_LENGTH) {
      logService.warn("Freitext zu lang", { 
        length: userData.freitext.length, 
        max: MAX_FREITEXT_LENGTH 
      });
      return res.status(400).json({ 
        error: "Eingabefehler", 
        message: `Text zu lang (max. ${MAX_FREITEXT_LENGTH} Zeichen).` 
      });
    }

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS || "1200", 10);

    // Basis-Prompt aus dem Topic verwenden, falls vorhanden
    let basePrompt = "Du bist eine Hilfs-KI, die einen formalen Brief an einen Abgeordneten schreiben soll.";
    if (userData.topic && userData.topic.basePrompt) {
      basePrompt = userData.topic.basePrompt;
    }
    
    // Prompt-Blöcke der ausgewählten Subtopics sammeln
    let selectedArguments = "";
    if (userData.selectedSubtopics && userData.selectedSubtopics.length > 0) {
      selectedArguments =  
        userData.selectedSubtopics
          .map(subtopic => subtopic.promptBlock)
          .join("\n\n");
    }
    
    // // Subtopic-Namen für die Themenübersicht sammeln
    // let themenÜbersicht = "Keine spezifischen Themen angegeben.";
    // if (userData.selectedSubtopics && userData.selectedSubtopics.length > 0) {
    //   themenÜbersicht = userData.selectedSubtopics
    //     .map(subtopic => subtopic.name)
    //     .join(", ");
    // }

    // Conclusion-Prompt verwenden, falls vorhanden
    let conclusionPromptText = "";
    if (userData.topic && userData.topic.conclusionPrompt) {
      conclusionPromptText = 
        userData.topic.conclusionPrompt;
    }

    const prompt = `
${basePrompt}

Der Brief richtet sich an:
${userData.abgeordneteName || "einen Abgeordneten"} (${userData.abgeordnetePartei || "Partei unbekannt"})

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

Nutze dabei folgende Argumente:
${selectedArguments}

Und folgendes Argument, dass der User selbst eingeben hat:
${userData.freitext || "Kein zusätzliches Argument angegeben."}
Lege dabei besonderen Wert auf die Themen, die der User angegeben hat.

Für den Abschluss des Briefes:
${conclusionPromptText}

Formuliere den Hauptinhalt des Briefes auf Basis dieser Informationen. Nutze dabei einen höflichen und respektvollen Ton, der sich für ein formales Schreiben eignet. Schreibe sachlich, prägnant und ohne Wiederholungen.

Achte bitte abschließend noch einmal darauf, dass der von dir generierte Text KEINE Grußformel, KEINE Unterschrift und KEINEN Namen unter der Unterschrift enthält. Diese Informationen sind bereits im Rahmen des Briefes enthalten und müssen von dir NICHT generiert werden.
`;

    logService.debug("Vollständiger Prompt:", prompt);
    
    const openaiRequestData = {
      model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.7,
    };
    
    logService.debug("OpenAI Request:", JSON.stringify(openaiRequestData, null, 2));  

    try {
      const openaiResponse = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        openaiRequestData,
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 30000 // 30 Sekunden Timeout
        }
      );

      const generatedText =
        openaiResponse.data.choices?.[0]?.message?.content ||
        "(Konnte keinen Text generieren)";
      logService.info("KI-Text erfolgreich generiert");

      return res.json({ briefText: generatedText });
    } catch (openaiError) {
      // Spezifische Fehlerbehandlung für OpenAI API
      logService.error("Fehler bei OpenAI API-Anfrage", openaiError);
      
      if (openaiError.response) {
        // Der Server hat geantwortet mit einem Fehlercode
        const statusCode = openaiError.response.status;
        const errorData = openaiError.response.data;
        
        if (statusCode === 401) {
          return res.status(500).json({ 
            error: "Authentifizierungsfehler",
            message: "Authentifizierungsfehler bei der KI-Anfrage. Bitte kontaktieren Sie den Administrator." 
          });
        } else if (statusCode === 429) {
          return res.status(429).json({ 
            error: "Ratenlimit überschritten",
            message: "Das Anfragelimit der KI wurde überschritten. Bitte versuchen Sie es später erneut." 
          });
        } else if (statusCode === 400) {
          return res.status(400).json({ 
            error: "Ungültige Anfrage",
            message: "Ungültige Anfrage an die KI. Möglicherweise ist Ihr Text zu lang oder enthält unzulässige Inhalte." 
          });
        } else {
          return res.status(500).json({ 
            error: "KI-Dienst-Fehler",
            message: `Fehler bei der KI-Anfrage: ${errorData.error?.message || 'Unbekannter Fehler'}` 
          });
        }
      } else if (openaiError.request) {
        // Die Anfrage wurde gestellt, aber keine Antwort erhalten
        if (openaiError.code === 'ECONNABORTED') {
          return res.status(504).json({ 
            error: "Zeitüberschreitung",
            message: "Zeitüberschreitung bei der KI-Anfrage. Bitte versuchen Sie es später erneut." 
          });
        } else {
          return res.status(503).json({ 
            error: "Dienst nicht verfügbar",
            message: "Der KI-Dienst ist derzeit nicht erreichbar. Bitte versuchen Sie es später erneut." 
          });
        }
      } else {
        // Etwas ist bei der Einrichtung der Anfrage schiefgegangen
        return res.status(500).json({ 
          error: "Interner Fehler",
          message: "Fehler bei der Verarbeitung der KI-Anfrage: " + openaiError.message 
        });
      }
    }
  } catch (error) {
    logService.error("Allgemeiner Fehler bei POST /genai-brief:", error);
    res.status(500).json({ 
      error: "Interner Fehler", 
      message: "Interner Serverfehler bei der Brief-Generierung." 
    });
  }
});

module.exports = router;