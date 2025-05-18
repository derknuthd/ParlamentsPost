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
        defaultModel: process.env.OPENAI_MODEL || "gpt-4.1-nano",
      },
      mistral: {
        apiUrl: "https://api.mistral.ai/v1/chat/completions",
        apiKey: process.env.MISTRAL_API_KEY,
        defaultModel: process.env.MISTRAL_MODEL || "ministral-3b-latest",
      },
      // Hier kannst du weitere Provider hinzufügen
    };
  }

  async generateCompletion(prompt, options = {}) {
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
    
    // Grundlegende Anfrage-Informationen loggen
    logService.debug(`LLM-Anfrage wird vorbereitet`, { 
        provider: this.provider, 
        model: actualModel, 
        maxTokens, 
        temperature,
        promptLength: prompt.length,
        timestamp: new Date().toISOString()
    });
    
    // Vollständigen Prompt als DEBUG-Level loggen
    logService.debug(`Vollständiger Prompt:`, prompt);
    
    const requestData = {
        model: actualModel,
        messages: [{ role: "user", content: prompt }],
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
      
      if (this.provider === "openai") {
        generatedText = response.data.choices?.[0]?.message?.content;
      } else if (this.provider === "mistral") {
        generatedText = response.data.choices?.[0]?.message?.content;
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
        estimatedTokens: Math.round(generatedText.length / 4),
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