import { Routes, Route } from 'react-router-dom'
import InputScreen from './screens/InputScreen.jsx'
import LayoutPreviewScreen from './screens/LayoutPreviewScreen.jsx'
import WorkspaceScreen from './screens/WorkspaceScreen.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<InputScreen />} />
      <Route path="/layout" element={<LayoutPreviewScreen />} />
      <Route path="/workspace" element={<WorkspaceScreen />} />
    </Routes>
  )
}

export default App
