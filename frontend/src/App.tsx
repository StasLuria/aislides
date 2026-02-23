/**
 * App — корневой компонент приложения.
 *
 * Отображает основной layout с тремя зонами:
 * sidebar, chat, artifacts (по PRD 5.2).
 */
import { AppLayout } from './components/layout'

function App() {
  return (
    <AppLayout
      sidebarContent={
        <div className="p-4 text-sm text-gray-400">
          Проекты появятся здесь
        </div>
      }
      chatContent={
        <div className="flex items-center justify-center flex-1 text-gray-400">
          Напишите сообщение, чтобы начать
        </div>
      }
    />
  )
}

export default App
