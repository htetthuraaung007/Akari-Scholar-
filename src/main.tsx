import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

export const APP_VERSION = 'v1.2.0';
const VERSION_STORAGE_KEY = 'akari_app_version';
const RELOAD_GUARD_KEY = `akari_reloaded_for_${APP_VERSION}`;

export async function purgeStaleCachesAndServiceWorkers(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(async (reg) => {
          try {
            if (reg.waiting) {
              reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
            await reg.unregister();
          } catch {
            // ignore individual unregister error
          }
        })
      );
    }
  } catch {
    // ignore serviceWorker lookup error
  }

  try {
    if ('caches' in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    }
  } catch {
    // ignore CacheStorage cleanup error
  }
}

async function runStartupVersionAndCacheGuard(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const storedVersion = window.localStorage.getItem(VERSION_STORAGE_KEY);
    if (storedVersion !== APP_VERSION) {
      window.localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);
      await purgeStaleCachesAndServiceWorkers();

      // If upgrading from a prior stored version, reload once cleanly so fresh assets are guaranteed
      if (storedVersion !== null && !window.sessionStorage.getItem(RELOAD_GUARD_KEY)) {
        window.sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
        window.location.reload();
        return;
      }
    }
  } catch (err) {
    console.warn('Version cache check warning:', err);
  }
}

function setupPwaAutoUpdater(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  try {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        window.dispatchEvent(
          new CustomEvent('akari_pwa_update_available', {
            detail: { updateSW },
          })
        );
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return;

        // Check for updates immediately and whenever the user focuses or foregrounds the app
        const checkUpdate = () => {
          registration.update().catch(() => {});
        };

        window.addEventListener('focus', checkUpdate);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            checkUpdate();
          }
        });

        // Also check periodically every 5 minutes
        setInterval(checkUpdate, 5 * 60 * 1000);
      },
    });
  } catch {
    // Fallback if virtual:pwa-register is unavailable in raw dev environment
  }
}

void runStartupVersionAndCacheGuard();
setupPwaAutoUpdater();

createRoot(document.getElementById('root')!).render(<App />);
