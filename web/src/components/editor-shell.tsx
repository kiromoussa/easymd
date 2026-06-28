'use client';

import { LiveblocksProvider } from '@liveblocks/react';
import { DemoEditor } from '@/components/demo-editor';

/**
 * Client boundary for the editor: `LiveblocksProvider` relies on React context,
 * so it can't be imported into the (server) editor page directly. The server page
 * resolves the target room, then hands it to this wrapper.
 */
export function EditorShell({ initialDoc }: { initialDoc: string }) {
  return (
    <LiveblocksProvider authEndpoint="/api/liveblocks-auth">
      <DemoEditor initialDoc={initialDoc} />
    </LiveblocksProvider>
  );
}
