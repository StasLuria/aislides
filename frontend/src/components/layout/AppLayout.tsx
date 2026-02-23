/**
 * AppLayout — основной layout приложения.
 *
 * По PRD 5.2: три зоны — sidebar (слева), chat (центр), artifacts (справа).
 * Панель артефактов показывается/скрывается по требованию.
 */

import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { ChatPanel } from './ChatPanel'
import { ArtifactPanel } from './ArtifactPanel'

interface AppLayoutProps {
  /** Содержимое sidebar (ProjectList). */
  sidebarContent?: React.ReactNode
  /** Содержимое чата (ChatMessage[], StatusCard, ChatInput). */
  chatContent?: React.ReactNode
  /** Содержимое панели артефактов. */
  artifactContent?: React.ReactNode
}

export function AppLayout({
  sidebarContent,
  chatContent,
  artifactContent,
}: AppLayoutProps) {
  const [isArtifactPanelOpen, setIsArtifactPanelOpen] = useState(false)

  return (
    <div data-testid="app-layout" className="flex h-screen overflow-hidden">
      <Sidebar>{sidebarContent}</Sidebar>
      <ChatPanel>{chatContent}</ChatPanel>
      <ArtifactPanel
        isOpen={isArtifactPanelOpen}
        onClose={() => setIsArtifactPanelOpen(false)}
      >
        {artifactContent}
      </ArtifactPanel>
    </div>
  )
}
