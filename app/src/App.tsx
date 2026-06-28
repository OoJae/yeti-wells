import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Header } from "./components/Header";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Landing } from "./pages/Landing";
import { CampaignsBrowse } from "./pages/CampaignsBrowse";
import { ProjectDetail } from "./pages/ProjectDetail";
import { CreateCampaign } from "./pages/CreateCampaign";
import { DonorDashboard } from "./pages/DonorDashboard";

export default function App() {
  // The Landing page is self-contained (its own marketing header + footer); app pages share the chrome below.
  const isLanding = useLocation().pathname === "/";
  return (
    <div className="min-h-screen">
      {!isLanding && <Header />}
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/campaigns" element={<CampaignsBrowse />} />
          <Route path="/c/:projectId" element={<ProjectDetail />} />
          <Route path="/create" element={<CreateCampaign />} />
          <Route path="/me" element={<DonorDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
      {!isLanding && (
        <footer className="border-t border-border px-4 py-6 text-center font-mono text-[11px] tracking-[0.08em] text-dim2">
          EVERY DROP, PROVABLE · MOVE · zkLOGIN · ENOKI · WALRUS · NAUTILUS · TESTNET
        </footer>
      )}
    </div>
  );
}
