import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import AuthScreen from './screens/AuthScreen.jsx'
import InputScreen from './screens/InputScreen.jsx'
import LayoutPreviewScreen from './screens/LayoutPreviewScreen.jsx'
import WorkspaceScreen from './screens/WorkspaceScreen.jsx'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthScreen mode="login" />} />
      <Route path="/signup" element={<AuthScreen mode="signup" />} />
      <Route path="/" element={<ProtectedRoute><InputScreen /></ProtectedRoute>} />
      <Route path="/layout" element={<ProtectedRoute><LayoutPreviewScreen /></ProtectedRoute>} />
      <Route path="/workspace" element={<ProtectedRoute><WorkspaceScreen /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
