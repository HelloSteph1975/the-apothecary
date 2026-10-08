import { createContext, useContext } from 'react';
import { useApi } from '../lib/useApi.js';

const Ctx = createContext({ settings: null, reload: () => {} });
export const useSettings = () => useContext(Ctx);

export function SettingsProvider({ children }) {
  const { data, reload } = useApi('/api/settings');
  return <Ctx.Provider value={{ settings: data, reload }}>{children}</Ctx.Provider>;
}
