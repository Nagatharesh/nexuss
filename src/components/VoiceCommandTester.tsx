import React, { useState, useRef } from 'react';
import { VoiceCommandManager } from '../utils/voiceCommands';
import { Mic, Play, TestTube, CheckCircle, XCircle, Volume2 } from 'lucide-react';
import { showNotification } from '../utils/notifications';

interface VoiceCommandTesterProps {
  voiceManager: VoiceCommandManager | null;
  userRole: 'child' | 'parent';
}

export default function VoiceCommandTester({ voiceManager, userRole }: VoiceCommandTesterProps) {
  const [isTestMode, setIsTestMode] = useState(false);
  const [testResults, setTestResults] = useState<{ command: string; success: boolean; error?: string }[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);

  const childCommands = [
    'send sos',
    'emergency',
    'help me',
    'enable panic siren',
    'start siren',
    'disable panic siren',
    'stop siren',
    'i am safe',
    'safe',
    'coming home',
    'going home',
    'need pickup',
    'pick me up'
  ];

  const parentCommands = [
    'where is my child',
    'child location',
    'find my child',
    'child battery',
    'battery level',
    'battery status',
    'are you okay',
    'are you ok',
    'on my way',
    'call me',
    'ping child',
    'send ping'
  ];

  const testCommands = userRole === 'child' ? childCommands : parentCommands;

  const runAllTests = async () => {
    if (!voiceManager) {
      showNotification('Voice manager not available', 'error');
      return;
    }

    setIsRunningTests(true);
    setTestResults([]);
    const results: { command: string; success: boolean; error?: string }[] = [];

    for (const command of testCommands) {
      try {
        console.log(`🧪 Testing command: "${command}"`);
        
        // Test the command
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Command timeout'));
          }, 3000);

          try {
            voiceManager.testCommand(command);
            clearTimeout(timeout);
            resolve();
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });

        results.push({ command, success: true });
        console.log(`✅ Command "${command}" - SUCCESS`);
      } catch (error) {
        results.push({ 
          command, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
        console.log(`❌ Command "${command}" - FAILED:`, error);
      }

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setTestResults(results);
    setIsRunningTests(false);

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    if (successCount === totalCount) {
      showNotification(`🎉 All ${totalCount} voice commands working perfectly!`, 'success');
    } else {
      showNotification(`⚠️ ${successCount}/${totalCount} commands working. Check failed commands.`, 'warning');
    }
  };

  const testSingleCommand = async (command: string) => {
    if (!voiceManager) {
      showNotification('Voice manager not available', 'error');
      return;
    }

    try {
      console.log(`🧪 Testing single command: "${command}"`);
      voiceManager.testCommand(command);
      showNotification(`✅ Command "${command}" executed successfully`, 'success');
    } catch (error) {
      console.error(`❌ Command "${command}" failed:`, error);
      showNotification(`❌ Command "${command}" failed: ${(error as Error).message}`, 'error');
    }
  };

  if (!isTestMode) {
    return (
      <div className="fixed bottom-4 left-4 z-50">
        <button
          onClick={() => setIsTestMode(true)}
          className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110"
          title="Test Voice Commands"
        >
          <TestTube className="w-6 h-6" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border border-white/20">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 px-6 py-4 border-b border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TestTube className="w-8 h-8 text-purple-400" />
              <div>
                <h2 className="text-2xl font-bold text-white">Voice Command Tester</h2>
                <p className="text-white/70">Testing {userRole} voice commands</p>
              </div>
            </div>
            <button
              onClick={() => setIsTestMode(false)}
              className="text-white/60 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Test Controls */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={runAllTests}
              disabled={isRunningTests || !voiceManager}
              className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isRunningTests ? (
                <>
                  <div className="spinner"></div>
                  Testing...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Test All Commands
                </>
              )}
            </button>
          </div>

          {/* Available Commands */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">Available Commands</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {testCommands.map((command, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-white/10 rounded-xl border border-white/20"
                >
                  <div className="flex items-center gap-3">
                    <Volume2 className="w-4 h-4 text-blue-400" />
                    <span className="text-white font-mono text-sm">"{command}"</span>
                  </div>
                  <button
                    onClick={() => testSingleCommand(command)}
                    disabled={isRunningTests}
                    className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 text-white px-3 py-1 rounded-lg text-xs transition-colors"
                  >
                    Test
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Test Results */}
          {testResults.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Test Results</h3>
              <div className="space-y-2">
                {testResults.map((result, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-xl border ${
                      result.success
                        ? 'bg-green-500/20 border-green-400/30'
                        : 'bg-red-500/20 border-red-400/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {result.success ? (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-400" />
                      )}
                      <span className="text-white font-mono text-sm">"{result.command}"</span>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-medium ${
                        result.success ? 'text-green-300' : 'text-red-300'
                      }`}>
                        {result.success ? 'PASS' : 'FAIL'}
                      </span>
                      {result.error && (
                        <div className="text-xs text-red-400 mt-1">{result.error}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="mt-6 p-4 bg-blue-500/20 border border-blue-400/30 rounded-xl">
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium">Test Summary:</span>
                  <span className="text-blue-300">
                    {testResults.filter(r => r.success).length}/{testResults.length} commands working
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-6 p-4 bg-purple-500/20 border border-purple-400/30 rounded-xl">
            <h4 className="text-white font-medium mb-2">Testing Instructions:</h4>
            <ul className="text-white/70 text-sm space-y-1">
              <li>• Make sure voice commands are enabled before testing</li>
              <li>• Each command will be executed automatically during testing</li>
              <li>• Check the console for detailed test logs</li>
              <li>• Failed commands may indicate missing handlers or permissions</li>
              <li>• Test individual commands to debug specific issues</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}