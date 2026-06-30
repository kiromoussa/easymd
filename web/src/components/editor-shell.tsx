'use client';

import { LiveblocksProvider } from '@liveblocks/react';
import { useEffect } from 'react';
import { DemoEditor } from '@/components/demo-editor';
import { capture } from '@/lib/analytics';

/**
 * Client boundary for the editor: `LiveblocksProvider` relies on React context,
 * so it can't be imported into the (server) editor page directly. The server page
 * resolves the target room, then hands it to this wrapper.
 */
export function EditorShell({ initialDoc }: { initialDoc: string }) {
  useEffect(() => {
    capture('document_opened', { is_welcome: initialDoc.endsWith('__welcome') });
  }, [initialDoc]);

  return (
    <LiveblocksProvider authEndpoint="/api/liveblocks-auth">
      <DemoEditor initialDoc={initialDoc} />
    </LiveblocksProvider>
  );
}
