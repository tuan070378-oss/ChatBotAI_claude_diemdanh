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
      <main className="min-h-screen font-sans antialiased selection:bg-cyan-500/30 selection:text-cyan-800 dark:selection:text-cyan-200">
        <ChatInterface />
      </main>
    </ErrorBoundary>
  );
}

