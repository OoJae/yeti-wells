import { Header } from "./components/Header";
import { Landing } from "./components/Landing";
import { ProjectCard } from "./components/ProjectCard";
import { ImpactNftCard } from "./components/ImpactNftCard";
import { EvidenceGallery } from "./components/EvidenceGallery";
import { StewardPanel } from "./components/StewardPanel";

const isSteward =
  typeof window !== "undefined" && new URLSearchParams(window.location.search).get("steward") === "1";

export default function App() {
  return (
    <div className="min-h-screen">
      <Header />
      <Landing />
      <main className="mx-auto max-w-5xl space-y-6 px-4 pb-16">
        <div className="grid items-start gap-6 md:grid-cols-2">
          <ProjectCard />
          <ImpactNftCard />
        </div>
        <EvidenceGallery />
        {isSteward && <StewardPanel />}
      </main>
    </div>
  );
}
