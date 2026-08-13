import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FilterBar } from '../components/usecases/FilterBar';
import { UseCaseCard } from '../components/usecases/UseCaseCard';
import { useNavigate } from 'react-router-dom';
import { useCases } from '../data/mockData';

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
        {filtered.map(u => (
          <UseCaseCard 
            key={u.id} 
            useCase={u} 
            onClick={() => navigate(`/use-cases/${u.id}`)} 
          />
        ))}
      </div>


    </motion.div>
  );
};
