// =============================================================================
// MCC Industry Classification Tree
// =============================================================================
// Full MCC-based industry list with each sub-industry mapped to one of the 44
// diagnostic slugs used by the scoring engine. The UI presents the full tree;
// the engine only sees the diagnostic slug.
// =============================================================================

import type { Industry } from '@/types/diagnostic';

export interface MCCSubcategory {
  label: string;
  diagnosticSlug: Industry;
}

export interface MCCCategory {
  name: string;
  defaultSlug: Industry;
  subcategories: MCCSubcategory[];
}

export const MCC_INDUSTRY_TREE: MCCCategory[] = [
  {
    name: 'Financial Services',
    defaultSlug: 'banking',
    subcategories: [
      { label: 'Banking & Depository Institutions', diagnosticSlug: 'banking' },
      { label: 'Credit Card & Payment Processing', diagnosticSlug: 'capital_markets' },
      { label: 'ATM & Cash Services', diagnosticSlug: 'banking' },
      { label: 'Money Transfer & Remittance', diagnosticSlug: 'banking' },
      { label: 'Digital Currency & Stored Value', diagnosticSlug: 'capital_markets' },
      { label: 'Securities Brokers & Dealers', diagnosticSlug: 'capital_markets' },
      { label: 'Investment Advisory Services', diagnosticSlug: 'asset_wealth_management' },
      { label: 'Asset & Wealth Management', diagnosticSlug: 'asset_wealth_management' },
      { label: 'Insurance Sales & Underwriting', diagnosticSlug: 'insurance' },
    ],
  },
  {
    name: 'Professional & Business Services',
    defaultSlug: 'consulting_services',
    subcategories: [
      { label: 'Management Consulting', diagnosticSlug: 'consulting_services' },
      { label: 'Business Services (General)', diagnosticSlug: 'consulting_services' },
      { label: 'Advertising & Marketing Services', diagnosticSlug: 'media_entertainment' },
      { label: 'Public Relations', diagnosticSlug: 'media_entertainment' },
      { label: 'Market Research & Analytics', diagnosticSlug: 'consulting_services' },
      { label: 'Employment & Staffing Services', diagnosticSlug: 'consulting_services' },
      { label: 'Executive Search', diagnosticSlug: 'consulting_services' },
      { label: 'Credit Reporting & Collections', diagnosticSlug: 'banking' },
      { label: 'Security & Investigation Services', diagnosticSlug: 'industrial_services' },
      { label: 'Facilities Management', diagnosticSlug: 'industrial_services' },
      { label: 'Cleaning & Maintenance Services', diagnosticSlug: 'industrial_services' },
      { label: 'Pest Control Services', diagnosticSlug: 'industrial_services' },
      { label: 'Photography & Creative Services', diagnosticSlug: 'media_entertainment' },
      { label: 'Printing & Copying Services', diagnosticSlug: 'industrial_services' },
    ],
  },
  {
    name: 'Technology & Digital Services',
    defaultSlug: 'software_saas',
    subcategories: [
      { label: 'Software Development & Programming', diagnosticSlug: 'software_saas' },
      { label: 'IT Consulting Services', diagnosticSlug: 'it_services' },
      { label: 'Data Processing & Hosting', diagnosticSlug: 'it_services' },
      { label: 'Cloud & Infrastructure Services', diagnosticSlug: 'it_services' },
      { label: 'Computer Maintenance & Repair', diagnosticSlug: 'hardware_electronics' },
      { label: 'Telecommunications Services', diagnosticSlug: 'telecommunications' },
      { label: 'Internet Service Providers', diagnosticSlug: 'telecommunications' },
      { label: 'Network Services', diagnosticSlug: 'telecommunications' },
      { label: 'Cable, Satellite & Streaming', diagnosticSlug: 'media_entertainment' },
      { label: 'Digital Media & Content Platforms', diagnosticSlug: 'media_entertainment' },
    ],
  },
  {
    name: 'Construction & Contracting',
    defaultSlug: 'construction_engineering',
    subcategories: [
      { label: 'General Contractors (Residential)', diagnosticSlug: 'construction_engineering' },
      { label: 'General Contractors (Commercial)', diagnosticSlug: 'construction_engineering' },
      { label: 'Electrical Contractors', diagnosticSlug: 'construction_engineering' },
      { label: 'HVAC Services', diagnosticSlug: 'construction_engineering' },
      { label: 'Plumbing Contractors', diagnosticSlug: 'construction_engineering' },
      { label: 'Masonry & Stonework', diagnosticSlug: 'construction_engineering' },
      { label: 'Carpentry & Woodwork', diagnosticSlug: 'construction_engineering' },
      { label: 'Roofing & Siding', diagnosticSlug: 'construction_engineering' },
      { label: 'Concrete Work', diagnosticSlug: 'construction_engineering' },
      { label: 'Excavation & Site Preparation', diagnosticSlug: 'construction_engineering' },
      { label: 'Specialized Trade Contractors', diagnosticSlug: 'construction_engineering' },
    ],
  },
  {
    name: 'Real Estate & Property',
    defaultSlug: 'real_estate_commercial',
    subcategories: [
      { label: 'Real Estate Sales & Brokerage', diagnosticSlug: 'real_estate_commercial' },
      { label: 'Property Management', diagnosticSlug: 'real_estate_commercial' },
      { label: 'Real Estate Development', diagnosticSlug: 'real_estate_commercial' },
      { label: 'Commercial Real Estate Services', diagnosticSlug: 'real_estate_commercial' },
      { label: 'Residential Real Estate Services', diagnosticSlug: 'real_estate_residential' },
      { label: 'Timeshares & Vacation Properties', diagnosticSlug: 'real_estate_residential' },
    ],
  },
  {
    name: 'Lodging & Hospitality',
    defaultSlug: 'retail',
    subcategories: [
      { label: 'Hotels & Motels', diagnosticSlug: 'retail' },
      { label: 'Resorts', diagnosticSlug: 'retail' },
      { label: 'Extended Stay Lodging', diagnosticSlug: 'retail' },
      { label: 'Bed & Breakfasts', diagnosticSlug: 'retail' },
      { label: 'Vacation Rentals', diagnosticSlug: 'real_estate_residential' },
      { label: 'Hospitality Services', diagnosticSlug: 'retail' },
    ],
  },
  {
    name: 'Restaurants & Food Services',
    defaultSlug: 'food_beverage',
    subcategories: [
      { label: 'Full-Service Restaurants', diagnosticSlug: 'food_beverage' },
      { label: 'Quick Service / Fast Food', diagnosticSlug: 'food_beverage' },
      { label: 'Bars, Taverns & Nightclubs', diagnosticSlug: 'food_beverage' },
      { label: 'Caterers', diagnosticSlug: 'food_beverage' },
      { label: 'Coffee Shops & Cafés', diagnosticSlug: 'food_beverage' },
      { label: 'Food Trucks & Mobile Vendors', diagnosticSlug: 'food_beverage' },
    ],
  },
  {
    name: 'Retail (General)',
    defaultSlug: 'retail',
    subcategories: [
      { label: 'Department Stores', diagnosticSlug: 'retail' },
      { label: 'Discount & Variety Stores', diagnosticSlug: 'retail' },
      { label: 'General Merchandise Retail', diagnosticSlug: 'retail' },
      { label: 'Warehouse Clubs', diagnosticSlug: 'retail' },
    ],
  },
  {
    name: 'Retail (Food & Beverage)',
    defaultSlug: 'cpg',
    subcategories: [
      { label: 'Grocery Stores & Supermarkets', diagnosticSlug: 'retail' },
      { label: 'Specialty Food Stores', diagnosticSlug: 'food_beverage' },
      { label: 'Convenience Stores', diagnosticSlug: 'retail' },
      { label: 'Liquor Stores', diagnosticSlug: 'retail' },
    ],
  },
  {
    name: 'Retail (Apparel & Accessories)',
    defaultSlug: 'retail',
    subcategories: [
      { label: "Men's Clothing", diagnosticSlug: 'retail' },
      { label: "Women's Clothing", diagnosticSlug: 'retail' },
      { label: 'Family Apparel', diagnosticSlug: 'retail' },
      { label: 'Shoes & Footwear', diagnosticSlug: 'retail' },
      { label: 'Accessories & Jewelry', diagnosticSlug: 'retail' },
      { label: 'Luxury Goods', diagnosticSlug: 'dtc' },
    ],
  },
  {
    name: 'Retail (Electronics & Media)',
    defaultSlug: 'ecommerce_digital',
    subcategories: [
      { label: 'Consumer Electronics', diagnosticSlug: 'hardware_electronics' },
      { label: 'Computer Hardware', diagnosticSlug: 'hardware_electronics' },
      { label: 'Software Retail', diagnosticSlug: 'ecommerce_digital' },
      { label: 'Music & Media Stores', diagnosticSlug: 'media_entertainment' },
    ],
  },
  {
    name: 'Retail (Specialty)',
    defaultSlug: 'retail',
    subcategories: [
      { label: 'Home Furnishings & Appliances', diagnosticSlug: 'retail' },
      { label: 'Hardware & Building Materials', diagnosticSlug: 'retail' },
      { label: 'Garden & Outdoor Supplies', diagnosticSlug: 'retail' },
      { label: 'Sporting Goods', diagnosticSlug: 'retail' },
      { label: 'Hobby & Toy Stores', diagnosticSlug: 'retail' },
      { label: 'Office Supplies', diagnosticSlug: 'retail' },
      { label: 'Bookstores', diagnosticSlug: 'retail' },
    ],
  },
  {
    name: 'Automotive',
    defaultSlug: 'automotive',
    subcategories: [
      { label: 'New & Used Car Dealers', diagnosticSlug: 'automotive' },
      { label: 'Motorcycle & Specialty Vehicles', diagnosticSlug: 'automotive' },
      { label: 'Auto Parts & Accessories', diagnosticSlug: 'automotive' },
      { label: 'Fuel & Gas Stations', diagnosticSlug: 'energy_oil_gas' },
      { label: 'Auto Repair & Maintenance', diagnosticSlug: 'automotive' },
      { label: 'Car Wash Services', diagnosticSlug: 'automotive' },
      { label: 'Parking Services', diagnosticSlug: 'infrastructure_transport' },
    ],
  },
  {
    name: 'Transportation',
    defaultSlug: 'transportation',
    subcategories: [
      { label: 'Airlines', diagnosticSlug: 'transportation' },
      { label: 'Airports & Airport Services', diagnosticSlug: 'infrastructure_transport' },
      { label: 'Rail Transportation', diagnosticSlug: 'transportation' },
      { label: 'Bus & Public Transit', diagnosticSlug: 'infrastructure_transport' },
      { label: 'Taxi & Rideshare', diagnosticSlug: 'transportation' },
      { label: 'Limousine Services', diagnosticSlug: 'transportation' },
    ],
  },
  {
    name: 'Travel & Tourism',
    defaultSlug: 'retail',
    subcategories: [
      { label: 'Travel Agencies', diagnosticSlug: 'retail' },
      { label: 'Tour Operators', diagnosticSlug: 'retail' },
      { label: 'Cruise Lines', diagnosticSlug: 'transportation' },
      { label: 'Vacation Services', diagnosticSlug: 'retail' },
    ],
  },
  {
    name: 'Logistics & Freight',
    defaultSlug: 'shipping_logistics',
    subcategories: [
      { label: 'Freight & Trucking', diagnosticSlug: 'shipping_logistics' },
      { label: 'Courier & Delivery Services', diagnosticSlug: 'shipping_logistics' },
      { label: 'Warehousing & Storage', diagnosticSlug: 'shipping_logistics' },
      { label: 'Shipping & Maritime Services', diagnosticSlug: 'shipping_logistics' },
    ],
  },
  {
    name: 'Healthcare',
    defaultSlug: 'healthcare_providers',
    subcategories: [
      { label: 'Physicians & Medical Practices', diagnosticSlug: 'healthcare_providers' },
      { label: 'Dental Services', diagnosticSlug: 'healthcare_services' },
      { label: 'Vision Care', diagnosticSlug: 'healthcare_services' },
      { label: 'Chiropractic Services', diagnosticSlug: 'healthcare_services' },
      { label: 'Specialized Medical Services', diagnosticSlug: 'healthcare_providers' },
      { label: 'Hospitals', diagnosticSlug: 'healthcare_providers' },
      { label: 'Medical Laboratories', diagnosticSlug: 'healthcare_services' },
      { label: 'Diagnostic Services', diagnosticSlug: 'healthcare_services' },
      { label: 'Nursing & Personal Care Facilities', diagnosticSlug: 'healthcare_services' },
      { label: 'Home Healthcare', diagnosticSlug: 'healthcare_services' },
    ],
  },
  {
    name: 'Education',
    defaultSlug: 'consulting_services',
    subcategories: [
      { label: 'Primary & Secondary Schools', diagnosticSlug: 'government_state_local' },
      { label: 'Colleges & Universities', diagnosticSlug: 'consulting_services' },
      { label: 'Trade & Technical Schools', diagnosticSlug: 'consulting_services' },
      { label: 'Tutoring & Educational Services', diagnosticSlug: 'consulting_services' },
      { label: 'Online Education Platforms', diagnosticSlug: 'software_saas' },
    ],
  },
  {
    name: 'Government & Public Sector',
    defaultSlug: 'government_federal',
    subcategories: [
      { label: 'Tax & Revenue Collection', diagnosticSlug: 'government_federal' },
      { label: 'Courts & Legal Administration', diagnosticSlug: 'legal_services' },
      { label: 'Public Safety & Law Enforcement', diagnosticSlug: 'government_state_local' },
      { label: 'Licensing & Regulatory Services', diagnosticSlug: 'government_state_local' },
      { label: 'Government Services (General)', diagnosticSlug: 'government_federal' },
    ],
  },
  {
    name: 'Non-Profit & Membership',
    defaultSlug: 'nonprofit_ngo',
    subcategories: [
      { label: 'Charitable Organizations', diagnosticSlug: 'nonprofit_ngo' },
      { label: 'Foundations & NGOs', diagnosticSlug: 'nonprofit_ngo' },
      { label: 'Civic & Social Organizations', diagnosticSlug: 'nonprofit_ngo' },
      { label: 'Religious Organizations', diagnosticSlug: 'nonprofit_ngo' },
      { label: 'Membership Associations', diagnosticSlug: 'nonprofit_ngo' },
    ],
  },
  {
    name: 'Personal Services',
    defaultSlug: 'retail',
    subcategories: [
      { label: 'Laundry & Dry Cleaning', diagnosticSlug: 'retail' },
      { label: 'Beauty Salons & Barber Shops', diagnosticSlug: 'retail' },
      { label: 'Spas & Wellness Services', diagnosticSlug: 'healthcare_services' },
      { label: 'Fitness Centers & Gyms', diagnosticSlug: 'retail' },
      { label: 'Dating & Personal Services', diagnosticSlug: 'ecommerce_digital' },
      { label: 'Funeral Services', diagnosticSlug: 'retail' },
    ],
  },
  {
    name: 'Entertainment & Recreation',
    defaultSlug: 'media_entertainment',
    subcategories: [
      { label: 'Movie Theaters', diagnosticSlug: 'media_entertainment' },
      { label: 'Amusement Parks', diagnosticSlug: 'media_entertainment' },
      { label: 'Museums & Cultural Institutions', diagnosticSlug: 'nonprofit_ngo' },
      { label: 'Sports & Recreation Facilities', diagnosticSlug: 'media_entertainment' },
      { label: 'Gaming & Gambling', diagnosticSlug: 'media_entertainment' },
      { label: 'Clubs & Membership Venues', diagnosticSlug: 'media_entertainment' },
    ],
  },
  {
    name: 'Utilities & Energy',
    defaultSlug: 'utilities',
    subcategories: [
      { label: 'Electric Utilities', diagnosticSlug: 'utilities' },
      { label: 'Gas Utilities', diagnosticSlug: 'utilities' },
      { label: 'Water Utilities', diagnosticSlug: 'utilities' },
      { label: 'Waste Management', diagnosticSlug: 'utilities' },
      { label: 'Renewable Energy Services', diagnosticSlug: 'energy_oil_gas' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Search helper — flattened list for typeahead filtering
// ---------------------------------------------------------------------------

export interface FlatIndustry {
  label: string;
  category: string;
  diagnosticSlug: Industry;
}

let _flatCache: FlatIndustry[] | null = null;

export function flattenForSearch(): FlatIndustry[] {
  if (_flatCache) return _flatCache;
  _flatCache = MCC_INDUSTRY_TREE.flatMap((cat) =>
    cat.subcategories.map((sub) => ({
      label: sub.label,
      category: cat.name,
      diagnosticSlug: sub.diagnosticSlug,
    }))
  );
  return _flatCache;
}
