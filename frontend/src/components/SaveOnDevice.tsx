import { useAppStore } from '../store/appStore';
import { t } from '../lib/i18n';

/**
 * Opt-in "Save my profile on this device" with a visible "Delete my data" button.
 * Saving stores only the profile JSON in this browser (see lib/savedProfile.ts).
 */
export function SaveOnDevice() {
  const { lang, profile, saveOnDevice, savedProfile, storageBlocked, dataDeleted, setSaveOnDevice, deleteMyData } =
    useAppStore();

  return (
    <div className="w-full max-w-sm mx-auto mt-4 bg-white rounded-3xl shadow-md p-5">
      {profile && (
        <label className="touch-target flex items-center gap-3 cursor-pointer text-[#1a1a2e] font-semibold text-sm">
          <input
            type="checkbox"
            checked={saveOnDevice}
            onChange={(e) => setSaveOnDevice(e.target.checked)}
            className="h-6 w-6 accent-[#0d6e6e] flex-shrink-0"
          />
          {t(lang, 'saveOnDevice')}
        </label>
      )}
      <p className="text-xs text-[#5a6475] mt-1">🔒 {t(lang, 'saveOnDeviceNote')}</p>

      {savedProfile && (
        <button
          type="button"
          onClick={deleteMyData}
          className="touch-target mt-3 w-full rounded-2xl border-2 border-red-700 text-red-700 font-semibold text-sm px-4
            hover:bg-red-50 transition-colors"
        >
          {t(lang, 'deleteMyData')}
        </button>
      )}

      {(storageBlocked || dataDeleted) && (
        <p role="status" className={`text-xs mt-2 ${storageBlocked ? 'text-amber-800' : 'text-[#0d6e6e] font-semibold'}`}>
          {t(lang, storageBlocked ? 'storageBlocked' : 'dataDeleted')}
        </p>
      )}
    </div>
  );
}
