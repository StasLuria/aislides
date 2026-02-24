/**
 * AppLayout — основной layout приложения.
 *
 * По PRD 5.2: три зоны — sidebar (слева), chat (центр), artifacts (справа).
 * Панель артефактов показывается/скрывается по требованию.
 */

import { Sidebar } from './Sidebar'
import { ChatPanel } from './ChatPanel'
import { ArtifactPanel } from './ArtifactPanel'
import type { ArtifactData } from '../../types'

interface AppLayoutProps {
  /** Содержимое sidebar (ProjectList). */
  sidebarContent?: React.ReactNode
  /** Содержимое чата (ChatMessage[], StatusCard, ChatInput). */
  chatContent?: React.ReactNode
  /** Содержимое панели артефактов. */
  artifactContent?: React.ReactNode
  /** Управление видимостью панели артефактов (внешнее). */
  isArtifactPanelOpen?: boolean
  /** Callback закрытия панели артефактов. */
  onArtifactPanelClose?: () => void
  /** Текущий артефакт. */
  currentArtifact?: ArtifactData | null
  /** Все артефакты. */
  artifacts?: ArtifactData[]
  /** Callback выбора артефакта. */
  onSelectArtifact?: (artifact: ArtifactData) => void
  /** Callback скачивания. */
  onDownload?: (artifact: ArtifactData) => void
  /** Callback открытия в новой вкладке. */
  onOpenNewTab?: (artifact: ArtifactData) => void
}

export function AppLayout({
  sidebarContent,
  chatContent,
  artifactContent,
  isArtifactPanelOpen = false,
  onArtifactPanelClose = () => {},
  currentArtifact,
  artifacts = [],
  onSelectArtifact,
  onDownload,
  onOpenNewTab,
}: AppLayoutProps) {
  return (
    <div data-testid="app-layout" className="flex h-screen overflow-hidden">
      <Sidebar>{sidebarContent}</Sidebar>
      <ChatPanel>{chatContent}</ChatPanel>
      <ArtifactPanel
        isOpen={isArtifactPanelOpen}
        onClose={onArtifactPanelClose}
        artifact={currentArtifact}
        artifacts={artifacts}
        onSelectArtifact={onSelectArtifact}
        onDownload={onDownload}
        onOpenNewTab={onOpenNewTab}
      >
        {artifactContent}
      </ArtifactPanel>
    </div>
  )
}
