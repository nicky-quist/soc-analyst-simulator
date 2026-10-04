// Current time, re-read on an interval. Call it in the smallest component that shows a timer,
// so only that component re-renders on each tick.

import { useEffect, useState } from 'react';

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
