interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  relationship: string;
  priority: number; // 1 = highest priority
  isActive: boolean;
  notificationMethods: ('sms' | 'call' | 'email' | 'push')[];
}

interface EmergencyAlert {
  id: string;
  type: 'sos' | 'safe_zone_violation' | 'offline' | 'low_battery';
  childCode: string;
  childName?: string;
  location?: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
  timestamp: number;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  contactsNotified: string[];
  status: 'pending' | 'acknowledged' | 'resolved';
}

export class EmergencyContactManager {
  private static instance: EmergencyContactManager;
  private contacts: EmergencyContact[] = [];
  private alertHistory: EmergencyAlert[] = [];

  static getInstance(): EmergencyContactManager {
    if (!EmergencyContactManager.instance) {
      EmergencyContactManager.instance = new EmergencyContactManager();
    }
    return EmergencyContactManager.instance;
  }

  constructor() {
    this.loadContacts();
  }

  // Contact Management
  addContact(contact: Omit<EmergencyContact, 'id'>): string {
    const newContact: EmergencyContact = {
      ...contact,
      id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    this.contacts.push(newContact);
    this.saveContacts();
    return newContact.id;
  }

  updateContact(id: string, updates: Partial<EmergencyContact>): boolean {
    const index = this.contacts.findIndex(c => c.id === id);
    if (index === -1) return false;
    
    this.contacts[index] = { ...this.contacts[index], ...updates };
    this.saveContacts();
    return true;
  }

  removeContact(id: string): boolean {
    const index = this.contacts.findIndex(c => c.id === id);
    if (index === -1) return false;
    
    this.contacts.splice(index, 1);
    this.saveContacts();
    return true;
  }

  getContacts(): EmergencyContact[] {
    return [...this.contacts].sort((a, b) => a.priority - b.priority);
  }

  getActiveContacts(): EmergencyContact[] {
    return this.contacts.filter(c => c.isActive).sort((a, b) => a.priority - b.priority);
  }

  // Emergency Alert System
  async sendEmergencyAlert(
    type: EmergencyAlert['type'],
    childCode: string,
    location?: { lat: number; lng: number; accuracy?: number },
    customMessage?: string
  ): Promise<string> {
    const alert: EmergencyAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      childCode,
      location,
      timestamp: Date.now(),
      message: customMessage || this.getDefaultMessage(type),
      severity: this.getSeverityLevel(type),
      contactsNotified: [],
      status: 'pending'
    };

    this.alertHistory.push(alert);
    this.saveAlertHistory();

    // Notify contacts based on priority and severity
    await this.notifyContacts(alert);

    return alert.id;
  }

  private async notifyContacts(alert: EmergencyAlert): Promise<void> {
    const activeContacts = this.getActiveContacts();
    const contactsToNotify = this.selectContactsForAlert(activeContacts, alert.severity);

    console.log(`🚨 Sending ${alert.type} alert to ${contactsToNotify.length} contacts`);

    for (const contact of contactsToNotify) {
      try {
        await this.notifyContact(contact, alert);
        alert.contactsNotified.push(contact.id);
      } catch (error) {
        console.error(`Failed to notify contact ${contact.name}:`, error);
      }
    }

    this.saveAlertHistory();
  }

  private selectContactsForAlert(contacts: EmergencyContact[], severity: EmergencyAlert['severity']): EmergencyContact[] {
    switch (severity) {
      case 'critical':
        return contacts; // Notify all contacts
      case 'high':
        return contacts.slice(0, 3); // Top 3 priority contacts
      case 'medium':
        return contacts.slice(0, 2); // Top 2 priority contacts
      case 'low':
        return contacts.slice(0, 1); // Only highest priority contact
      default:
        return contacts.slice(0, 2);
    }
  }

  private async notifyContact(contact: EmergencyContact, alert: EmergencyAlert): Promise<void> {
    const message = this.formatAlertMessage(alert, contact);
    const promises: Promise<void>[] = [];

    // Send notifications based on contact preferences
    for (const method of contact.notificationMethods) {
      switch (method) {
        case 'push':
          promises.push(this.sendPushNotification(contact, message, alert));
          break;
        case 'sms':
          promises.push(this.sendSMS(contact.phone, message));
          break;
        case 'call':
          promises.push(this.initiateCall(contact.phone, message));
          break;
        case 'email':
          if (contact.email) {
            promises.push(this.sendEmail(contact.email, message, alert));
          }
          break;
      }
    }

    await Promise.allSettled(promises);
  }

  private async sendPushNotification(contact: EmergencyContact, message: string, alert: EmergencyAlert): Promise<void> {
    try {
      const { showBrowserNotification } = await import('./notifications');
      showBrowserNotification(
        `🚨 SafeStep Emergency Alert`,
        message,
        '/Screenshot 2025-07-11 193952 copy.png'
      );
    } catch (error) {
      console.error('Push notification failed:', error);
    }
  }

  private async sendSMS(phone: string, message: string): Promise<void> {
    // In a real implementation, this would integrate with SMS service like Twilio
    console.log(`📱 SMS to ${phone}: ${message}`);
    
    // For now, we'll use the Web Share API or fallback to opening SMS app
    if ('share' in navigator) {
      try {
        await navigator.share({
          text: message
        });
      } catch (error) {
        // Fallback to SMS URL scheme
        window.open(`sms:${phone}?body=${encodeURIComponent(message)}`);
      }
    } else {
      window.open(`sms:${phone}?body=${encodeURIComponent(message)}`);
    }
  }

  private async initiateCall(phone: string, message: string): Promise<void> {
    // Open phone dialer
    window.open(`tel:${phone}`);
    console.log(`📞 Call initiated to ${phone}: ${message}`);
  }

  private async sendEmail(email: string, message: string, alert: EmergencyAlert): Promise<void> {
    const subject = `SafeStep Emergency Alert - ${alert.type.toUpperCase()}`;
    const body = this.formatEmailBody(alert, message);
    
    window.open(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    console.log(`📧 Email to ${email}: ${subject}`);
  }

  private formatAlertMessage(alert: EmergencyAlert, contact: EmergencyContact): string {
    let message = `🚨 SAFESTEP ALERT 🚨\n\n`;
    message += `Hello ${contact.name},\n\n`;
    message += `${alert.message}\n\n`;
    
    if (alert.location) {
      message += `📍 Location: https://maps.google.com/maps?q=${alert.location.lat},${alert.location.lng}\n`;
      if (alert.location.accuracy) {
        message += `🎯 Accuracy: ${alert.location.accuracy.toFixed(0)}m\n`;
      }
    }
    
    message += `⏰ Time: ${new Date(alert.timestamp).toLocaleString()}\n\n`;
    message += `This is an automated alert from SafeStep Family Safety App.`;
    
    return message;
  }

  private formatEmailBody(alert: EmergencyAlert, message: string): string {
    let body = message + '\n\n';
    body += '--- ALERT DETAILS ---\n';
    body += `Alert ID: ${alert.id}\n`;
    body += `Type: ${alert.type}\n`;
    body += `Severity: ${alert.severity}\n`;
    body += `Child Code: ${alert.childCode}\n`;
    
    if (alert.childName) {
      body += `Child Name: ${alert.childName}\n`;
    }
    
    body += '\nPlease respond immediately if this is a critical emergency.\n';
    body += 'You can acknowledge this alert by replying to this email.\n\n';
    body += 'SafeStep Family Safety Team';
    
    return body;
  }

  private getDefaultMessage(type: EmergencyAlert['type']): string {
    switch (type) {
      case 'sos':
        return 'EMERGENCY: Your child has activated the SOS alert and needs immediate help!';
      case 'safe_zone_violation':
        return 'ALERT: Your child has left their designated safe zone.';
      case 'offline':
        return 'WARNING: Your child\'s device has been offline for an extended period.';
      case 'low_battery':
        return 'NOTICE: Your child\'s device battery is critically low.';
      default:
        return 'ALERT: A safety event has occurred with your child.';
    }
  }

  private getSeverityLevel(type: EmergencyAlert['type']): EmergencyAlert['severity'] {
    switch (type) {
      case 'sos':
        return 'critical';
      case 'safe_zone_violation':
        return 'high';
      case 'offline':
        return 'medium';
      case 'low_battery':
        return 'low';
      default:
        return 'medium';
    }
  }

  // Alert Management
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alertHistory.find(a => a.id === alertId);
    if (!alert) return false;
    
    alert.status = 'acknowledged';
    this.saveAlertHistory();
    return true;
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alertHistory.find(a => a.id === alertId);
    if (!alert) return false;
    
    alert.status = 'resolved';
    this.saveAlertHistory();
    return true;
  }

  getAlertHistory(): EmergencyAlert[] {
    return [...this.alertHistory].sort((a, b) => b.timestamp - a.timestamp);
  }

  getActiveAlerts(): EmergencyAlert[] {
    return this.alertHistory.filter(a => a.status === 'pending');
  }

  // Data Persistence
  private saveContacts() {
    try {
      localStorage.setItem('safestep_emergency_contacts', JSON.stringify(this.contacts));
    } catch (error) {
      console.error('Failed to save emergency contacts:', error);
    }
  }

  private loadContacts() {
    try {
      const saved = localStorage.getItem('safestep_emergency_contacts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Validate each contact object
          this.contacts = parsed.filter(contact => 
            contact &&
            typeof contact.id === 'string' &&
            typeof contact.name === 'string' &&
            typeof contact.phone === 'string' &&
            typeof contact.priority === 'number' &&
            typeof contact.isActive === 'boolean' &&
            Array.isArray(contact.notificationMethods)
          );
        } else {
          console.warn('Invalid contacts data structure');
          this.contacts = [];
        }
      }
    } catch (error) {
      console.error('Failed to load emergency contacts:', error);
      this.contacts = [];
    }
  }

  private saveAlertHistory() {
    try {
      // Keep only last 100 alerts to prevent storage bloat
      const recentAlerts = this.alertHistory.slice(-100);
      localStorage.setItem('safestep_alert_history', JSON.stringify(recentAlerts));
    } catch (error) {
      console.error('Failed to save alert history:', error);
    }
  }

  private loadAlertHistory() {
    try {
      const saved = localStorage.getItem('safestep_alert_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Validate each alert object
          this.alertHistory = parsed.filter(alert =>
            alert &&
            typeof alert.id === 'string' &&
            typeof alert.type === 'string' &&
            typeof alert.timestamp === 'number' &&
            typeof alert.status === 'string'
          );
        } else {
          console.warn('Invalid alert history data structure');
          this.alertHistory = [];
        }
      }
    } catch (error) {
      console.error('Failed to load alert history:', error);
      this.alertHistory = []; // Reset to empty array on error
    }
  }

  // Utility Methods
  clearAllData() {
    this.contacts = [];
    this.alertHistory = [];
    localStorage.removeItem('safestep_emergency_contacts');
    localStorage.removeItem('safestep_alert_history');
  }

  exportContacts(): string {
    return JSON.stringify(this.contacts, null, 2);
  }

  importContacts(jsonData: string): boolean {
    try {
      const imported = JSON.parse(jsonData);
      if (Array.isArray(imported)) {
        this.contacts = imported;
        this.saveContacts();
        return true;
      }
    } catch (error) {
      console.error('Failed to import contacts:', error);
    }
    return false;
  }
}