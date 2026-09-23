import { useEffect, useState } from "react";
import type { Dataset } from "@shared/types";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; dataset: Dataset };

// Loads the baked dataset. Prefers the full dataset.json; falls back to the
// tiny sample so the app still runs before a full build has been committed.
export function useDataset(): State {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let alive = true;
    (async () => {
      for (const url of ["data/dataset.json", "data/dataset.sample.json"]) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const dataset = (await res.json()) as Dataset;
          if (alive) setState({ status: "ready", dataset });
          return;
        } catch {
          /* try next */
        }
      }
      if (alive) setState({ status: "error", message: "No dataset found. Run npm run build:dataset." });
    })();
    return () => {
      alive = false;
    };
  }, []);

  return state;
}
