// services/llmService.js
const axios = require("axios");
const logService = require('./logService');

class LLMService {
  constructor() {
    this.provider = process.env.LLM_PROVIDER || "openai";
    this.timeout = parseInt(process.env.LLM_TIMEOUT || "30000", 10);
    
    // Provider-spezifische Konfiguration
    this.config = {
      openai: {
        apiUrl: "https://api.openai.com/v1/chat/completions",
        apiKey: process.env.OPENAI_API_KEY,
        defaultModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
      },
      mistral: {
        apiUrl: "https://api.mistral.ai/v1/chat/completions",
        apiKey: process.env.MISTRAL_API_KEY,
        defaultModel: process.env.MISTRAL_MODEL || "mistral-small-latest",
      },
      // Hier kannst du weitere Provider hinzufügen
    };
  }

  /**
   * Generiert eine Completion mit System- und User-Rollen für verbesserte Sicherheit
   * @param {Object} messages Object mit system und user properties für die unterschiedlichen Nachrichten
   * @param {Object} options Optionale Konfigurationsparameter
   * @returns {Promise<string>} Der generierte Text
   */
  async generateCompletion(messages, options = {}) {
    const providerConfig = this.config[this.provider];
    
    if (!providerConfig) {
      throw new Error(`KI-Provider "${this.provider}" nicht konfiguriert`);
    }
    
    if (!providerConfig.apiKey) {
      throw new Error(`API-Key für Provider "${this.provider}" fehlt`);
    }
    
    const actualModel = options.model || providerConfig.defaultModel;
    const maxTokens = options.maxTokens || parseInt(process.env.LLM_MAX_TOKENS || "1200", 10);
    const temperature = options.temperature || parseFloat(process.env.LLM_TEMPERATURE || "0.7");
    
    // Validiere, dass messages ein Objekt mit system und/oder user ist
    if (!messages || typeof messages !== 'object') {
      throw new Error("messages muss ein Objekt mit mindestens einer 'system' oder 'user' Eigenschaft sein");
    }
    
    // Erstelle das Nachrichten-Array für die API
    const messageArray = [];
    
    // System-Nachricht hinzufügen, falls vorhanden
    if (messages.system && messages.system.trim()) {
      messageArray.push({
        role: "system",
        content: messages.system.trim()
      });
    }
    
    // User-Nachricht hinzufügen, falls vorhanden
    if (messages.user && messages.user.trim()) {
      messageArray.push({
        role: "user",
        content: messages.user.trim()
      });
    }
    
    // Sicherheitsvalidierung: Mindestens eine Nachricht muss vorhanden sein
    if (messageArray.length === 0) {
      throw new Error("Mindestens eine System- oder User-Nachricht muss vorhanden sein");
    }
    
    // Grundlegende Anfrage-Informationen loggen
    logService.debug(`LLM-Anfrage wird vorbereitet`, { 
        provider: this.provider, 
        model: actualModel, 
        maxTokens, 
        temperature,
        messageCount: messageArray.length,
        systemMsgLength: messages.system ? messages.system.length : 0,
        userMsgLength: messages.user ? messages.user.length : 0,
        hasSystemMsg: !!(messages.system && messages.system.trim()),
        hasUserMsg: !!(messages.user && messages.user.trim()),
        timestamp: new Date().toISOString()
    });
    
    // Sicherheits-Logging: Warnung bei verdächtig langen User-Messages
    if (messages.user && messages.user.length > 2000) {
      logService.warn("Sehr lange User-Message erkannt", {
        userMsgLength: messages.user.length,
        potentialSecurityRisk: "Possible prompt injection attempt"
      });
    }
    
    // Vollständigen System-Prompt und User-Prompt als DEBUG-Level loggen
    if (messages.system) {
      logService.debug(`System-Prompt (Länge: ${messages.system.length}):`, messages.system);
    }
    if (messages.user) {
      logService.debug(`User-Prompt (Länge: ${messages.user.length}):`, messages.user);
    }
    
    const requestData = {
        model: actualModel,
        messages: messageArray,
        max_tokens: maxTokens,
        temperature: temperature,
    };
    
    try {
      const startTime = Date.now();
      const response = await axios.post(
        providerConfig.apiUrl,
        requestData,
        {
          headers: {
            Authorization: `Bearer ${providerConfig.apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: this.timeout
        }
      );
      
      // Extrahiere den generierten Text aus der Antwort
      let generatedText;
      let tokenUsage = {};
      
      if (this.provider === "openai") {
        generatedText = response.data.choices?.[0]?.message?.content;
        // Token-Nutzung extrahieren, falls verfügbar
        tokenUsage = response.data.usage || {};
      } else if (this.provider === "mistral") {
        generatedText = response.data.choices?.[0]?.message?.content;
        // Token-Nutzung extrahieren, falls verfügbar
        tokenUsage = response.data.usage || {};
      }
      
      if (!generatedText) {
        throw new Error("Kein Text in der KI-Antwort gefunden");
      }
  
      const responseTime = Date.now() - startTime;
      
      logService.info(`KI-Anfrage erfolgreich mit ${this.provider}`, { 
        provider: this.provider, 
        model: actualModel,
        responseLength: generatedText.length,
        responseTime: `${responseTime}ms`,
        // Token-Nutzung loggen
        tokenUsage: {
          promptTokens: tokenUsage.prompt_tokens || 0,
          completionTokens: tokenUsage.completion_tokens || 0,
          totalTokens: tokenUsage.total_tokens || 0
        },
        securityStatus: "input-validated",
        timestamp: new Date().toISOString()
      });
      
      return generatedText;
    } catch (error) {
      const statusCode = error.response?.status;
      const responseData = error.response?.data;
      
      logService.error(`${this.provider} API Fehler:`, {
        statusCode,
        message: error.message,
        responseData,
        provider: this.provider,
        model: actualModel,
        timestamp: new Date().toISOString()
      });
      
      throw error;      
    }
  }

  // Hilfsmethode: Gibt die aktuelle Provider-Konfiguration zurück
  getCurrentProviderInfo() {
    const providerConfig = this.config[this.provider];
    if (!providerConfig) {
      return {
        provider: this.provider,
        status: 'nicht konfiguriert'
      };
    }

    return {
      provider: this.provider,
      model: providerConfig.defaultModel,
      configured: !!providerConfig.apiKey
    };
  }
}

module.exports = new LLMService();