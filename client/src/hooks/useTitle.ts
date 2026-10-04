import { useEffect } from 'react';

export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `EVA S — ${title}` : 'EVA S';
    return () => { document.title = 'EVA S'; };
  }, [title]);
}
