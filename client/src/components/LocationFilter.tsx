import React, { useState, useMemo } from 'react';
import { Check, X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Egyptian locations with hierarchical structure
const EGYPTIAN_LOCATIONS = [
  // New Cairo
  { name: 'التجمع الخامس', aliases: ['التجمع', '5th settlement', 'fifth settlement'], region: 'New Cairo' },
  { name: 'القاهرة الجديدة', aliases: ['new cairo', 'cairo new'], region: 'New Cairo' },
  { name: 'الرحاب', aliases: ['rehab', 'el rehab'], region: 'New Cairo' },
  { name: 'مدينتي', aliases: ['madinaty', 'madinty'], region: 'New Cairo' },
  
  // 6th October
  { name: 'الشيخ زايد', aliases: ['sheikh zayed', 'zayed'], region: '6th October' },
  { name: '6 اكتوبر', aliases: ['6 october', 'october', 'sixth october'], region: '6th October' },
  { name: 'الحصري', aliases: ['hosary', 'el hosary'], region: '6th October' },
  
  // Heliopolis
  { name: 'مصر الجديدة', aliases: ['heliopolis'], region: 'Heliopolis' },
  { name: 'مدينة نصر', aliases: ['nasr city'], region: 'Heliopolis' },
  { name: 'العباسية', aliases: ['abbasiya'], region: 'Heliopolis' },
  
  // Maadi
  { name: 'المعادي', aliases: ['maadi'], region: 'Maadi' },
  { name: 'دجلة', aliases: ['degla'], region: 'Maadi' },
  { name: 'الزهراء', aliases: ['zahraa'], region: 'Maadi' },
  
  // Downtown
  { name: 'الزمالك', aliases: ['zamalek'], region: 'Downtown' },
  { name: 'وسط البلد', aliases: ['downtown', 'داون تاون'], region: 'Downtown' },
  { name: 'جاردن سيتي', aliases: ['garden city'], region: 'Downtown' },
  { name: 'المنيل', aliases: ['manial'], region: 'Downtown' },
  
  // Giza
  { name: 'الجيزة', aliases: ['giza'], region: 'Giza' },
  { name: 'الهرم', aliases: ['haram'], region: 'Giza' },
  { name: 'فيصل', aliases: ['faisal'], region: 'Giza' },
  { name: 'الدقي', aliases: ['dokki'], region: 'Giza' },
  { name: 'المهندسين', aliases: ['mohandessin'], region: 'Giza' },
  
  // New Cities
  { name: 'العاصمة الادارية', aliases: ['new capital', 'administrative capital'], region: 'New Cities' },
  { name: 'الشروق', aliases: ['shorouk', 'el shorouk'], region: 'New Cities' },
  { name: 'بدر', aliases: ['badr', 'badr city'], region: 'New Cities' },
  { name: 'العبور', aliases: ['obour', 'el obour'], region: 'New Cities' },
  { name: 'العاشر من رمضان', aliases: ['10th of ramadan'], region: 'New Cities' },
  { name: 'المستقبل', aliases: ['mostakbal', 'mustaqbal'], region: 'New Cities' },
  
  // Coastal
  { name: 'الساحل الشمالي', aliases: ['north coast', 'sahel'], region: 'Coastal' },
  { name: 'العين السخنة', aliases: ['ain sokhna', 'sokhna'], region: 'Coastal' },
  { name: 'الاسكندرية', aliases: ['alexandria', 'alex'], region: 'Coastal' },
  
  // Other
  { name: 'المقطم', aliases: ['mokattam'], region: 'Other' },
  { name: 'حدائق الاهرام', aliases: ['hadayek ahram'], region: 'Other' },
  { name: 'حدائق اكتوبر', aliases: ['hadayek october'], region: 'Other' },
];

interface LocationFilterProps {
  selectedLocations: string[];
  onLocationsChange: (locations: string[]) => void;
  maxSelections?: number;
  showRegions?: boolean;
}

export function LocationFilter({
  selectedLocations,
  onLocationsChange,
  maxSelections = 10,
  showRegions = true,
}: LocationFilterProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Filter locations based on search
  const filteredLocations = useMemo(() => {
    if (!searchTerm) return EGYPTIAN_LOCATIONS;
    
    const lower = searchTerm.toLowerCase();
    return EGYPTIAN_LOCATIONS.filter(loc => 
      loc.name.toLowerCase().includes(lower) ||
      loc.aliases.some(alias => alias.toLowerCase().includes(lower)) ||
      loc.region.toLowerCase().includes(lower)
    );
  }, [searchTerm]);

  // Group by region if enabled
  const groupedLocations = useMemo(() => {
    if (!showRegions) return { all: filteredLocations };
    
    const grouped: Record<string, typeof EGYPTIAN_LOCATIONS> = {};
    filteredLocations.forEach(loc => {
      if (!grouped[loc.region]) grouped[loc.region] = [];
      grouped[loc.region].push(loc);
    });
    return grouped;
  }, [filteredLocations, showRegions]);

  const toggleLocation = (locationName: string) => {
    if (selectedLocations.includes(locationName)) {
      onLocationsChange(selectedLocations.filter(l => l !== locationName));
    } else if (selectedLocations.length < maxSelections) {
      onLocationsChange([...selectedLocations, locationName]);
    }
  };

  const clearAll = () => onLocationsChange([]);

  return (
    <div className="relative w-full">
      {/* Display selected locations */}
      <div className="mb-3">
        {selectedLocations.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedLocations.map(loc => (
              <div
                key={loc}
                className="flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm"
              >
                <span>{loc}</span>
                <button
                  onClick={() => toggleLocation(loc)}
                  className="hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No locations selected</p>
        )}
      </div>

      {/* Search and toggle button */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-3 text-muted-foreground" />
          <Input
            placeholder="Search locations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => setIsOpen(true)}
            className="pl-9"
          />
        </div>
        {selectedLocations.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearAll}
          >
            Clear All
          </Button>
        )}
      </div>

      {/* Dropdown list */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          {Object.entries(groupedLocations).map(([region, locations]) => (
            <div key={region}>
              {showRegions && region !== 'all' && (
                <div className="px-4 py-2 bg-muted text-sm font-semibold sticky top-0">
                  {region}
                </div>
              )}
              {locations.map(loc => (
                <button
                  key={loc.name}
                  onClick={() => toggleLocation(loc.name)}
                  className="w-full text-left px-4 py-2 hover:bg-muted flex items-center gap-2 transition-colors"
                >
                  <div
                    className={`w-4 h-4 border rounded flex items-center justify-center ${
                      selectedLocations.includes(loc.name)
                        ? 'bg-primary border-primary'
                        : 'border-muted-foreground'
                    }`}
                  >
                    {selectedLocations.includes(loc.name) && (
                      <Check size={14} className="text-primary-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{loc.name}</div>
                    {loc.aliases.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {loc.aliases.join(', ')}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ))}
          
          {filteredLocations.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No locations found
            </div>
          )}
        </div>
      )}

      {/* Close dropdown when clicking outside */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Selection info */}
      {selectedLocations.length > 0 && (
        <div className="text-xs text-muted-foreground mt-2">
          {selectedLocations.length} of {maxSelections} locations selected
        </div>
      )}
    </div>
  );
}
