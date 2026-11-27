// The clock and keyboard actions can update a mounted panel between route changes.
export function channel() {
  const listeners=new Set();
  return {
    subscribe(listener){ listeners.add(listener); return ()=>listeners.delete(listener); },
    publish(value){ for(const listener of listeners) listener(value); },
  };
}
export const marketQuotes=channel(), newspaperUpdates=channel(), chartReadouts=channel();
export const homeClockUpdates=channel();
