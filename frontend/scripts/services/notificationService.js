export const notificationService = {
    // Notifications-Array (wird im Alpine.js-Datenmodell verwendet)
    notifications: [],
    
    // Benachrichtigung anzeigen
    showNotification(message, type = 'info', duration = 5000) {
      const id = Date.now();
      
      this.notifications.push({ id, message, type, duration });
      
      // Automatisch nach der angegebenen Dauer entfernen
      setTimeout(() => {
        this.removeNotification(id);
      }, duration);
      
      return id;
    },
    
    // Benachrichtigung entfernen
    removeNotification(id) {
      this.notifications = this.notifications.filter(n => n.id !== id);
    }
  };