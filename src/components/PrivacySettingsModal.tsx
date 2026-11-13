import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { translations } from '../translations';
import {
  ShieldCheck,
  Key,
  Database,
  X,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Download,
  Upload,
  Wifi,
  WifiOff,
  Sparkles,
  Trash2,
  Plus,
  Check,
  Zap,
  RefreshCw,
  FlaskConical,
} from 'lucide-react';
import { useApi, cleanGeminiKey, testGeminiApiKey } from '../context/ApiContext';
import { SystemSettingsHub } from './SystemSettingsHub';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacySettingsModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
  const {
    settings,
    updateSettings,
    language,
    terms,
    flashcards,
    citations,
    exportEncryptedBackup,
    importEncryptedBackup,
  } = useApp();

  const {
    keyPool,
    addKeyToPool,
    removeKeyFromPool,
    checkPoolHealth,
    isProbing,
    poolHealthSummary,
    primaryApiKey,
    backupApiKey,
    setPrimaryApiKey,
    setBackupApiKey,
  } = useApi();

  const t = translations[language];

  const [useCustomKey] = useState(settings.useCustomKey);
  const [geminiKeyInput, setGeminiKeyInput] = useState(primaryApiKey || settings.customGeminiKey || '');
  const [backupKeyInput, setBackupKeyInput] = useState(backupApiKey || '');

  // Live API Key Test Suite State (Primary Key)
  const [isTestingPrimary, setIsTestingPrimary] = useState(false);
  const [primaryTestResult, setPrimaryTestResult] = useState<{
    success: boolean;
    message: string;
    latency?: number;
  } | null>(null);
  const [primarySavedLatency, setPrimarySavedLatency] = useState<number | undefined>(undefined);
  const [geminiSaveFeedback, setGeminiSaveFeedback] = useState<string | null>(null);

  // Live API Key Test Suite State (Secondary Backup Key)
  const [isTestingBackup, setIsTestingBackup] = useState(false);
  const [backupTestResult, setBackupTestResult] = useState<{
    success: boolean;
    message: string;
    latency?: number;
  } | null>(null);
  const [backupSavedLatency, setBackupSavedLatency] = useState<number | undefined>(undefined);
  const [backupSaveFeedback, setBackupSaveFeedback] = useState<string | null>(null);

  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyInput, setNewKeyInput] = useState('');
  const [isAddingKey, setIsAddingKey] = useState(false);
  const [keyAddFeedback, setKeyAddFeedback] = useState<{ status: string; message: string } | null>(null);

  const [dataSaverMode, setDataSaverMode] = useState(settings.dataSaverMode || false);
  const [engineMode] = useState<'cloud' | 'local'>(settings.engineMode || 'cloud');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Test Primary Key against Google Gemini API
  const handleTestPrimaryKey = async () => {
    setIsTestingPrimary(true);
    setPrimaryTestResult(null);
    setGeminiSaveFeedback(null);
    try {
      const result = await testGeminiApiKey(geminiKeyInput);
      setPrimaryTestResult(result);
      if (result.success && result.latency !== undefined) {
        setPrimarySavedLatency(result.latency);
      }
    } finally {
      setIsTestingPrimary(false);
    }
  };

  // Save Primary Key
  const handleSaveGeminiKey = () => {
    const cleanKey = cleanGeminiKey(geminiKeyInput);
    if (cleanKey) {
      localStorage.setItem('akari_gemini_api_key_primary', cleanKey);
      localStorage.setItem('akari_primary_gemini_key', cleanKey);
      localStorage.setItem('gemini_api_key', cleanKey);
      setPrimaryApiKey(cleanKey);
      updateSettings({ customGeminiKey: cleanKey, useCustomKey: true });
      setGeminiSaveFeedback('✅ Primary Gemini API Key Activated & Saved!');
    } else {
      localStorage.removeItem('akari_gemini_api_key_primary');
      localStorage.removeItem('akari_primary_gemini_key');
      localStorage.removeItem('gemini_api_key');
      setPrimaryApiKey('');
      setPrimaryTestResult(null);
      setGeminiSaveFeedback('Primary key cleared');
    }
    setTimeout(() => setGeminiSaveFeedback(null), 3500);
  };

  const handleRemoveGeminiKey = () => {
    setGeminiKeyInput('');
    setPrimaryTestResult(null);
    setPrimarySavedLatency(undefined);
    localStorage.removeItem('akari_gemini_api_key_primary');
    localStorage.removeItem('akari_primary_gemini_key');
    localStorage.removeItem('gemini_api_key');
    setPrimaryApiKey('');
    setGeminiSaveFeedback('Primary key removed');
    setTimeout(() => setGeminiSaveFeedback(null), 3000);
  };

  // Test Backup Key against Google Gemini API
  const handleTestBackupKey = async () => {
    setIsTestingBackup(true);
    setBackupTestResult(null);
    setBackupSaveFeedback(null);
    try {
      const result = await testGeminiApiKey(backupKeyInput);
      setBackupTestResult(result);
      if (result.success && result.latency !== undefined) {
        setBackupSavedLatency(result.latency);
      }
    } finally {
      setIsTestingBackup(false);
    }
  };

  // Save Backup Key
  const handleSaveBackupKey = () => {
    const cleanKey = cleanGeminiKey(backupKeyInput);
    if (cleanKey) {
      localStorage.setItem('akari_gemini_api_key_backup', cleanKey);
      localStorage.setItem('akari_backup_gemini_key', cleanKey);
      setBackupApiKey(cleanKey);
      setBackupSaveFeedback('✅ Secondary Backup Key Activated & Saved!');
    } else {
      localStorage.removeItem('akari_gemini_api_key_backup');
      localStorage.removeItem('akari_backup_gemini_key');
      setBackupApiKey('');
      setBackupTestResult(null);
      setBackupSaveFeedback('Backup key cleared');
    }
    setTimeout(() => setBackupSaveFeedback(null), 3500);
  };

  const handleRemoveBackupKey = () => {
    setBackupKeyInput('');
    setBackupTestResult(null);
    setBackupSavedLatency(undefined);
    localStorage.removeItem('akari_gemini_api_key_backup');
    localStorage.removeItem('akari_backup_gemini_key');
    setBackupApiKey('');
    setBackupSaveFeedback('Backup key removed');
    setTimeout(() => setBackupSaveFeedback(null), 3000);
  };

  const handleAddKey = async () => {
    if (!newKeyInput.trim()) return;
    setIsAddingKey(true);
    setKeyAddFeedback(null);
    try {
      const probe = await addKeyToPool(newKeyInput.trim(), newKeyLabel.trim() || undefined);
      setKeyAddFeedback({
        status: probe.status,
        message: probe.healthy
          ? `Key added & verified successfully (${probe.latencyMs}ms)`
          : probe.message,
      });
      if (probe.healthy) {
        setNewKeyInput('');
        setNewKeyLabel('');
      }
    } catch (e: any) {
      setKeyAddFeedback({ status: 'ERROR', message: e?.message || 'Failed to add key' });
    } finally {
      setIsAddingKey(false);
    }
  };

  if (!isOpen) return null;

  const handleSave = () => {
    if (geminiKeyInput.trim()) {
      handleSaveGeminiKey();
    }
    if (backupKeyInput.trim()) {
      handleSaveBackupKey();
    }

    updateSettings({
      useCustomKey,
      dataSaverMode,
      engineMode,
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const success = await importEncryptedBackup(text);
      if (success) {
        setImportStatus('Backup restored successfully! Refreshing...');
      } else {
        setImportStatus('Invalid backup JSON format.');
      }
    } catch {
      setImportStatus('Failed to read backup file.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 max-h-[92vh] overflow-y-auto shadow-2xl relative space-y-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              🔑 Gemini API Key Vault
            </h2>
            <p className="text-xs text-slate-400">
              Pure Gemini-Native Architecture · Intelligent Multi-Tier Token Optimization &amp; Auto-Failover
            </p>
          </div>
        </div>

        {/* Pure Gemini Multi-Key Vault Card */}
        <div className="p-5 rounded-2xl bg-slate-950 border border-indigo-500/30 space-y-4">
          <div className="pb-2 border-b border-slate-800 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <Key className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">
                    🔑 Gemini API Key Vault (Primary &amp; Failover)
                  </h3>
                </div>
                <p className="text-xs text-slate-400">
                  {language === 'my'
                    ? 'Google AI Studio မှ အခမဲ့ Key ကို ထည့်သွင်းပြီး [Test Key] ဖြင့် တိုက်ရိုက် စမ်းသပ်စစ်ဆေးနိုင်ပါသည်။'
                    : 'Paste your Gemini API Key from Google AI Studio and test connectivity before activating.'}
                </p>
              </div>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold w-fit transition-colors shrink-0 shadow-md shadow-indigo-600/20"
              >
                <span>🔑 Get Key from Google AI Studio ↗</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Localized VPN Advisory Callout */}
            <div className="bg-amber-950/30 border border-amber-600/40 text-amber-200/90 text-[11px] rounded-lg p-2.5 mt-2 flex items-start sm:items-center gap-2 leading-relaxed">
              <span className="shrink-0">💡</span>
              <span>
                {language === 'my'
                  ? 'သတိပြုရန် - Google AI Studio သို့ ဝင်ရောက်၍ အခမဲ့ API Key ရယူရန် VPN (US, Singapore သို့မဟုတ် Japan စသည်) ကြိုတင်ဖွင့်ထားရန် လိုအပ်ပါသည်။ (Key ရရှိပြီးပါက ဤ Web App တွင် VPN မလိုဘဲ တိုက်ရိုက် အသုံးပြုနိုင်ပါသည်)။'
                  : 'Notice: Accessing Google AI Studio to generate a free API key requires a VPN connection (e.g., US, SG, or JP). Once obtained, the key works directly in this app.'}
              </span>
            </div>
          </div>

          {/* Card 1: Primary Gemini API Key */}
          <div className="p-4 rounded-xl bg-slate-900 border border-indigo-500/40 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="font-bold text-indigo-300 flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>Primary Gemini API Key (ပင်မ အင်ဂျင် — `akari_gemini_api_key_primary`)</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                value={geminiKeyInput}
                onChange={(e) => {
                  setGeminiKeyInput(e.target.value);
                  setPrimaryTestResult(null);
                }}
                placeholder="Paste Gemini API Key (AQ... or AIza...)"
                className="flex-1 px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleTestPrimaryKey}
                  disabled={isTestingPrimary || !geminiKeyInput.trim()}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-indigo-300 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <FlaskConical className={`w-3.5 h-3.5 ${isTestingPrimary ? 'animate-bounce' : ''}`} />
                  <span>🧪 Test Key (စစ်ဆေးမည်)</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveGeminiKey}
                  disabled={isTestingPrimary || !geminiKeyInput.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1.5 shadow-sm shadow-indigo-600/30"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>💾 Save &amp; Activate</span>
                </button>
              </div>
            </div>

            {/* Real-Time Test Feedback UI */}
            {isTestingPrimary && (
              <div className="p-3 rounded-xl bg-indigo-950/60 border border-indigo-500/40 text-indigo-200 flex items-center space-x-2 text-xs font-medium">
                <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
                <span>🔄 Google Server သို့ စမ်းသပ်ချိတ်ဆက်နေပါသည်...</span>
              </div>
            )}

            {!isTestingPrimary && primaryTestResult && primaryTestResult.success && (
              <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 space-y-1">
                <div className="font-bold flex items-center space-x-1.5 text-emerald-300">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>✅ API Key မှန်ကန်ပြီး တိုက်ရိုက်အသုံးပြုနိုင်ပါသည်</span>
                </div>
                <div className="text-[11px] text-emerald-300/90 pl-5">{primaryTestResult.message}</div>
              </div>
            )}

            {!isTestingPrimary && primaryTestResult && !primaryTestResult.success && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-200 font-medium">
                ❌ {primaryTestResult.message}
              </div>
            )}

            {/* Active Key Badge & Latency Status */}
            {primaryApiKey ? (
              <div className="flex items-center justify-between pt-1 text-[11px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-semibold">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      {primaryApiKey.slice(0, 8)}••••••••{primaryApiKey.slice(-4)} [ACTIVE]
                    </span>
                  </span>
                  {primarySavedLatency !== undefined && (
                    <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono text-[10px]">
                      ⚡ {primarySavedLatency}ms
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleRemoveGeminiKey}
                  className="text-slate-400 hover:text-rose-400 transition-colors font-semibold flex items-center space-x-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>🗑️ Remove</span>
                </button>
              </div>
            ) : (
              <div className="text-[11px] text-slate-500">
                (No primary key saved yet; paste your key above and click Test Key or Save &amp; Activate)
              </div>
            )}

            {geminiSaveFeedback && (
              <div className="text-[11px] text-emerald-400 font-semibold">{geminiSaveFeedback}</div>
            )}
          </div>

          {/* Card 2: Secondary Backup Gemini Key (Optional Failover) */}
          <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/30 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="font-bold text-emerald-300 flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Secondary Backup Key (အရန် Gmail Key — `akari_gemini_api_key_backup`)</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                300ms Auto-Failover
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                value={backupKeyInput}
                onChange={(e) => {
                  setBackupKeyInput(e.target.value);
                  setBackupTestResult(null);
                }}
                placeholder="Optional: Paste second Gmail Gemini Key (AQ... or AIza...)"
                className="flex-1 px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleTestBackupKey}
                  disabled={isTestingBackup || !backupKeyInput.trim()}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <FlaskConical className={`w-3.5 h-3.5 ${isTestingBackup ? 'animate-bounce' : ''}`} />
                  <span>🧪 Test Key</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveBackupKey}
                  disabled={isTestingBackup || !backupKeyInput.trim()}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>💾 Save Key</span>
                </button>
              </div>
            </div>

            {isTestingBackup && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 flex items-center space-x-2 text-xs font-medium">
                <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
                <span>🔄 Google Server သို့ စမ်းသပ်ချိတ်ဆက်နေပါသည်...</span>
              </div>
            )}

            {!isTestingBackup && backupTestResult && backupTestResult.success && (
              <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 space-y-1">
                <div className="font-bold flex items-center space-x-1.5 text-emerald-300">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>✅ API Key မှန်ကန်ပြီး တိုက်ရိုက်အသုံးပြုနိုင်ပါသည်</span>
                </div>
                <div className="text-[11px] text-emerald-300/90 pl-5">{backupTestResult.message}</div>
              </div>
            )}

            {!isTestingBackup && backupTestResult && !backupTestResult.success && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-200 font-medium">
                ❌ {backupTestResult.message}
              </div>
            )}

            {backupApiKey ? (
              <div className="flex items-center justify-between pt-1 text-[11px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-semibold">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      {backupApiKey.slice(0, 8)}••••••••{backupApiKey.slice(-4)} [ACTIVE]
                    </span>
                  </span>
                  {backupSavedLatency !== undefined && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono text-[10px]">
                      ⚡ {backupSavedLatency}ms
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleRemoveBackupKey}
                  className="text-slate-400 hover:text-rose-400 transition-colors font-semibold flex items-center space-x-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>🗑️ Remove</span>
                </button>
              </div>
            ) : (
              <div className="text-[11px] text-slate-500">
                (Optional: Add a second Gmail account key to guarantee zero downtime if Primary hits 429 quota)
              </div>
            )}

            {backupSaveFeedback && (
              <div className="text-[11px] text-emerald-400 font-semibold">{backupSaveFeedback}</div>
            )}
          </div>

          {/* Multi-Account Key Pool Management */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
                  <Database className="w-4 h-4 text-indigo-400" />
                  <span>Gemini Multi-Account Key Pool</span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  {language === 'my'
                    ? 'Account တစ်ခု Rate Limit ဖြစ်သွားပါက အခြား Account သို့ 300ms အတွင်း အလိုအလျောက် ရွှေ့ပြောင်းသုံးစွဲပါမည်။'
                    : 'Automatic round-robin & seamless 300ms failover across accounts on 429 rate limit.'}
                </p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {keyPool.length} Keys Configured
              </span>
            </div>

            {/* Add Key Form */}
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
              <div className="text-[11px] font-semibold text-slate-300">
                {language === 'my' ? 'Key အသစ် ထပ်ထည့်ရန် (Add Extra Key to Pool):' : 'Add Extra Key to Pool:'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)}
                  placeholder={language === 'my' ? 'အကောင့်အမည် (e.g., Account C)' : 'Account Label (e.g., Account C)'}
                  className="px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="password"
                  value={newKeyInput}
                  onChange={(e) => setNewKeyInput(e.target.value)}
                  placeholder="Paste Gemini API key (AQ... or AIza...)"
                  className="sm:col-span-2 px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-slate-400">
                  Client-side Web Crypto AES-256 encrypted · Never sent to third-party servers
                </span>
                <button
                  type="button"
                  onClick={handleAddKey}
                  disabled={isAddingKey || !newKeyInput.trim()}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-all cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAddingKey ? 'Verifying...' : 'Add Key'}</span>
                </button>
              </div>
              {keyAddFeedback && (
                <div
                  className={`p-2 rounded-lg text-xs border ${
                    keyAddFeedback.status === 'NORMAL'
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                  }`}
                >
                  {keyAddFeedback.message}
                </div>
              )}
            </div>

            {/* Pool Keys List */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {keyPool.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-center text-xs text-slate-500">
                  {language === 'my'
                    ? 'မည်သည့် Key မျှ မထည့်ရသေးပါ။ အခမဲ့ Server AI ကို အသုံးပြုနေပါသည်။'
                    : 'No personal keys configured. Utilizing shared server default AI.'}
                </div>
              ) : (
                keyPool.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white truncate">
                          {entry.label || `Account Key ${idx + 1}`}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${
                            entry.status === 'active'
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : entry.status === 'quota_exhausted'
                              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                              : 'bg-rose-500/15 text-red-400 border-rose-500/30'
                          }`}
                        >
                          {entry.status === 'active'
                            ? 'Active'
                            : entry.status === 'quota_exhausted'
                            ? '429 Rate Limited'
                            : 'Invalid'}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-400 mt-0.5 truncate">
                        {entry.key.substring(0, 8)}••••••••{entry.key.substring(entry.key.length - 4)}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => removeKeyFromPool(entry.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                        title="Remove key"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pool Status & Diagnostics */}
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2 text-slate-300">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  Pool Status: <strong>{poolHealthSummary.activeKeys}</strong> active /{' '}
                  <strong>{poolHealthSummary.totalKeys}</strong> keys
                </span>
              </div>
              <button
                type="button"
                onClick={() => checkPoolHealth()}
                disabled={isProbing || keyPool.length === 0}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isProbing ? 'Checking...' : 'Check All Keys'}
              </button>
            </div>
          </div>
        </div>

        {/* System Settings Hub: Active Non-Paid Gemini Auto-Cascade, Low-Bandwidth Mode, Encrypted Local Portfolio Backup */}
        <SystemSettingsHub onLowBandwidthChange={(enabled) => setDataSaverMode(enabled)} />

        {/* Public Computer Safety Notice */}
        <div className="flex items-start space-x-3 p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-amber-200 text-xs">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold">Public PC Safety:</span> When using school libraries or internet cafes, always click "Emergency Data Wipe" in the top bar before leaving.
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
          >
            {t.common.cancel}
          </button>
          <button
            onClick={handleSave}
            className="flex items-center space-x-2 px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/20"
          >
            {savedSuccess ? (
              <>
                <CheckCircle className="w-4 h-4 text-emerald-300" />
                <span>{language === 'my' ? 'သိမ်းဆည်းပြီးပါပြီ!' : 'Settings Saved!'}</span>
              </>
            ) : (
              <span>{t.common.save}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
