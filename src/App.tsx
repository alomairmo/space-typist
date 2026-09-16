import { Routes, Route, Navigate, useParams } from 'react-router'
import Layout from '@/components/Layout'
import Home from '@/pages/Home'
import Arcade from '@/pages/Arcade'
import Game from '@/pages/Game'
import Levels from '@/pages/Levels'
import Placement from '@/pages/Placement'
import Custom from '@/pages/Custom'
import Settings from '@/pages/Settings'
import Results from '@/pages/Results'

/** إعادة توجيه /game/level/:id (من خريطة المراحل) إلى صيغة المقطع الواحد /game/level-:id */
function GameLevelRedirect() {
  const { id } = useParams()
  return <Navigate to={`/game/level-${id ?? '1'}`} replace />
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="arcade" element={<Arcade />} />
        <Route path="game/:mode" element={<Game />} />
        <Route path="game/level/:id" element={<GameLevelRedirect />} />
        <Route path="levels" element={<Levels />} />
        <Route path="placement" element={<Placement />} />
        <Route path="custom" element={<Custom />} />
        <Route path="settings" element={<Settings />} />
        <Route path="results" element={<Results />} />
      </Route>
    </Routes>
  )
}
