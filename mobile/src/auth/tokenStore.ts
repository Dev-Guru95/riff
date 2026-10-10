// Where the session JWT lives on the device: the OS keystore (Keychain /
// Android Keystore) via expo-secure-store. See tokenStore.web.ts for previews.
import * as SecureStore from "expo-secure-store";

export const getToken = (key: string) => SecureStore.getItemAsync(key);
export const setToken = (key: string, value: string) => SecureStore.setItemAsync(key, value);
export const deleteToken = (key: string) => SecureStore.deleteItemAsync(key);
