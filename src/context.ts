import { createContext, useContext } from "react";
import type { LiquidMoveOptions } from "./types";

export type LiquidRegistration = {
  update: (move?: LiquidMoveOptions) => void;
  dispose: () => void;
};

export type LiquidApi = {
  attach: (host: HTMLElement, move?: LiquidMoveOptions) => LiquidRegistration;
  wake: () => void;
};

export const LiquidContext = createContext<LiquidApi | null | undefined>(undefined);

export function useLiquidApi() {
  const api = useContext(LiquidContext);
  if (api === undefined) {
    throw new Error("Liquid.Item must be rendered inside Liquid.");
  }
  return api;
}
