import { Routes, Route, Navigate } from "react-router-dom";
import { Header } from "./components/Header";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { CampaignsBrowse } from "./pages/CampaignsBrowse";
import { ProjectDetail } from "./pages/ProjectDetail";
import { CreateCampaign } from "./pages/CreateCampaign";
import { DonorDashboard } from "./pages/DonorDashboard";

export default function App() {
  return (
    <div className="min-h-screen">
      <Header />
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<CampaignsBrowse />} />
          <Route path="/c/:projectId" element={<ProjectDetail />} />
          <Route path="/create" element={<CreateCampaign />} />
          <Route path="/me" element={<DonorDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        Yeti Wells · verifiable proof-of-impact giving on Sui · escrow released only on TEE-attested delivery
      </footer>
    </div>
  );
}
