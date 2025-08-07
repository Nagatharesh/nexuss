import React from 'react';
import { SOSAlert } from '../types';
import { ExternalLink, AlertTriangle } from 'lucide-react';

interface SOSHistoryProps {
  sosAlerts: SOSAlert[];
}

export default function SOSHistory({ sosAlerts }: SOSHistoryProps) {
  if (sosAlerts.length === 0) {
    return (
      <div className="glass rounded-2xl p-6 border border-white/20">
        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-red-400" />
          SOS History
        </h3>
        <p className="text-white/60 text-center py-8">No SOS alerts yet</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-6 border border-white/20">
      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <AlertTriangle className="w-6 h-6 text-red-400" />
        SOS History
      </h3>
      
      <div className="max-h-64 overflow-y-auto space-y-4">
        {sosAlerts.map((alert, index) => (
          <div
            key={index}
            className={`p-4 rounded-xl border backdrop-blur-sm ${
              alert.status === 'active' 
                ? 'bg-red-500/20 border-red-400/30' 
                : 'bg-white/10 border-white/20'
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="font-bold text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                🚨 SOS Alert
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-medium border ${
                alert.status === 'active' 
                  ? 'bg-red-500/20 text-red-300 border-red-400/30' 
                  : 'bg-green-500/20 text-green-300 border-green-400/30'
              }`}>
                {alert.status.toUpperCase()}
              </div>
            </div>
            
            <div className="text-sm text-white/80 space-y-2">
              <p><strong>Time:</strong> {new Date(alert.timestamp).toLocaleString()}</p>
              <p><strong>Accuracy:</strong> {alert.accuracy.toFixed(0)}m</p>
              {alert.lat && alert.lng && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${alert.lat},${alert.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 underline transition-colors"
                >
                  View Location <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}