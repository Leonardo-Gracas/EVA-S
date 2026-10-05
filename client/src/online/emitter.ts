type Listener = (...args: any[]) => void;

/** Emissor de eventos minimo, com a mesma cara do on/off/emit do socket.io. */
export class Emitter {
  private map = new Map<string, Set<Listener>>();

  on(event: string, fn: Listener): this {
    if (!this.map.has(event)) this.map.set(event, new Set());
    this.map.get(event)!.add(fn);
    return this;
  }

  off(event?: string, fn?: Listener): this {
    if (!event) this.map.clear();
    else if (!fn) this.map.delete(event);
    else this.map.get(event)?.delete(fn);
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    const set = this.map.get(event);
    if (!set || set.size === 0) return false;
    for (const fn of [...set]) {
      try { fn(...args); } catch (err) { console.error(`[EVA S] erro no listener de "${event}"`, err); }
    }
    return true;
  }
}
