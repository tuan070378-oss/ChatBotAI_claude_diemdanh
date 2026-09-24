/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import ChatInterface from './components/ChatInterface';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <main className="min-h-screen font-sans antialiased selection:bg-fire-2/30 selection:text-fire-1 dark:selection:text-fire-2">
        <ChatInterface />
      </main>
    </ErrorBoundary>
  );
}