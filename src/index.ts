import { Plugin } from '@opencode/plugin';
import { install } from './install.js';

/**
 * OpenCode v2 server plugin entrypoint.
 *
 * The provider id is `moris`; loading this package adds nothing else to the
 * OpenCode catalog.
 */
export default Plugin.define({
  id: 'moris',
  async setup(ctx) {
    return install(ctx);
  },
});
