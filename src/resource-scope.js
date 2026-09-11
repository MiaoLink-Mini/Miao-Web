/** Tracks ownership as resources are allocated, including before scene attachment.
 * Cleanup is idempotent, runs in reverse allocation order and attempts every entry.
 */
export class ResourceScope {
  constructor() { this.resources = new Set(); this.cleanups = []; this.disposed = false; }
  defer(cleanup) {
    if (typeof cleanup !== 'function') throw new TypeError('Cleanup must be a function');
    if (this.disposed) cleanup(); else this.cleanups.push(cleanup);
    return cleanup;
  }
  track(resource) {
    if (!resource || typeof resource.dispose !== 'function') throw new TypeError('Resource must have dispose()');
    if (this.disposed) { resource.dispose(); return resource; }
    if (!this.resources.has(resource)) {
      this.resources.add(resource);
      this.defer(() => { if (this.resources.delete(resource)) resource.dispose(); });
    }
    return resource;
  }
  release(resource) { if (this.resources.delete(resource)) resource.dispose(); }
  dispose() {
    if (this.disposed) return [];
    this.disposed = true;
    const errors = [];
    for (const cleanup of this.cleanups.reverse()) { try { cleanup(); } catch (error) { errors.push(error); } }
    this.cleanups.length = 0; this.resources.clear();
    return errors;
  }
}
