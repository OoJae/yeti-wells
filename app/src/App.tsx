import { Header } from "./components/Header";
import { Landing } from "./components/Landing";
import { ProjectCard } from "./components/ProjectCard";
import { ImpactNftCard } from "./components/ImpactNftCard";

export default function App() {
  return (
    <div className="min-h-screen">
      <Header />
      <Landing />
      <main className="mx-auto grid max-w-5xl items-start gap-6 px-4 pb-16 md:grid-cols-2">
        <ProjectCard />
        <ImpactNftCard />
      </main>
    </div>
  );
}
