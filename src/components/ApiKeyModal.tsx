import React, { useState, useEffect } from 'react';
import {
  X,
  Cpu,
  CheckCircle2,
  Sparkles,
  Server,
  Key,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Globe,
  User
} from 'lucide-react';
import {
  getAdminSelectedModel,
  setAdminSelectedModel,
  getPersonalApiKey,
  setPersonalApiKey,
  testGeminiLatency
} from '../services/geminiService';
import { auth, db } from '../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getCurrentAccessContext } from '../services/permissionService';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
  const [personalKey, setPersonalKey] = useState(() => getPersonalApiKey());
  const [globalKey, setGlobalKey] = useState('');
  const [selectedModel, setSelectedModel] = useState(() => getAdminSelectedModel() || 'gemini-4-hydrogen');
  const [isLoadingGlobal, setIsLoadingGlobal] = useState(false);
  const [isSavingGlobal, setIsSavingGlobal] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  const accessContext = getCurrentAccessContext();
  const isAdmin = accessContext.isAdmin;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    if (isOpen) {
      setPersonalKey(getPersonalApiKey());
      setSelectedModel(getAdminSelectedModel() || 'gemini-4-hydrogen');
      fetchGlobalConfig();
    }
  }, [isOpen]);

  const fetchGlobalConfig = async () => {
    setIsLoadingGlobal(true);
    try {
      const configRef = doc(db, 'system_settings', 'gemini_config');
      const snap = await getDoc(configRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data?.globalApiKey) {
          setGlobalKey(data.globalApiKey);
        }
        if (data?.selectedModel && !getAdminSelectedModel()) {
          setSelectedModel(data.selectedModel);
        }
      }
    } catch (err) {
      console.warn('Could not fetch global gemini config from Firestore:', err);
    } finally {
      setIsLoadingGlobal(false);
    }
  };

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      if (personalKey) {
        setPersonalApiKey(personalKey);
      }
      setAdminSelectedModel(selectedModel);

      const result = await testGeminiLatency();
      if (result.status === 'online') {
        setTestResult({
          success: true,
          message: `Kết nối thành công! Độ trễ: ${result.latencyMs}ms (${result.modelName})`
        });
      } else {
        setTestResult({
          success: false,
          message: result.message || 'Kết nối thất bại. Vui lòng kiểm tra lại API Key.'
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Lỗi kiểm tra kết nối API.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveGlobalFirestore = async () => {
    if (!isAdmin) {
      showToast('⚠️ Chỉ tài khoản Admin mới có quyền lưu cấu hình Global trên Firestore!');
      return;
    }
    if (!auth.currentUser || auth.currentUser.isAnonymous) {
      showToast('⚠️ Cần đăng nhập tài khoản Admin thực tế để lưu Global Firestore!');
      return;
    }

    setIsSavingGlobal(true);
    try {
      const configRef = doc(db, 'system_settings', 'gemini_config');
      await setDoc(configRef, {
        globalApiKey: globalKey.trim(),
        selectedModel: selectedModel,
        updatedAt: new Date().toISOString(),
        updatedBy: auth.currentUser.email || 'admin'
      }, { merge: true });

      showToast('✨ Đã lưu cấu hình Global Key & Mô hình lên Firestore thành công!');
    } catch (err: any) {
      console.error('Error saving global config:', err);
      showToast(`Lỗi lưu Global Firestore: ${err?.message || err}`);
    } finally {
      setIsSavingGlobal(false);
    }
  };

  const handleSavePersonalConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setPersonalApiKey(personalKey);
    setAdminSelectedModel(selectedModel);
    setIsSaved(true);
    showToast('💾 Đã lưu cấu hình cá nhân thành công!');
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col max-h-[90vh]">
        {/* Header - Professional gradient blue-purple */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-700 text-white shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
              <Cpu className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold font-heading">Cấu Hình Google Gemini API Key</h3>
                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-950 bg-emerald-300 px-2 py-0.5 rounded-full shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Live API
                </span>
              </div>
              <p className="text-xs text-indigo-100 font-medium">
                Quản lý thứ tự ưu tiên API Key và lựa chọn mô hình AI cho toàn trường
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSavePersonalConfig} className="p-6 space-y-5 overflow-y-auto text-sm flex-1">
          {toastMessage && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Model Selection */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                <Sparkles className="w-4 h-4 text-purple-600" /> Mô hình AI (Gemini Model)
              </label>
              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200">
                Hiện tại: {selectedModel}
              </span>
            </div>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium bg-white focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 cursor-pointer shadow-2xs"
            >
              <option value="auto">🤖 Tự động ưu tiên (Auto-Prioritized Engine)</option>
              <option value="gemini-4-hydrogen">gemini-4-hydrogen (Mặc định cao cấp - Nhanh & ổn định)</option>
              <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Flash Lite siêu tốc)</option>
              <option value="gemini-2.5-flash">gemini-2.5-flash (Flash đa nhiệm)</option>
              <option value="gemini-2.5-pro">gemini-2.5-pro (Pro chuyên sâu phân tích)</option>
              <option value="gemini-3-flash-preview">gemini-3-flash-preview (Bản xem trước mới nhất)</option>
            </select>
            <p className="text-[11px] text-slate-500">
              Lựa chọn này sẽ áp dụng cho tất cả các tính năng AI (chấm bài, tạo đề, trợ lý ảo 5E) trong ứng dụng.
            </p>
          </div>

          {/* Fallback Chain Info & Inputs */}
          <div className="space-y-4">
            <div className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-4 h-4 text-indigo-600" />
              <span>Thứ tự ưu tiên lấy API Key (Fallback Chain):</span>
            </div>

            {/* Priority 1: Personal Key */}
            <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-600" /> Ưu tiên 1: Khóa cá nhân (Personal API Key)
                </label>
                <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
                  Lưu trên máy bạn (localStorage)
                </span>
              </div>
              <input
                type="password"
                value={personalKey}
                onChange={(e) => setPersonalKey(e.target.value)}
                placeholder="Dán khóa AIzaSy... cá nhân của bạn vào đây"
                className="w-full px-3.5 py-2 rounded-xl border border-indigo-200 text-xs bg-white focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 font-mono"
              />
              <p className="text-[10px] text-indigo-600/80">
                Chỉ được dùng cho phiên làm việc trên trình duyệt của riêng bạn. Nếu trống, hệ thống sẽ tự động dùng Ưu tiên 2.
              </p>
            </div>

            {/* Priority 2: Global Key (Admin) */}
            <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-purple-600" /> Ưu tiên 2: Khóa dùng chung toàn trường (Global API Key)
                </label>
                <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                  {isAdmin ? 'Quyền Admin: Được phép chỉnh sửa' : 'Chỉ Admin chỉnh sửa'}
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={globalKey}
                  onChange={(e) => setGlobalKey(e.target.value)}
                  disabled={!isAdmin}
                  placeholder={isLoadingGlobal ? "Đang tải từ Firestore..." : "AIzaSy... (Dùng chung cho toàn trường)"}
                  className="w-full px-3.5 py-2 rounded-xl border border-purple-200 text-xs bg-white focus:ring-2 focus:ring-purple-500 outline-none text-slate-900 font-mono disabled:bg-slate-100 disabled:text-slate-500"
                />
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleSaveGlobalFirestore}
                    disabled={isSavingGlobal}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
                  >
                    {isSavingGlobal ? 'Đang lưu...' : 'Lưu Global Firestore'}
                  </button>
                )}
              </div>
              <p className="text-[10px] text-purple-600/85">
                Được lưu tập trung trên Cloud Firestore (`system_settings/gemini_config`) để toàn bộ giáo viên và học sinh dùng chung khi thi cử hoặc trình diễn.
              </p>
            </div>

            {/* Priority 3: Env fallback notice */}
            <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center gap-2.5 text-xs text-slate-600">
              <Server className="w-4 h-4 text-slate-500 shrink-0" />
              <div>
                <strong className="text-slate-800 font-semibold">Ưu tiên 3 (Dự phòng môi trường):</strong> Tự động dùng biến môi trường máy chủ (`GEMINI_API_KEY`) nếu 2 khóa trên không được cấu hình.
              </div>
            </div>
          </div>

          {/* Test connection result banner */}
          {testResult && (
            <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2.5 ${
              testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Action Footer inside form */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer border border-slate-300"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  <span>Đang kiểm tra...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Kết Nối & Đánh Giá</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium text-xs transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                {isSaved ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-white" />
                    <span>Đã lưu cấu hình!</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Lưu Cấu Hình</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
