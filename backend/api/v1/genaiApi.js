// genaiApi.js
const express = require("express");
const router = express.Router();
const llmService = require('../../services/llmService');
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

    // NEUE VALIDIERUNG: Beschränkung der Anzahl der Argumente
    const MAX_SUBTOPICS = parseInt(process.env.MAX_SUBTOPICS || "3", 10);
    if (userData.selectedSubtopics && userData.selectedSubtopics.length > MAX_SUBTOPICS) {
      logService.warn("Zu viele Argumente ausgewählt", { 
        selected: userData.selectedSubtopics.length, 
        max: MAX_SUBTOPICS 
      });
      return res.status(400).json({ 
        error: "Zu viele Argumente", 
        message: `Bitte wählen Sie maximal ${MAX_SUBTOPICS} Argumente aus für ein optimales Ergebnis.` 
      });
    }

    // Basis-Prompt aus dem Topic verwenden, falls vorhanden
    let basePrompt = "Du bist eine Hilfs-KI, die einen formalen Brief an einen Abgeordneten schreiben soll.";
    if (userData.topic && userData.topic.basePrompt) {
      basePrompt = userData.topic.basePrompt;
    }
    
    // Basis-Prompt aus dem Topic verwenden - enthält NUR das konkrete Thema
    let themaPrompt = "Formuliere einen formellen Brief zu einem wichtigen Anliegen.";
    if (userData.topic && userData.topic.basePrompt) {
      themaPrompt = userData.topic.basePrompt;
    }

    // Anzahl der ausgewählten Argumente ermitteln
    const anzahlArgumente = userData.selectedSubtopics?.length || 0;
    
    // Prüfen, ob ein persönliches Argument (Freitext) vorhanden ist
    const hatPersoenlichesArgument = !!(userData.freitext && userData.freitext.trim());

    // Konfigurierbare Ziel-Gesamtlänge für Briefe (als Richtwert)
    const TARGET_BRIEF_WORDS = parseInt(process.env.TARGET_BRIEF_WORDS || "200", 10);

    // Minimale Wörter pro Abschnitt (absolute Untergrenzen)
    const MIN_WORDS = {
      einleitung: 35,      // ~2 Sätze als Untergrenze
      argument: 60,        // Mindestens 60 Wörter pro Argument
      persoenlich: 80,     // Mindestens 80 Wörter für persönliches Argument
      abschluss: 30        // ~2 Sätze als Untergrenze
    };

    // Maximale Wörter pro Abschnitt (Obergrenzen)
    const MAX_WORDS = {
      einleitung: 50,      // Maximal 60 Wörter für Einleitung
      argument: 120,       // Maximal 120 Wörter pro Argument
      persoenlich: 150,    // Maximal 150 Wörter für persönliches Argument
      abschluss: 45        // Maximal 50 Wörter für Abschluss
    };

    // Ideale Proportionen der Abschnitte (in Prozent)
    // Wenn kein persönliches Argument vorhanden ist, verteilen wir den Anteil auf die anderen Teile
    const PROPORTIONS = {
      einleitung: hatPersoenlichesArgument ? 10 : 12,    // 10-12% für Einleitung
      argumente: hatPersoenlichesArgument ? 60 : 75,     // 60-75% für Argumente
      persoenlich: hatPersoenlichesArgument ? 20 : 0,    // 20% für persönliches Argument
      abschluss: hatPersoenlichesArgument ? 10 : 13      // 10-13% für Abschluss
    };

    // DEBUG: Log zu den verwendeten Proportionen
    logService.debug("Brief-Proportionen:", {
      hatPersoenlichesArgument,
      PROPORTIONS,
      anzahlArgumente,
      TARGET_BRIEF_WORDS
    });

    // Berechne vorläufige Wortanzahl basierend auf Proportionen
    let wordCounts = {
      einleitung: Math.round(TARGET_BRIEF_WORDS * PROPORTIONS.einleitung / 100),
      argumente: Math.round(TARGET_BRIEF_WORDS * PROPORTIONS.argumente / 100),
      persoenlich: hatPersoenlichesArgument ? Math.round(TARGET_BRIEF_WORDS * PROPORTIONS.persoenlich / 100) : 0,
      abschluss: Math.round(TARGET_BRIEF_WORDS * PROPORTIONS.abschluss / 100)
    };

    // DEBUG: Log zu den vorläufigen Wortanzahlen
    logService.debug("Vorläufige Wortanzahlen (vor Min-/Max-Grenzen):", wordCounts);

    // Stelle sicher, dass Mindestlängen eingehalten werden
    wordCounts.einleitung = Math.max(wordCounts.einleitung, MIN_WORDS.einleitung);
    if (hatPersoenlichesArgument) {
      wordCounts.persoenlich = Math.max(wordCounts.persoenlich, MIN_WORDS.persoenlich);
    } else {
      wordCounts.persoenlich = 0; // Sicherstellen, dass persoenlich 0 ist, wenn kein persönliches Argument existiert
    }
    wordCounts.abschluss = Math.max(wordCounts.abschluss, MIN_WORDS.abschluss);

    // Stelle sicher, dass Maximallängen nicht überschritten werden
    wordCounts.einleitung = Math.min(wordCounts.einleitung, MAX_WORDS.einleitung);
    if (hatPersoenlichesArgument) {
      wordCounts.persoenlich = Math.min(wordCounts.persoenlich, MAX_WORDS.persoenlich);
    }
    wordCounts.abschluss = Math.min(wordCounts.abschluss, MAX_WORDS.abschluss);

    // Berechne die verfügbaren Wörter für Argumente nach Anpassung der anderen Abschnitte
    const verfuegbareWorteArgumente = TARGET_BRIEF_WORDS - 
                                     wordCounts.einleitung - 
                                     wordCounts.persoenlich - 
                                     wordCounts.abschluss;
    
    // Falls keine Argumente vorhanden sind, müssen wir auch keine Wörter dafür reservieren
    if (anzahlArgumente === 0) {
      wordCounts.argumente = 0;
    } else {
      // Stelle sicher, dass Mindestlänge für Argumente eingehalten wird
      const minWorteArgumente = anzahlArgumente * MIN_WORDS.argument;
      // Maximal verfügbare Wörter für Argumente
      const maxWorteArgumente = anzahlArgumente * MAX_WORDS.argument;
      
      // Verwende die verfügbaren Wörter, begrenzt durch Min/Max
      wordCounts.argumente = Math.min(
        Math.max(verfuegbareWorteArgumente, minWorteArgumente),
        maxWorteArgumente
      );
    }

    // Berechne Wörter pro Argument mit Ober- und Untergrenze
    const worteProArgument = anzahlArgumente > 0 
      ? Math.min(
          Math.max(
            Math.floor(wordCounts.argumente / anzahlArgumente), 
            MIN_WORDS.argument
          ), 
          MAX_WORDS.argument
        )
      : 0;

    // Aktualisiere die Gesamtanzahl der Wörter für Argumente basierend auf Einzellängen
    const totalArgumentWords = anzahlArgumente * worteProArgument;

    // Berechne die tatsächliche Gesamtlänge mit der korrigierten Argumentwortanzahl
    const actualTotalWords = wordCounts.einleitung + 
                        totalArgumentWords + 
                        wordCounts.persoenlich + 
                        wordCounts.abschluss;

    // DEBUG: Log zu den endgültigen Wortanzahlen
    logService.debug("Endgültige Abschnittslängen:", {
      einleitung: wordCounts.einleitung,
      argumente: totalArgumentWords,
      worteProArgument,
      persoenlich: wordCounts.persoenlich,
      abschluss: wordCounts.abschluss,
      actualTotalWords,
      abweichungVonZiellaenge: actualTotalWords - TARGET_BRIEF_WORDS
    });

    // Prompt-Blöcke der ausgewählten Subtopics sammeln
    let selectedArguments = "";
    if (userData.selectedSubtopics && userData.selectedSubtopics.length > 0) {
      selectedArguments =  
        userData.selectedSubtopics
          .map(subtopic => subtopic.promptBlock)
          .join("\n\n");
    }
    
    // Conclusion-Prompt verwenden, falls vorhanden
    let conclusionPromptText = "";
    if (userData.topic && userData.topic.conclusionPrompt) {
      conclusionPromptText = 
        userData.topic.conclusionPrompt;
    }

    // Allgemeine Stilanweisungen - für ALLE Briefe gleich
    const stilAnweisungen = `
# STIL
- Falle nicht direkt mit der Tür ins Haus, sondern beginne mit einer kurzen Einleitung
- Höflich und respektvoll, aber bestimmt und überzeugend
- Persönlich, prägnant und ohne Wiederholungen
- Schreibe aus Sicht der Person, die den Brief verfasst
- Vermeide Formulierungen, bei denen man das Geschlecht der schreibenden Person wissen muss. Verwende dann Sätze mit "ich"-Formulierungen.
- Kurze, aktive Sätze statt komplizierter Konstruktionen
${hatPersoenlichesArgument ? '- Das persönliche Argument des Nutzers soll im Mittelpunkt stehen' : ''}`;

    // Allgemeine Formatanweisungen - mit tatsächlich berechneter Gesamtlänge
    const formatAnweisungen = `
# STRUKTUR UND FORMAT
- Erstelle NUR den Hauptteil (keine Absenderzeile, Anrede, Grußformel, etc.)
- Der Brief sollte etwa ${actualTotalWords} Wörter lang sein (Richtwert)
- Verwende keine Formatierungsbefehle (kein Markdown/HTML)`;
    // Zusammensetzen des Prompts aus modularen Bausteinen - unter Berücksichtigung des persönlichen Arguments
    const prompt = `
${themaPrompt}
- Schreibe am Anfang nicht "Sehr geehrte/r Frau/Herr [Nachname]" oder ähnliches
- Schreibe am Ende nicht "Mit freundlichen Grüßen, [Ihr Name]" oder ähnliches

Der Brief richtet sich an: ${userData.abgeordneter?.vollerName || "eine Person im Parlament, deren Geschlecht du nicht kennst und deshalb geschlechtsunspezifische Sprache wählst"} (${userData.abgeordneter?.partei || "Partei unbekannt"})

${formatAnweisungen}

# INHALT
- Einleitung (${wordCounts.einleitung}-${wordCounts.einleitung + 10} Wörter)
${anzahlArgumente > 0 ? `- Argumentationsgrundlage (${worteProArgument}-${worteProArgument + 10} Wörter pro Argument):
${selectedArguments}` : ''}

${hatPersoenlichesArgument ? `- Persönliches Argument des Nutzers (besonders hervorheben, ${wordCounts.persoenlich}-${wordCounts.persoenlich + 20} Wörter):
${userData.freitext}` : ''}

- Abschluss (${wordCounts.abschluss}-${wordCounts.abschluss + 10} Wörter):
${conclusionPromptText}

${stilAnweisungen}
Achte abschließend darauf, dass der generierte Text KEINE Anrede (wie "Sehr geehrte/r Frau/Herr [Nachname]"), KEINE Grußformel, KEINE Unterschrift und KEINEN Namen unter der Unterschrift enthält. Diese Informationen sind bereits im Rahmen des Briefes enthalten und müssen von dir NICHT generiert werden.
Wenn im dem von dir generierten Text folgendes steht "Sehr geehrte/r Frau/Herr [Nachname]" oder ähnliches oder "Mit freundlichen Grüßen, [Ihr Name]" oder ähnliches, dann lösche es. DU WIRST DARAN GEMESSEN, DASS DIESE TEILE NICHT IN DEM TEXT ENTHALTEN SIND.
PÜFE DEN TEXT ABSCHLIESSEND AUF RECHTSCHREIBFEHLER UND GRAMMATIKFEHLER UND KORRIGIERE SIE.
`;

    logService.debug("Prompt-Länge:", prompt.length);
    
    // NEUE VALIDIERUNG: Gesamtlänge des Prompts
    const MAX_PROMPT_LENGTH = parseInt(process.env.MAX_PROMPT_LENGTH || "6000", 10);
    if (prompt.length > MAX_PROMPT_LENGTH) {
      logService.warn("Prompt zu lang", { 
        length: prompt.length, 
        max: MAX_PROMPT_LENGTH 
      });
      return res.status(400).json({ 
        error: "Prompt zu lang", 
        message: "Der generierte Prompt ist zu lang. Bitte reduzieren Sie die Anzahl oder Länge Ihrer Argumente." 
      });
    }

    try {
      const requestStartTime = Date.now();
      logService.debug("KI-Anfrage wird vorbereitet", { 
        provider: llmService.provider,
        model: llmService.config[llmService.provider].defaultModel,
        temperature: parseFloat(process.env.LLM_TEMPERATURE || "0.7")
      });
      
      // LLM-Service anstatt direkter OpenAI-API-Anfrage verwenden
      const generatedText = await llmService.generateCompletion(prompt);
      
      // Berechne ungefähre Wortanzahl des generierten Textes
      const approxWordCount = generatedText.split(/\s+/).length;
      const targetRatio = approxWordCount / actualTotalWords;
      const qualityIndicator = targetRatio >= 0.9 && targetRatio <= 1.2 ? "gut" : "abweichend";
      const requestDuration = Date.now() - requestStartTime;
      
      logService.info("KI-Text erfolgreich generiert", { 
        provider: llmService.provider,
        model: llmService.config[llmService.provider].defaultModel,
        approxWordCount,
        targetWordCount: actualTotalWords,
        difference: approxWordCount - actualTotalWords,
        ratio: targetRatio.toFixed(2),
        quality: qualityIndicator,
        duration: `${requestDuration}ms`
      });

      return res.json({ 
        briefText: generatedText,
        meta: {
          provider: llmService.provider,
          model: llmService.config[llmService.provider].defaultModel,
          wordCount: approxWordCount
        }
      });
    } catch (llmError) {
      logService.error("KI API Fehler:", llmError.response?.data || llmError.message);
      
      // Benutzerfreundliche Fehlermeldung je nach Fehlertyp
      if (llmError.response?.status === 429) {
        return res.status(429).json({
          error: "Überlastung",
          message: "Der Dienst ist momentan überlastet. Bitte versuchen Sie es in einigen Minuten erneut."
        });
      } else if (llmError.code === 'ECONNABORTED') {
        return res.status(504).json({
          error: "Zeitüberschreitung",
          message: "Die Anfrage hat zu lange gedauert. Bitte versuchen Sie es später noch einmal."
        });
      } else {
        return res.status(500).json({
          error: "KI-Fehler",
          message: "Bei der Generierung des Brieftextes ist ein Fehler aufgetreten."
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