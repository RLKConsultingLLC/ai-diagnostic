// =============================================================================
// RLK AI Diagnostic — Intake Validation
// =============================================================================
// Shared validation for CompanyProfile used by both client and server.
// =============================================================================

import type { CompanyProfile, Industry } from '@/types/diagnostic';

const VALID_INDUSTRIES: Industry[] = [
  'insurance', 'banking', 'capital_markets', 'asset_wealth_management',
  'investment_banking', 'private_equity', 'venture_capital', 'hedge_funds',
  'healthcare_providers', 'healthcare_payers', 'healthcare_services', 'life_sciences_pharma',
  'retail', 'ecommerce_digital', 'cpg', 'dtc', 'food_beverage',
  'manufacturing_discrete', 'manufacturing_process', 'automotive', 'aerospace_defense',
  'energy_oil_gas', 'utilities', 'chemicals_materials', 'industrial_services',
  'software_saas', 'it_services', 'hardware_electronics',
  'transportation', 'shipping_logistics', 'infrastructure_transport',
  'construction_engineering', 'real_estate_commercial', 'real_estate_residential',
  'telecommunications', 'media_entertainment',
  'government_federal', 'government_state_local', 'defense_contractors', 'nonprofit_ngo',
  'consulting_services', 'legal_services', 'accounting_audit',
];

const VALID_REGULATORY = ['low', 'moderate', 'high', 'very_high'];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function validateCompanyProfile(profile: Partial<CompanyProfile>): ValidationResult {
  const errors: Record<string, string> = {};

  // Company name
  if (!profile.companyName?.trim()) {
    errors.companyName = 'Company name is required.';
  }

  // Industry
  if (!profile.industry) {
    errors.industry = 'Industry selection is required.';
  } else if (!VALID_INDUSTRIES.includes(profile.industry)) {
    errors.industry = 'Invalid industry selection.';
  }

  // Revenue
  if (profile.revenue === undefined || profile.revenue === null) {
    errors.revenue = 'Annual revenue is required.';
  } else if (typeof profile.revenue !== 'number' || isNaN(profile.revenue)) {
    errors.revenue = 'Revenue must be a number.';
  } else if (profile.revenue < 100_000) {
    errors.revenue = 'Revenue must be at least $100,000.';
  } else if (profile.revenue > 1_000_000_000_000) {
    errors.revenue = 'Revenue cannot exceed $1 trillion.';
  }

  // Employee count
  if (profile.employeeCount === undefined || profile.employeeCount === null) {
    errors.employeeCount = 'Employee count is required.';
  } else if (typeof profile.employeeCount !== 'number' || isNaN(profile.employeeCount)) {
    errors.employeeCount = 'Employee count must be a number.';
  } else if (profile.employeeCount < 1 || !Number.isInteger(profile.employeeCount)) {
    errors.employeeCount = 'Employee count must be a positive whole number.';
  } else if (profile.employeeCount > 10_000_000) {
    errors.employeeCount = 'Employee count cannot exceed 10 million.';
  }

  // Public/Private
  if (!profile.publicOrPrivate) {
    errors.publicOrPrivate = 'Organization type is required.';
  } else if (profile.publicOrPrivate !== 'public' && profile.publicOrPrivate !== 'private') {
    errors.publicOrPrivate = 'Must be "public" or "private".';
  }

  // Regulatory intensity
  if (!profile.regulatoryIntensity) {
    errors.regulatoryIntensity = 'Regulatory intensity is required.';
  } else if (!VALID_REGULATORY.includes(profile.regulatoryIntensity)) {
    errors.regulatoryIntensity = 'Invalid regulatory intensity.';
  }

  // AI use cases
  if (!profile.primaryAIUseCases || profile.primaryAIUseCases.length === 0) {
    errors.primaryAIUseCases = 'Select at least one AI use case.';
  }

  // Email (optional, but validate format if provided)
  if (profile.executiveEmail && !EMAIL_REGEX.test(profile.executiveEmail)) {
    errors.executiveEmail = 'Enter a valid email address.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
