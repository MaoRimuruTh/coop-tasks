import { createContext, useContext } from './vendor/preact-htm.js';

export const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);
