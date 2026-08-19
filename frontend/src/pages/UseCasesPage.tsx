import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FilterBar } from '../components/usecases/FilterBar';
import { UseCaseCard } from '../components/usecases/UseCaseCard';
import { useNavigate } from 'react-router-dom';
import { useCases } from '../data/mockData';

const ACTIVE_USE_CASE_IDS = new Set([1, 2, 6, 9]);

export const UseCasesPage: React.FC = () => {
  const [activePillar, setActivePillar] = useState('all');
  const [activeType, setActiveType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const filtered = useCases.filter(u => {
    if (activePillar !== 'all' && u.pillar !== activePillar) return false;
    if (activeType !== 'all' && !u.tags.includes(activeType)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!u.title.toLowerCase().includes(q) && !u.desc.toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const activeUseCases = filtered.filter(useCase => ACTIVE_USE_CASE_IDS.has(useCase.id));
  const upcomingUseCases = filtered.filter(useCase => !ACTIVE_USE_CASE_IDS.has(useCase.id));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-[20px]">
        <div className="text-[11px] font-bold tracking-[1.2px] text-teal-deep uppercase mb-[6px]">
          23 Use Cases · 5 Strategic Pillars
        </div>
        <h2 className="font-head text-[24px] m-[0_0_6px] font-extrabold text-ink">
          Manufacturing Agentic AI Use-Case Library
        </h2>
        <p className="m-0 text-muted text-[13.5px] max-w-[720px] leading-relaxed">
          Every card below is a deployable module — click one to see the description, business impact, and the admin controls your team gets to configure it, per site.
        </p>
      </div>

      <FilterBar 
        activePillar={activePillar}
        setActivePillar={setActivePillar}
        activeType={activeType}
        setActiveType={setActiveType}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        resultCount={filtered.length}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[14px]">
        {activeUseCases.map(u => (
          <UseCaseCard 
            key={u.id} 
            useCase={u} 
            onClick={() => {
              if (u.id === 6) {
                navigate('/use-cases/executive-insights');
                return;
              }
              if (u.id === 9) {
                navigate('/use-cases/safety-site-intelligence');
                return;
              }
              navigate(`/use-cases/${u.id}`);
            }} 
          />
        ))}
      </div>

      {upcomingUseCases.length > 0 && (
        <section aria-labelledby="future-use-cases-heading">
          <hr className="my-9 border-0 border-t border-border-color" />
          <h3 id="future-use-cases-heading" className="font-head text-[18px] font-extrabold text-ink m-[0_0_16px]">
            Future Capabilities &amp; Coming Soon
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[14px]">
            {upcomingUseCases.map(u => (
              <UseCaseCard key={u.id} useCase={u} isComingSoon onClick={() => navigate(`/use-cases/${u.id}`)} />
            ))}
          </div>
        </section>
      )}

    </motion.div>
  );
};
