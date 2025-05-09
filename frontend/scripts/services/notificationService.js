import eventBus from './eventBus.js';

export const notificationService = {
    // Notifications-Array (wird im Alpine.js-Datenmodell verwendet)
    notifications: [],
    
    // Benachrichtigung anzeigen
    showNotification(message, type = 'info', duration = 5000) {
      const id = Date.now();
      const notification = { id, message, type, duration };
      
      this.notifications.push(notification);
      
      // Event über den EventBus senden
      eventBus.publish('notification', { action: 'add', notification });
      
      // Automatisch nach der angegebenen Dauer entfernen
      setTimeout(() => {
        this.removeNotification(id);
      }, duration);
      
      return id;
    },
    
    // Benachrichtigung entfernen
    removeNotification(id) {
      this.notifications = this.notifications.filter(n => n.id !== id);
      
      // Event über den EventBus senden
      eventBus.publish('notification', { action: 'remove', id });
    }
};