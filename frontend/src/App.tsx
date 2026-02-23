/**
 * App — корневой компонент приложения.
 *
 * Отображает основной layout с тремя зонами:
 * sidebar, chat, artifacts (будет реализовано в задаче 6.2).
 */
function App() {
  return (
    <div className="flex h-screen bg-gray-50 text-gray-900">
      <div className="flex items-center justify-center w-full">
        <h1 className="text-2xl font-bold text-blue-600">
          AI Presentation Generator
        </h1>
      </div>
    </div>
  )
}

export default App
