interface OfflineData {
  locations: any[];
  messages: any[];
  sosAlerts: any[];
  lastSync: number;
}

interface QueuedAction {
  id: string;
  type: 'location' | 'message' | 'sos' | 'status';
  data: any;
  timestamp: number;
  retryCount: number;
}

export class OfflineManager {
  private static instance: OfflineManager;
  private isOnline = navigator.onLine;
  private syncQueue: QueuedAction[] = [];
  private offlineData: OfflineData = {
    locations: [],
    messages: [],
    sosAlerts: [],
    lastSync: Date.now()
  };
  private syncInProgress = false;
  private maxRetries = 3;
  private syncCallbacks: ((isOnline: boolean) => void)[] = [];

  static getInstance(): OfflineManager {
    if (!OfflineManager.instance) {
      OfflineManager.instance = new OfflineManager();
    }
    return OfflineManager.instance;
  }

  constructor() {
    this.loadOfflineData();
    this.setupEventListeners();
    this.startPeriodicSync();
  }

  private setupEventListeners() {
    window.addEventListener('online', () => {
      console.log('🌐 Connection restored - starting sync...');
      this.isOnline = true;
      this.notifyCallbacks(true);
      this.syncWhenOnline();
    });

    window.addEventListener('offline', () => {
      console.log('📴 Connection lost - switching to offline mode...');
      this.isOnline = false;
      this.notifyCallbacks(false);
    });

    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isOnline) {
        this.syncWhenOnline();
      }
    });
  }

  private startPeriodicSync() {
    setInterval(() => {
      if (this.isOnline && this.syncQueue.length > 0) {
        this.syncWhenOnline();
      }
    }, 30000); // Sync every 30 seconds
  }

  onConnectionChange(callback: (isOnline: boolean) => void) {
    this.syncCallbacks.push(callback);
  }

  private notifyCallbacks(isOnline: boolean) {
    this.syncCallbacks.forEach(callback => callback(isOnline));
  }

  isConnected(): boolean {
    return this.isOnline;
  }

  // Queue actions for later sync
  queueAction(type: QueuedAction['type'], data: any): string {
    const action: QueuedAction = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0
    };

    this.syncQueue.push(action);
    this.saveOfflineData();

    // Try immediate sync if online
    if (this.isOnline) {
      this.syncWhenOnline();
    }

    return action.id;
  }

  // Store data locally for offline access
  storeOfflineData(type: keyof OfflineData, data: any) {
    if (type === 'lastSync') {
      this.offlineData.lastSync = data;
    } else {
      (this.offlineData[type] as any[]).push({
        ...data,
        _offline: true,
        _timestamp: Date.now()
      });

      // Keep only last 100 items to prevent storage bloat
      if ((this.offlineData[type] as any[]).length > 100) {
        (this.offlineData[type] as any[]).splice(0, 50);
      }
    }
    
    this.saveOfflineData();
  }

  // Get offline data
  getOfflineData(type: keyof OfflineData): any {
    return this.offlineData[type];
  }

  // Sync queued actions when online
  async syncWhenOnline(): Promise<void> {
    if (!this.isOnline || this.syncInProgress || this.syncQueue.length === 0) {
      return;
    }

    this.syncInProgress = true;
    console.log(`🔄 Syncing ${this.syncQueue.length} queued actions...`);

    const actionsToSync = [...this.syncQueue];
    const successfulSyncs: string[] = [];

    for (const action of actionsToSync) {
      try {
        const success = await this.syncAction(action);
        if (success) {
          successfulSyncs.push(action.id);
        } else {
          action.retryCount++;
          if (action.retryCount >= this.maxRetries) {
            console.error(`❌ Action ${action.id} failed after ${this.maxRetries} retries`);
            successfulSyncs.push(action.id); // Remove from queue to prevent infinite retries
          }
        }
      } catch (error) {
        console.error(`❌ Sync error for action ${action.id}:`, error);
        action.retryCount++;
        if (action.retryCount >= this.maxRetries) {
          successfulSyncs.push(action.id);
        }
      }
    }

    // Remove successfully synced actions
    this.syncQueue = this.syncQueue.filter(action => !successfulSyncs.includes(action.id));
    this.offlineData.lastSync = Date.now();
    this.saveOfflineData();

    console.log(`✅ Sync completed. ${successfulSyncs.length} actions synced, ${this.syncQueue.length} remaining`);
    this.syncInProgress = false;
  }

  private async syncAction(action: QueuedAction): Promise<boolean> {
    try {
      const { database } = await import('../config/firebase');
      const { ref, set, push } = await import('firebase/database');

      switch (action.type) {
        case 'location':
          await set(ref(database, `children/${action.data.childCode}`), action.data);
          await push(ref(database, `children/${action.data.childCode}/locationHistory`), action.data.lastLocation);
          break;

        case 'message':
          await push(ref(database, `chats/${action.data.childCode}/messages`), action.data.message);
          break;

        case 'sos':
          await push(ref(database, 'sosAlerts'), action.data);
          break;

        case 'status':
          await set(ref(database, `children/${action.data.childCode}/status`), action.data.status);
          break;

        default:
          console.warn(`Unknown action type: ${action.type}`);
          return false;
      }

      return true;
    } catch (error) {
      console.error(`Failed to sync action ${action.id}:`, error);
      return false;
    }
  }

  private saveOfflineData() {
    try {
      localStorage.setItem('safestep_offline_data', JSON.stringify(this.offlineData));
      localStorage.setItem('safestep_sync_queue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Failed to save offline data:', error);
    }
  }

  private loadOfflineData() {
    try {
      const offlineData = localStorage.getItem('safestep_offline_data');
      const syncQueue = localStorage.getItem('safestep_sync_queue');

      if (offlineData) {
        const parsed = JSON.parse(offlineData);
        // Validate parsed data structure
        if (parsed && typeof parsed === 'object' && 
            Array.isArray(parsed.locations) && 
            Array.isArray(parsed.messages) && 
            Array.isArray(parsed.sosAlerts) &&
            typeof parsed.lastSync === 'number') {
          this.offlineData = parsed;
        } else {
          console.warn('Invalid offline data structure, resetting to defaults');
          this.resetOfflineData();
        }
      }

      if (syncQueue) {
        const parsedQueue = JSON.parse(syncQueue);
        if (Array.isArray(parsedQueue)) {
          // Validate each queue item
          this.syncQueue = parsedQueue.filter(item => 
            item && 
            typeof item.id === 'string' && 
            typeof item.type === 'string' && 
            typeof item.timestamp === 'number' &&
            typeof item.retryCount === 'number'
          );
        } else {
          console.warn('Invalid sync queue structure, resetting to empty array');
          this.syncQueue = [];
        }
      }
    } catch (error) {
      console.error('Failed to load offline data:', error);
      // Reset to default values on error
      this.resetOfflineData();
    }
  }
  
  private resetOfflineData() {
    this.offlineData = {
      locations: [],
      messages: [],
      sosAlerts: [],
      lastSync: Date.now()
    };
    this.syncQueue = [];
    this.saveOfflineData();
  }

  // Clear all offline data
  clearOfflineData() {
    this.offlineData = {
      locations: [],
      messages: [],
      sosAlerts: [],
      lastSync: Date.now()
    };
    this.syncQueue = [];
    this.saveOfflineData();
  }

  // Get sync status
  getSyncStatus() {
    return {
      isOnline: this.isOnline,
      queuedActions: this.syncQueue.length,
      lastSync: this.offlineData.lastSync,
      syncInProgress: this.syncInProgress
    };
  }
}