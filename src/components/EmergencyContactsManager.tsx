import React, { useState, useEffect } from 'react';
import { EmergencyContactManager } from '../utils/emergencyContacts';
import { Plus, Edit, Trash2, Phone, Mail, User, AlertTriangle, Check, X, Shield } from 'lucide-react';
import { showNotification } from '../utils/notifications';

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  relationship: string;
  priority: number;
  isActive: boolean;
  notificationMethods: ('sms' | 'call' | 'email' | 'push')[];
}

interface EmergencyContactsManagerProps {
  onClose: () => void;
}

export default function EmergencyContactsManager({ onClose }: EmergencyContactsManagerProps) {
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [editingContact, setEditingContact] = useState<string | null>(null);
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    email: '',
    relationship: '',
    priority: 1,
    isActive: true,
    notificationMethods: ['push', 'sms'] as ('sms' | 'call' | 'email' | 'push')[]
  });

  const emergencyManager = EmergencyContactManager.getInstance();

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = () => {
    setContacts(emergencyManager.getContacts());
  };

  const handleAddContact = () => {
    if (!newContact.name.trim() || !newContact.phone.trim()) {
      showNotification('Name and phone number are required', 'warning');
      return;
    }

    emergencyManager.addContact(newContact);
    setNewContact({
      name: '',
      phone: '',
      email: '',
      relationship: '',
      priority: contacts.length + 1,
      isActive: true,
      notificationMethods: ['push', 'sms']
    });
    setIsAddingContact(false);
    loadContacts();
    showNotification('Emergency contact added successfully', 'success');
  };

  const handleUpdateContact = (id: string, updates: Partial<EmergencyContact>) => {
    emergencyManager.updateContact(id, updates);
    loadContacts();
    setEditingContact(null);
    showNotification('Contact updated successfully', 'success');
  };

  const handleDeleteContact = (id: string) => {
    if (confirm('Are you sure you want to delete this emergency contact?')) {
      emergencyManager.removeContact(id);
      loadContacts();
      showNotification('Contact deleted successfully', 'info');
    }
  };

  const handleTestAlert = async () => {
    if (contacts.length === 0) {
      showNotification('Add at least one emergency contact first', 'warning');
      return;
    }

    await emergencyManager.sendEmergencyAlert(
      'sos',
      'TEST',
      { lat: 40.7128, lng: -74.0060, accuracy: 10 },
      'This is a test alert from SafeStep. Please ignore.'
    );
    showNotification('Test alert sent to emergency contacts', 'success');
  };

  const toggleNotificationMethod = (contactId: string, method: 'sms' | 'call' | 'email' | 'push') => {
    const contact = contacts.find(c => c.id === contactId);
    if (!contact) return;

    const methods = contact.notificationMethods.includes(method)
      ? contact.notificationMethods.filter(m => m !== method)
      : [...contact.notificationMethods, method];

    handleUpdateContact(contactId, { notificationMethods: methods });
  };

  const relationshipOptions = [
    'Parent', 'Guardian', 'Grandparent', 'Sibling', 'Aunt/Uncle', 
    'Family Friend', 'Neighbor', 'Teacher', 'Babysitter', 'Other'
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-white/20">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 px-6 py-4 border-b border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-red-400" />
              <div>
                <h2 className="text-2xl font-bold text-white">Emergency Contacts</h2>
                <p className="text-white/70">Manage your emergency notification network</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Add Contact Button */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">Emergency Contacts ({contacts.length})</h3>
              <p className="text-white/60 text-sm">These contacts will be notified during emergencies</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleTestAlert}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-4 py-2 rounded-xl transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" />
                Test Alert
              </button>
              <button
                onClick={() => setIsAddingContact(true)}
                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-4 py-2 rounded-xl transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Contact
              </button>
            </div>
          </div>

          {/* Add Contact Form */}
          {isAddingContact && (
            <div className="glass rounded-2xl p-6 mb-6 border border-white/20">
              <h4 className="text-lg font-semibold text-white mb-4">Add New Emergency Contact</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Full Name *"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-white placeholder-white/50"
                />
                <input
                  type="tel"
                  placeholder="Phone Number *"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-white placeholder-white/50"
                />
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-white placeholder-white/50"
                />
                <select
                  value={newContact.relationship}
                  onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })}
                  className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 text-white"
                >
                  <option value="">Select Relationship</option>
                  {relationshipOptions.map(rel => (
                    <option key={rel} value={rel} className="bg-slate-800">{rel}</option>
                  ))}
                </select>
              </div>

              {/* Notification Methods */}
              <div className="mb-4">
                <label className="block text-white/90 text-sm font-medium mb-2">Notification Methods</label>
                <div className="flex flex-wrap gap-2">
                  {(['push', 'sms', 'call', 'email'] as const).map(method => (
                    <button
                      key={method}
                      onClick={() => {
                        const methods = newContact.notificationMethods.includes(method)
                          ? newContact.notificationMethods.filter(m => m !== method)
                          : [...newContact.notificationMethods, method];
                        setNewContact({ ...newContact, notificationMethods: methods });
                      }}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        newContact.notificationMethods.includes(method)
                          ? 'bg-blue-500 text-white'
                          : 'bg-white/10 text-white/70 hover:bg-white/20'
                      }`}
                    >
                      {method.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setIsAddingContact(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddContact}
                  className="px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-xl transition-all duration-300 transform hover:scale-105"
                >
                  Add Contact
                </button>
              </div>
            </div>
          )}

          {/* Contacts List */}
          <div className="space-y-4">
            {contacts.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="w-16 h-16 text-white/30 mx-auto mb-4" />
                <p className="text-white/60 text-lg mb-2">No emergency contacts added yet</p>
                <p className="text-white/40 text-sm">Add contacts to receive emergency notifications</p>
              </div>
            ) : (
              contacts.map((contact, index) => (
                <div
                  key={contact.id}
                  className={`glass rounded-2xl p-6 border transition-all duration-300 ${
                    contact.isActive ? 'border-white/20' : 'border-white/10 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        contact.isActive ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-gray-500'
                      }`}>
                        <User className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-lg font-semibold text-white">{contact.name}</h4>
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full">
                            Priority {contact.priority}
                          </span>
                          {!contact.isActive && (
                            <span className="px-2 py-1 bg-red-500/20 text-red-300 text-xs rounded-full">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="space-y-1 text-white/70">
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4" />
                            <span>{contact.phone}</span>
                          </div>
                          {contact.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4" />
                              <span>{contact.email}</span>
                            </div>
                          )}
                          {contact.relationship && (
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              <span>{contact.relationship}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-3">
                          {contact.notificationMethods.map(method => (
                            <span
                              key={method}
                              className="px-2 py-1 bg-green-500/20 text-green-300 text-xs rounded-full"
                            >
                              {method.toUpperCase()}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdateContact(contact.id, { isActive: !contact.isActive })}
                        className={`p-2 rounded-lg transition-colors ${
                          contact.isActive
                            ? 'text-green-400 hover:bg-green-500/20'
                            : 'text-gray-400 hover:bg-gray-500/20'
                        }`}
                        title={contact.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {contact.isActive ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => setEditingContact(contact.id)}
                        className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteContact(contact.id)}
                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Info Box */}
          <div className="mt-8 glass rounded-2xl p-6 border border-blue-400/30 bg-blue-500/10">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">How Emergency Notifications Work</h4>
                <ul className="text-white/70 space-y-1 text-sm">
                  <li>• <strong>Critical alerts (SOS):</strong> All active contacts are notified immediately</li>
                  <li>• <strong>High priority alerts:</strong> Top 3 priority contacts are notified</li>
                  <li>• <strong>Medium priority alerts:</strong> Top 2 priority contacts are notified</li>
                  <li>• <strong>Low priority alerts:</strong> Only highest priority contact is notified</li>
                  <li>• Contacts are notified via their selected methods (Push, SMS, Call, Email)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}