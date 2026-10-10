import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

// Vitest runs without globals, so Testing Library can't register its own cleanup.
afterEach(() => cleanup());

// A busy machine can make async finds slow; wait longer before calling it a failure.
configure({ asyncUtilTimeout: 5000 });
