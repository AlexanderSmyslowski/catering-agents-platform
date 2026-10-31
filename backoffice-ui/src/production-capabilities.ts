import { createContext } from "react";

// Missing capabilities from an older server are intentionally disabled.
export const ProductionSplitCapability = createContext(false);
