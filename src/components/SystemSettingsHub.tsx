import React, { useState, useEffect } from 'react';

// အမှန်တကယ် သုံးစွဲနေသော တကယ့် Free Flash Cascade Models စာရင်း
export const VERIFIED_FLASH_CASCADE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3-flash-preview',
  'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-flash-latest'
];

interface SystemSettingsHubProps {
  onLowBandwidthChange?: (enabled: boolean) => void;
}

export const SystemSettingsHub: React.FC<SystemSettingsHubProps> = ({ onLowBandwidthChange }) => {
  // 1. Low-Bandwidth Mode State & System Sync
  const [lowBandwidth, setLowBandwidth] = useState<boolean>(() => {
    return localStorage.getItem('akari_low_bandwidth') === 'true';
  });

  const [storedKeysCount, setStoredKeysCount] = useState<number>(() => {
    return typeof window !== 'undefined' ? localStorage.length : 0;
  });

  // Inline password & status state so backup works seamlessly in iframe environments
  const [backupPassword, setBackupPassword] = useState<string>('');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState<'export' | 'restore' | null>(null);
  const [pendingRestoreFile, setPendingRestoreFile] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    localStorage.setItem('akari_low_bandwidth', String(lowBandwidth));
    if (lowBandwidth) {
      document.documentElement.classList.add('low-bandwidth-mode');
    } else {
      document.documentElement.classList.remove('low-bandwidth-mode');
    }
    if (onLowBandwidthChange) {
      onLowBandwidthChange(lowBandwidth);
    }
    setStoredKeysCount(localStorage.length);
  }, [lowBandwidth, onLowBandwidthChange]);

  // 2. Encryption Helper (Web Crypto AES-GCM 256-bit)
  const deriveKey = async (password: string, salt: Uint8Array): Promise<CryptoKey> => {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  };

  // 3. Export Encrypted Backup (.json)
  const executeExportWithPassword = async (pass: string) => {
    if (!pass.trim()) {
      setStatusMessage({ type: 'error', text: 'Backup အတွက် လျှို့ဝှက်နံပါတ် (Password) ထည့်သွင်းပေးပါ။' });
      return;
    }

    try {
      // LocalStorage ရှိ Portfolio & Assignment ဒေတာများကို စုစည်းခြင်း
      const backupPayload: Record<string, string | null> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('akari_') || key.startsWith('uopeople_'))) {
          backupPayload[key] = localStorage.getItem(key);
        }
      }

      const enc = new TextEncoder();
      const rawData = enc.encode(JSON.stringify(backupPayload));
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveKey(pass, salt);

      const cipherBuffer = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as BufferSource },
        key,
        rawData
      );

      const exportBundle = {
        version: '1.0',
        salt: Array.from(salt),
        iv: Array.from(iv),
        ciphertext: Array.from(new Uint8Array(cipherBuffer)),
        exportedAt: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(exportBundle)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Portfolio_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setShowPasswordPrompt(null);
      setBackupPassword('');
      setStatusMessage({ type: 'success', text: '✅ Encrypted Backup (.json) ထုတ်ယူပြီးပါပြီခင်ဗျာ။' });
    } catch {
      setStatusMessage({ type: 'error', text: 'Backup ထုတ်ယူရာတွင် အမှားဖြစ်ပေါ်ပါသည်ခင်ဗျာ။' });
    }
  };

  const handleExportBackup = () => {
    setStatusMessage(null);
    setShowPasswordPrompt('export');
  };

  // 4. Restore from Encrypted Backup (.json)
  const executeRestoreWithPassword = async (file: File, pass: string) => {
    if (!pass.trim()) {
      setStatusMessage({ type: 'error', text: 'Backup ဖိုင် ပြန်လည်သွင်းယူရန် လျှို့ဝှက်နံပါတ် ထည့်ပါ။' });
      return;
    }

    try {
      const text = await file.text();
      const bundle = JSON.parse(text);

      const salt = new Uint8Array(bundle.salt);
      const iv = new Uint8Array(bundle.iv);
      const data = new Uint8Array(bundle.ciphertext);
      const key = await deriveKey(pass, salt);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as BufferSource },
        key,
        data
      );

      const dec = new TextDecoder();
      const restoredObj = JSON.parse(dec.decode(decrypted));

      Object.entries(restoredObj).forEach(([k, v]) => {
        if (v !== null) localStorage.setItem(k, v as string);
      });

      setShowPasswordPrompt(null);
      setBackupPassword('');
      setPendingRestoreFile(null);
      setStatusMessage({
        type: 'success',
        text: '✅ ဒေတာများ အောင်မြင်စွာ ပြန်လည်ရရှိပြီးပါပြီခင်ဗျာ။ စာမျက်နှာကို ပြန်လည်ဖွင့်နေပါသည်...',
      });
      setTimeout(() => {
        window.location.reload();
      }, 900);
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'လျှို့ဝှက်နံပါတ် မှားယွင်းနေပါသည် သို့မဟုတ် ဖိုင်ပျက်စီးနေပါသည်ခင်ဗျာ။',
      });
    }
  };

  const handleRestoreBackup = () => {
    setStatusMessage(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setPendingRestoreFile(file);
      setShowPasswordPrompt('restore');
    };
    input.click();
  };

  return (
    <div className="space-y-3">
      {/* 2. ဒေတာချွေတာရေးစနစ် (LOW-BANDWIDTH MODE) */}
      <div className="p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
            <span>📶</span>
            <span>ဒေတာချွေတာရေးစနစ် (LOW-BANDWIDTH MODE)</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            အင်တာနက်လိုင်းနှေးချိန်တွင် animation များနှင့် visual effects များကို ပိတ်၍ text interface ဖြင့် အမြန်ဆုံး ဖွင့်ပေးခြင်း။
          </p>
        </div>

        <input
          type="checkbox"
          checked={lowBandwidth}
          onChange={(e) => setLowBandwidth(e.target.checked)}
          className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0 cursor-pointer"
        />
      </div>

      {/* 3. ENCRYPTED LOCAL PORTFOLIO BACKUP (.JSON) */}
      <div className="p-4 rounded-2xl bg-[#0c1222]/90 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs">
            <span>🗄️</span>
            <span>ENCRYPTED LOCAL PORTFOLIO BACKUP (.JSON)</span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {storedKeysCount} keys stored
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handleExportBackup}
            className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>📥</span>
            <span>Export Encrypted Backup</span>
          </button>

          <button
            type="button"
            onClick={handleRestoreBackup}
            className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>📤</span>
            <span>Restore from Backup</span>
          </button>
        </div>

        {showPasswordPrompt && (
          <div className="p-3 rounded-xl bg-slate-950 border border-indigo-500/40 space-y-2.5">
            <label className="block text-xs font-semibold text-indigo-300">
              {showPasswordPrompt === 'export'
                ? '🔒 Backup အတွက် လျှို့ဝှက်နံပါတ် (Password) သတ်မှတ်ပေးပါ:'
                : `🔓 "${pendingRestoreFile?.name || 'Backup.json'}" ပြန်လည်သွင်းယူရန် လျှို့ဝှက်နံပါတ် ထည့်ပါ:`}
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={backupPassword}
                onChange={(e) => setBackupPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (showPasswordPrompt === 'export') {
                      executeExportWithPassword(backupPassword);
                    } else if (pendingRestoreFile) {
                      executeRestoreWithPassword(pendingRestoreFile, backupPassword);
                    }
                  }
                }}
                placeholder="Enter AES-256 encryption password..."
                className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  if (showPasswordPrompt === 'export') {
                    executeExportWithPassword(backupPassword);
                  } else if (pendingRestoreFile) {
                    executeRestoreWithPassword(pendingRestoreFile, backupPassword);
                  }
                }}
                className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer"
              >
                {showPasswordPrompt === 'export' ? 'Export' : 'Restore'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordPrompt(null);
                  setBackupPassword('');
                  setPendingRestoreFile(null);
                }}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {statusMessage && (
          <p
            className={`text-xs font-medium ${
              statusMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {statusMessage.text}
          </p>
        )}
      </div>
    </div>
  );
};
