import { cleanup } from '@testing-library/preact';
import { afterEach } from 'vitest';

afterEach(cleanup);

// happy-dom never loads pictures yet calls each one complete, which reads as a picture the browser gave up on. In a
// browser a picture just put on the page is still on its way: tests see it that way.
Object.defineProperty(HTMLImageElement.prototype, 'complete', { configurable: true, get: () => false });
