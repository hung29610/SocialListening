import PublicSiteShell from '@/components/public/PublicSiteShell';
/* ── HERO SLOT (Epic SIGNAL integration point) ─────────────────────
   W-B ships the real particle hero as
   `@/components/landing/hero/SignalHero` on its own branch.
   To mount it, change ONLY the next line to:
   import HeroSlot from '@/components/landing/hero/SignalHero';
   (props contract: state/EPIC_SIGNAL_WB_RESULT.md) */
import HeroSlot from '@/components/landing/HeroSlot';
import SourcesWall from '@/components/landing/SourcesWall';
import FeatureScenes from '@/components/landing/FeatureScenes';
import MetricsBand from '@/components/landing/MetricsBand';
import AICapabilities from '@/components/landing/AICapabilities';
import CompetitorScene from '@/components/landing/CompetitorScene';
import Testimonials from '@/components/landing/Testimonials';
import FinalCTA from '@/components/landing/FinalCTA';

export default function Home() {
  return (
    <PublicSiteShell>
      <HeroSlot />
      <SourcesWall />
      <FeatureScenes />
      <MetricsBand />
      <AICapabilities />
      <CompetitorScene />
      <Testimonials />
      <FinalCTA />
    </PublicSiteShell>
  );
}
