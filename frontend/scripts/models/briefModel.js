export const briefModel = {
    createEmptyBrief() {
      return {
        id: null,
        zeitstempel: null,
        titel: "",
        absender: {
          name: "",
          strasse: "",
          plz: "",
          ort: "",
          email: ""
        },
        empfaenger: {
          id: "",
          abgeordneter: null
        },
        themen: {
          topic: "",
          ausgewaehlteThemen: [],
          freitext: ""
        },
        briefInhalt: {
          absenderText: "",
          empfaengerText: "",
          ortDatumText: "",
          betreffText: "",
          briefText: ""
        },
        formatierung: {
          schriftart: "Arial, sans-serif",
          schriftgroesse: "mittel"
        }
      };
    }
};