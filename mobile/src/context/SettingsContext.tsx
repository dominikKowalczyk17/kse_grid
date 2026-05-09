import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVER_URL_KEY = 'kse_grid:server_url';
const DEFAULT_SERVER_URL = 'http://127.0.0.1:8050';

interface SettingsContextValue {
  serverUrl: string;
  setServerUrl: (url: string) => Promise<void>;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextValue>({
  serverUrl: DEFAULT_SERVER_URL,
  setServerUrl: async () => {},
  isLoading: true,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [serverUrl, setServerUrlState] = useState(DEFAULT_SERVER_URL);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(SERVER_URL_KEY)
      .then((stored) => {
        if (stored) setServerUrlState(stored);
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function setServerUrl(url: string) {
    const cleaned = url.replace(/\/$/, '');
    setServerUrlState(cleaned);
    await AsyncStorage.setItem(SERVER_URL_KEY, cleaned);
  }

  return (
    <SettingsContext.Provider value={{ serverUrl, setServerUrl, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
