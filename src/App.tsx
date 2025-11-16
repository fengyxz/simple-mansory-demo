import "./App.css";
import { NavLink, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { FullFetchPage } from "./pages/FullFetchPage";
import { VirtualScrollPage } from "./pages/VirtualScrollPage";
import { LayoutExplainPage } from "./pages/LayoutExplainPage";

function App() {
  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex px-28 flex-col gap-4  py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Supabase
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">
              FileKey Mapping Console
            </h1>
          </div>
          <nav className="flex gap-3 text-sm font-medium">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `rounded-lg px-4 py-2 ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`
              }
              end
            >
              表单与分页
            </NavLink>
            <NavLink
              to="/full-fetch"
              className={({ isActive }) =>
                `rounded-lg px-4 py-2 ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              Full Fetch 瀑布流
            </NavLink>
            <NavLink
              to="/virtual-scroll"
              className={({ isActive }) =>
                `rounded-lg px-4 py-2 ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              无限滚动列表
            </NavLink>
            <NavLink
              to="/layout-explain"
              className={({ isActive }) =>
                `rounded-lg px-4 py-2 ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              瀑布流&Grid说明
            </NavLink>
          </nav>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/full-fetch" element={<FullFetchPage />} />
        <Route path="/virtual-scroll" element={<VirtualScrollPage />} />
        <Route path="/layout-explain" element={<LayoutExplainPage />} />
      </Routes>
    </div>
  );
}

export default App;
