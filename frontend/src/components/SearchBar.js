// /components/SearchBar.js - Navigation Client avec filtres épurés et recherche
// Architecture modulaire Afroboost - Design minimaliste style globe

import { useState, useCallback, useEffect } from 'react';

// Icône de recherche SVG
const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

// Icône de fermeture SVG
const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

// Configuration des filtres - Style épuré
const FILTER_OPTIONS = [
  { id: 'all', label: 'Tout', icon: '🔥' },
  { id: 'sessions', label: 'Sessions', icon: '📅' },
  { id: 'offers', label: 'Offres', icon: '🎁' },
  { id: 'shop', label: 'Shop', icon: '🛍️' }
];

/**
 * Barre de navigation avec filtres épurés style globe et recherche textuelle
 * @param {Object} props
 * @param {string} props.activeFilter - Filtre actif ('all', 'sessions', 'offers', 'shop')
 * @param {Function} props.onFilterChange - Callback quand le filtre change
 * @param {string} props.searchQuery - Terme de recherche actuel
 * @param {Function} props.onSearchChange - Callback quand la recherche change
 * @param {boolean} props.showSearch - Afficher ou non la barre de recherche
 */
export const NavigationBar = ({ 
  activeFilter = 'all', 
  onFilterChange, 
  searchQuery = '', 
  onSearchChange,
  showSearch = true 
}) => {
  const [localSearch, setLocalSearch] = useState(searchQuery);
  
  // Debounce search input - filtrage en temps réel
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onSearchChange) {
        onSearchChange(localSearch);
      }
    }, 150); // Réduit pour un filtrage plus réactif
    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange]);

  // Synchroniser si la prop change de l'extérieur
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  const handleFilterClick = useCallback((filterId) => {
    if (onFilterChange) {
      onFilterChange(filterId);
      
      // Smooth scroll vers la section correspondante
      setTimeout(() => {
        let sectionId = null;
        if (filterId === 'sessions') {
          sectionId = 'sessions-section';
        } else if (filterId === 'offers' || filterId === 'shop') {
          sectionId = 'offers-section';
        }
        
        if (sectionId) {
          const element = document.getElementById(sectionId);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }, 100);
    }
  }, [onFilterChange]);

  const clearSearch = useCallback(() => {
    setLocalSearch('');
    if (onSearchChange) {
      onSearchChange('');
    }
  }, [onSearchChange]);

  return (
    <div className="navigation-bar mb-6" data-testid="navigation-bar">
      {/* Filtres épurés - Style minimaliste comme le bouton globe */}
      <div 
        className="filter-chips-container mb-4"
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          padding: '4px 0'
        }}
      >
        {FILTER_OPTIONS.map((filter) => (
          <button
            key={filter.id}
            onClick={() => handleFilterClick(filter.id)}
            data-testid={`filter-${filter.id}`}
            className={`filter-chip-minimal ${activeFilter === filter.id ? 'active' : ''}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: '500',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              // Style épuré : pas d'arrière-plan, bordure uniquement si actif
              backgroundColor: 'transparent',
              background: 'none',
              border: activeFilter === filter.id 
                ? '1.5px solid #d91cd2' 
                : '1.5px solid transparent',
              color: activeFilter === filter.id ? '#fff' : 'rgba(255, 255, 255, 0.7)',
              // Lueur néon subtile uniquement si actif
              boxShadow: activeFilter === filter.id 
                ? '0 0 12px rgba(217, 28, 210, 0.4)' 
                : 'none',
              // Reset button styles
              outline: 'none',
              WebkitAppearance: 'none',
              MozAppearance: 'none',
              appearance: 'none'
            }}
          >
            <span style={{ fontSize: '16px' }}>{filter.icon}</span>
            <span>{filter.label}</span>
          </button>
        ))}
      </div>

      {/* Barre de recherche avec bordure rose */}
      {showSearch && (
        <div 
          className="search-bar-container"
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: '500px',
            margin: '0 auto'
          }}
        >
          <div 
            style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'rgba(217, 28, 210, 0.6)',
              pointerEvents: 'none'
            }}
          >
            <SearchIcon />
          </div>
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Rechercher par titre..."
            data-testid="search-input"
            className="search-input-pink"
            style={{
              width: '100%',
              padding: '12px 40px 12px 44px',
              borderRadius: '12px',
              border: '1.5px solid #d91cd2',
              background: 'rgba(0, 0, 0, 0.4)',
              color: '#fff',
              fontSize: '14px',
              outline: 'none',
              transition: 'all 0.3s ease',
              boxShadow: '0 0 10px rgba(217, 28, 210, 0.2)'
            }}
          />
          {localSearch && (
            <button
              onClick={clearSearch}
              data-testid="clear-search"
              style={{
                position: 'absolute',
                right: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#d91cd2',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <CloseIcon />
            </button>
          )}
        </div>
      )}

      {/* Styles pour hover et focus */}
      <style>{`
        .filter-chip-minimal:hover {
          color: #fff !important;
          border-color: rgba(217, 28, 210, 0.5) !important;
        }
        .filter-chip-minimal.active:hover {
          border-color: #d91cd2 !important;
        }
        .search-input-pink:focus {
          border-color: #d91cd2 !important;
          box-shadow: 0 0 15px rgba(217, 28, 210, 0.4);
        }
        .search-input-pink::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }
      `}</style>
    </div>
  );
};

/**
 * Flèche animée pour indiquer du contenu en dessous
 * Apparaît si aucun scroll détecté après 3 secondes
 */
export const ScrollIndicator = ({ show }) => {
  if (!show) return null;
  
  return (
    <div 
      className="scroll-indicator"
      style={{
        position: 'fixed',
        bottom: '30px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        animation: 'bounce 2s infinite',
        opacity: 0.7,
        cursor: 'pointer'
      }}
      onClick={() => window.scrollBy({ top: 300, behavior: 'smooth' })}
      data-testid="scroll-indicator"
    >
      <svg 
        width="32" 
        height="32" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="#d91cd2" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      >
        <path d="M12 5v14M5 12l7 7 7-7"/>
      </svg>
      <style>{`
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% {
            transform: translateX(-50%) translateY(0);
          }
          40% {
            transform: translateX(-50%) translateY(-10px);
          }
          60% {
            transform: translateX(-50%) translateY(-5px);
          }
        }
      `}</style>
    </div>
  );
};

/**
 * Hook pour gérer l'indicateur de scroll
 * Affiche une flèche si aucun scroll après 3 secondes
 */
export const useScrollIndicator = () => {
  const [showIndicator, setShowIndicator] = useState(false);
  
  useEffect(() => {
    let hasScrolled = false;
    let timer = null;
    
    const handleScroll = () => {
      hasScrolled = true;
      setShowIndicator(false);
      // Retirer l'écouteur après le premier scroll
      window.removeEventListener('scroll', handleScroll);
      if (timer) clearTimeout(timer);
    };
    
    // Afficher l'indicateur après 3 secondes si pas de scroll
    timer = setTimeout(() => {
      if (!hasScrolled) {
        setShowIndicator(true);
      }
    }, 3000);
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timer) clearTimeout(timer);
    };
  }, []);
  
  return showIndicator;
};

/**
 * Hook pour gérer la logique de filtrage et recherche
 * @param {Array} offers - Liste des offres
 * @param {Array} courses - Liste des cours
 * @param {string} defaultSection - Section par défaut à afficher
 */
export const useNavigation = (offers = [], courses = [], defaultSection = 'all') => {
  const [activeFilter, setActiveFilter] = useState(defaultSection);
  const [searchQuery, setSearchQuery] = useState('');

  // Filtrer les offres selon le filtre actif et la recherche
  const filteredOffers = offers.filter(offer => {
    // Filtre par catégorie
    let categoryMatch = true;
    if (activeFilter === 'sessions') {
      categoryMatch = !offer.isProduct;
    } else if (activeFilter === 'offers') {
      // OFFRES = abonnements + sessions cardio (tous les non-produits)
      categoryMatch = !offer.isProduct;
    } else if (activeFilter === 'shop') {
      // SHOP = uniquement produits physiques
      categoryMatch = offer.isProduct === true;
    }

    // Filtre par recherche textuelle - TITRE UNIQUEMENT
    let searchMatch = true;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      searchMatch = (offer.name?.toLowerCase() || '').includes(query);
    }

    return categoryMatch && searchMatch;
  });

  // Filtrer les cours si nécessaire
  const filteredCourses = courses.filter(course => {
    // Shop masque les cours
    if (activeFilter === 'shop') {
      return false;
    }
    
    // Filtre par recherche textuelle - TITRE UNIQUEMENT
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      return (course.name?.toLowerCase() || '').includes(query);
    }
    
    return true;
  });

  // Déterminer quelle section scroller au chargement
  const getSectionToScroll = useCallback(() => {
    switch (activeFilter) {
      case 'sessions':
        return 'sessions-section';
      case 'offers':
      case 'shop':
        return 'offers-section';
      default:
        return null;
    }
  }, [activeFilter]);

  return {
    activeFilter,
    setActiveFilter,
    searchQuery,
    setSearchQuery,
    filteredOffers,
    filteredCourses,
    getSectionToScroll,
    hasResults: filteredOffers.length > 0 || filteredCourses.length > 0
  };
};

/**
 * Sélecteur de section d'atterrissage pour le Mode Coach
 * @param {Object} props
 * @param {string} props.value - Valeur actuelle
 * @param {Function} props.onChange - Callback au changement
 */
export const LandingSectionSelector = ({ value = 'sessions', onChange }) => {
  const options = [
    { id: 'sessions', label: '📅 Sessions', description: 'Les cours disponibles' },
    { id: 'offers', label: '🎁 Offres', description: 'Les cartes et abonnements' },
    { id: 'shop', label: '🛍️ Shop', description: 'Les produits physiques' }
  ];

  return (
    <div className="landing-section-selector" data-testid="landing-section-selector">
      <label className="block mb-2 text-white text-sm">📍 Section d'atterrissage par défaut</label>
      <select
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-lg neon-input"
        data-testid="landing-section-select"
        style={{
          background: 'rgba(0, 0, 0, 0.6)',
          border: '2px solid rgba(139, 92, 246, 0.4)',
          color: '#fff',
          cursor: 'pointer'
        }}
      >
        {options.map(option => (
          <option key={option.id} value={option.id}>
            {option.label} - {option.description}
          </option>
        ))}
      </select>
      <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
        Cette section sera affichée en premier lors du chargement de l'application côté client.
      </p>
    </div>
  );
};

// Export par défaut
export default NavigationBar;
