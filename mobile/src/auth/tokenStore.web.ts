// Web build only (local design previews): expo-secure-store has no web
// implementation, so fall back to sessionStorage. Never used on iOS/Android.
const store = () => (typeof window !== "undefined" ? window.sessionStorage : null);

export const getToken = async (key: string) => store()?.getItem(key) ?? null;
export const setToken = async (key: string, value: string) => store()?.setItem(key, value);
export const deleteToken = async (key: string) => store()?.removeItem(key);
