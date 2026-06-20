import { useState, useEffect, useRef, useCallback, FC } from "react";
import { submitPrompt, submitChat } from "../api"

// ─── Types ────────────────────────────────────────────────────────────────────

type Vertical = "healthcare" | "housing" | "financials";
type AppStep = "landing" | "vertical" | "questions" | "processing" | "verdict";

interface Question {
  id: string;
  text: string;
  subtext?: string;
  type: "select" | "radio" | "number" | "searchable-select";
  options?: { label: string; value: string }[];
  condition?: (answers: Record<string, string>) => boolean;
}

interface Program {
  name: string;
  agency: string;
  description: string;
  eligible: boolean;
  reason: string;
  urgency?: "immediate" | "standard";
  body?: string;
}

interface ChatTurn {
  role: "user" | "model";
  text: string;
}

// ─── California Counties Data ──────────────────────────────────────────────────

const CALIFORNIA_COUNTIES = [
  "Alameda County",
  "Alpine County",
  "Amador County",
  "Butte County",
  "Calaveras County",
  "Colusa County",
  "Contra Costa County",
  "Del Norte County",
  "El Dorado County",
  "Fresno County",
  "Glenn County",
  "Humboldt County",
  "Imperial County",
  "Inyo County",
  "Kern County",
  "Kings County",
  "Lake County",
  "Lassen County",
  "Los Angeles County",
  "Madera County",
  "Marin County",
  "Mariposa County",
  "Mendocino County",
  "Merced County",
  "Modoc County",
  "Mono County",
  "Monterey County",
  "Napa County",
  "Nevada County",
  "Orange County",
  "Placer County",
  "Plumas County",
  "Riverside County",
  "Sacramento County",
  "San Benito County",
  "San Bernardino County",
  "San Diego County",
  "San Francisco County",
  "San Joaquin County",
  "San Luis Obispo County",
  "San Mateo County",
  "Santa Barbara County",
  "Santa Clara County",
  "Santa Cruz County",
  "Shasta County",
  "Sierra County",
  "Siskiyou County",
  "Solano County",
  "Sonoma County",
  "Stanislaus County",
  "Sutter County",
  "Tehama County",
  "Trinity County",
  "Tulare County",
  "Tuolumne County",
  "Ventura County",
  "Yolo County",
  "Yuba County",
];

// ─── GeminiResponseRenderer Component ──────────────────────────────────────────

interface GeminiResponseRendererProps {
  response: string;
  isLoading: boolean;
  category: Vertical;
}

const GeminiResponseRenderer: FC<GeminiResponseRendererProps> = ({ response, isLoading, category }) => {
  if (!response && !isLoading) return null;
  return (
    <div className="bg-card border border-border p-5 mb-8">
      <div className="font-mono text-xs text-primary tracking-widest mb-2">AI INSIGHTS / {category.toUpperCase()}</div>
      <div className="h-px bg-secondary mb-3" />
      {isLoading ? (
        <div className="font-mono text-xs text-muted-foreground animate-pulse">Analyzing additional opportunities...</div>
      ) : response ? (
        <div 
          className="text-foreground leading-relaxed [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:text-muted-foreground [&_p]:mb-3 [&_ul]:text-muted-foreground [&_ul]:mb-3 [&_li]:mb-1"
          dangerouslySetInnerHTML={{ __html: response }}
        />
      ) : null}
    </div>
  );
};

// ─── SearchableSelect Component ────────────────────────────────────────────────

interface SearchableSelectProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isSelected?: boolean;
}

const SearchableSelect: FC<SearchableSelectProps> = ({ 
  options, 
  value, 
  onChange, 
  placeholder = "Search and select...",
  isSelected = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = options.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-left font-mono text-sm px-4 py-3 border transition-all duration-150 flex items-center justify-between
          ${isSelected
            ? "border-primary bg-primary/10 text-foreground"
            : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
          }`}
      >
        <span>{value || placeholder}</span>
        <span className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border shadow-lg max-h-80">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search counties..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full font-mono text-sm px-4 py-3 border-b border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <div className="max-h-64 overflow-y-auto">
            {filtered.length > 0 ? (
              filtered.map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    onChange(opt);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={`w-full text-left font-mono text-sm px-4 py-2 transition-colors duration-150 flex items-center gap-3
                    ${
                      value === opt
                        ? "bg-primary/10 text-foreground border-l-2 border-primary"
                        : "text-muted-foreground hover:bg-primary/5 hover:text-foreground"
                    }`}
                >
                  <span className={`w-3 h-3 border shrink-0 flex items-center justify-center
                    ${value === opt ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                    {value === opt && (
                      <span className="w-1.5 h-1.5 bg-primary-foreground block" />
                    )}
                  </span>
                  {opt}
                </button>
              ))
            ) : (
              <div className="px-4 py-3 font-mono text-xs text-muted-foreground">
                No counties found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Case number generator ────────────────────────────────────────────────────

function generateCaseNumber(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const num = Math.floor(1000 + Math.random() * 9000);
  const letter = letters[Math.floor(Math.random() * letters.length)];
  return `${num}-${letter}`;
}

// ─── Questions per vertical ───────────────────────────────────────────────────

const HEALTHCARE_QUESTIONS: Question[] = [
  {
    id: "county",
    text: "Which California county do you live in?",
    subtext: "This helps identify county-specific healthcare programs.",
    type: "searchable-select",
    options: CALIFORNIA_COUNTIES.map((county) => ({
      label: county,
      value: county.toLowerCase().replace(/\s+/g, "_"),
    })),
  },
  {
    id: "age",
    text: "How old are you?",
    subtext: "Your age determines which programs you may be eligible for.",
    type: "select",
    options: [
      { label: "Under 19", value: "under19" },
      { label: "19 – 25", value: "19to25" },
      { label: "26 – 44", value: "26to44" },
      { label: "45 – 64", value: "45to64" },
      { label: "65 or older", value: "65plus" },
    ],
  },
  {
    id: "income",
    text: "What is your estimated annual household income?",
    subtext: "Include wages, benefits, and other regular sources.",
    type: "select",
    options: [
      { label: "Under $15,000", value: "under15k" },
      { label: "$15,000 – $25,000", value: "15to25k" },
      { label: "$25,000 – $40,000", value: "25to40k" },
      { label: "$40,000 – $60,000", value: "40to60k" },
      { label: "$60,000 – $80,000", value: "60to80k" },
      { label: "Over $80,000", value: "over80k" },
    ],
  },
  {
    id: "household_size",
    text: "How many people are in your household?",
    subtext: "Count everyone you financially support, including yourself.",
    type: "select",
    options: [
      { label: "Just me (1)", value: "1" },
      { label: "2 people", value: "2" },
      { label: "3 people", value: "3" },
      { label: "4 people", value: "4" },
      { label: "5 or more", value: "5plus" },
    ],
  },
  {
    id: "citizenship",
    text: "Are you a U.S. citizen or lawful permanent resident?",
    subtext: "Some programs require citizenship; others have different rules.",
    type: "radio",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
      { label: "I have a different immigration status", value: "other" },
    ],
  },
  {
    id: "insured",
    text: "Do you currently have health insurance?",
    subtext: "Any coverage — employer, marketplace, Medicaid, or Medicare.",
    type: "radio",
    options: [
      { label: "Yes, I have coverage", value: "yes" },
      { label: "No, I am uninsured", value: "no" },
    ],
  },
  {
    id: "disability",
    text: "Do you have a long-term disability or chronic condition?",
    subtext: "One that affects your ability to work or daily activities.",
    type: "radio",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ],
  },
  {
    id: "children",
    text: "Do you have children under 19 in your household?",
    type: "radio",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ],
  },
  {
    id: "pregnant",
    text: "Are you currently pregnant?",
    type: "radio",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ],
    condition: (a) => a.age !== "65plus",
  },
];

const HOUSING_QUESTIONS: Question[] = [
  {
    id: "county",
    text: "Which California county do you live in?",
    subtext: "This helps identify county-specific housing assistance programs.",
    type: "searchable-select",
    options: CALIFORNIA_COUNTIES.map((county) => ({
      label: county,
      value: county.toLowerCase().replace(/\s+/g, "_"),
    })),
  },
  {
    id: "housing_status",
    text: "What best describes your current housing situation?",
    type: "select",
    options: [
      { label: "Renting — stable", value: "renting_stable" },
      { label: "Renting — at risk of eviction", value: "renting_risk" },
      { label: "Staying with family or friends temporarily", value: "doubled_up" },
      { label: "Experiencing homelessness", value: "homeless" },
      { label: "Homeowner", value: "owner" },
    ],
  },
  {
    id: "income",
    text: "What is your estimated annual household income?",
    subtext: "Include all sources of income for your household.",
    type: "select",
    options: [
      { label: "Under $15,000", value: "under15k" },
      { label: "$15,000 – $25,000", value: "15to25k" },
      { label: "$25,000 – $40,000", value: "25to40k" },
      { label: "$40,000 – $60,000", value: "40to60k" },
      { label: "$60,000 – $80,000", value: "60to80k" },
      { label: "Over $80,000", value: "over80k" },
    ],
  },
  {
    id: "household_size",
    text: "How many people live in your household?",
    type: "select",
    options: [
      { label: "Just me (1)", value: "1" },
      { label: "2 people", value: "2" },
      { label: "3 people", value: "3" },
      { label: "4 people", value: "4" },
      { label: "5 or more", value: "5plus" },
    ],
  },
  {
    id: "citizenship",
    text: "Are you a U.S. citizen or lawful permanent resident?",
    type: "radio",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ],
  },
  {
    id: "veteran",
    text: "Are you a veteran or currently serving in the military?",
    type: "radio",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ],
  },
  {
    id: "vulnerable",
    text: "Does your household include elderly members (62+), children, or someone with a disability?",
    type: "radio",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ],
  },
  {
    id: "waitlist",
    text: "Are you currently on any housing assistance waitlist?",
    type: "radio",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ],
  },
  {
    id: "rural",
    text: "Do you live in a rural area or small town?",
    subtext: "Population under 35,000, outside of a major metropolitan area.",
    type: "radio",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ],
  },
];

const FINANCIALS_QUESTIONS: Question[] = [
  {
    id: "county",
    text: "Which California county do you live in?",
    subtext: "This helps identify county-specific financial assistance programs.",
    type: "searchable-select",
    options: CALIFORNIA_COUNTIES.map((county) => ({
      label: county,
      value: county.toLowerCase().replace(/\s+/g, "_"),
    })),
  },
  {
    id: "employment",
    text: "What is your current employment status?",
    type: "select",
    options: [
      { label: "Employed full-time", value: "full_time" },
      { label: "Employed part-time", value: "part_time" },
      { label: "Self-employed or freelance", value: "self_employed" },
      { label: "Unemployed — actively seeking work", value: "unemployed" },
      { label: "Unemployed — not seeking work", value: "not_seeking" },
      { label: "Retired", value: "retired" },
      { label: "Unable to work (disability)", value: "disabled" },
    ],
  },
  {
    id: "income",
    text: "What is your estimated annual household income?",
    subtext: "Include wages, benefits, Social Security, and other regular income.",
    type: "select",
    options: [
      { label: "Under $15,000", value: "under15k" },
      { label: "$15,000 – $25,000", value: "15to25k" },
      { label: "$25,000 – $40,000", value: "25to40k" },
      { label: "$40,000 – $60,000", value: "40to60k" },
      { label: "$60,000 – $80,000", value: "60to80k" },
      { label: "Over $80,000", value: "over80k" },
    ],
  },
  {
    id: "household_size",
    text: "How many people are in your household?",
    type: "select",
    options: [
      { label: "Just me (1)", value: "1" },
      { label: "2 people", value: "2" },
      { label: "3 people", value: "3" },
      { label: "4 people", value: "4" },
      { label: "5 or more", value: "5plus" },
    ],
  },
  {
    id: "citizenship",
    text: "Are you a U.S. citizen or lawful permanent resident?",
    type: "radio",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ],
  },
  {
    id: "dependents",
    text: "Do you have dependent children under 18?",
    type: "radio",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ],
  },
  {
    id: "current_benefits",
    text: "Are you currently receiving any government assistance?",
    subtext: "SNAP, SSI, Medicaid, or similar programs.",
    type: "radio",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ],
  },
  {
    id: "filed_taxes",
    text: "Did you file a federal tax return last year?",
    type: "radio",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
      { label: "I was not required to file", value: "not_required" },
    ],
  },
  {
    id: "veteran",
    text: "Are you a veteran or currently serving in the military?",
    type: "radio",
    options: [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
    ],
  },
];

// ─── Eligibility engine ───────────────────────────────────────────────────────

const LOW_INCOME = ["under15k", "15to25k"];
const MID_LOW_INCOME = ["under15k", "15to25k", "25to40k"];
const MID_INCOME = ["under15k", "15to25k", "25to40k", "40to60k"];

function determineHealthcarePrograms(a: Record<string, string>): Program[] {
  const lowIncome = LOW_INCOME.includes(a.income);
  const midLowIncome = MID_LOW_INCOME.includes(a.income);
  const midIncome = MID_INCOME.includes(a.income);
  const isCitizen = a.citizenship === "yes";
  const isSenior = a.age === "65plus";
  const hasDisability = a.disability === "yes";
  const hasChildren = a.children === "yes";
  const isPregnant = a.pregnant === "yes";
  const largeHousehold = ["4", "5plus"].includes(a.household_size);

  return [
    {
      name: "Medicaid",
      agency: "CMS / State Health Dept.",
      description: "Full health coverage for low-income individuals and families, including doctor visits, hospital care, prescriptions, and preventive services.",
      eligible: isCitizen && (lowIncome || (midLowIncome && largeHousehold)),
      reason: isCitizen && (lowIncome || (midLowIncome && largeHousehold))
        ? "Your income level and household size fall within Medicaid's coverage thresholds."
        : "Medicaid requires income below 138% of the federal poverty level for your household size.",
      urgency: "immediate",
    },
    {
      name: "Children's Health Insurance Program (CHIP)",
      agency: "CMS / State CHIP Office",
      description: "Low-cost or free health coverage for children in families that earn too much to qualify for Medicaid but can't afford private insurance.",
      eligible: hasChildren && isCitizen && midIncome,
      reason: hasChildren && isCitizen && midIncome
        ? "Your household has children and falls within CHIP income guidelines."
        : "CHIP is limited to households with children under 19 meeting income criteria.",
    },
    {
      name: "ACA Marketplace Subsidies",
      agency: "Healthcare.gov / State Exchange",
      description: "Premium tax credits that reduce the cost of health insurance purchased through the marketplace — often making coverage under $50/month.",
      eligible: !isSenior && isCitizen && midIncome && a.insured === "no",
      reason: !isSenior && isCitizen && midIncome && a.insured === "no"
        ? "Your income and uninsured status make you eligible for substantial premium subsidies."
        : "ACA subsidies are available for uninsured individuals within the 100–400% poverty range.",
    },
    {
      name: "Medicare Savings Programs",
      agency: "Social Security Administration",
      description: "Helps cover Medicare premiums, deductibles, and co-payments for seniors and people with disabilities on limited income.",
      eligible: (isSenior || hasDisability) && midLowIncome,
      reason: (isSenior || hasDisability) && midLowIncome
        ? "Your age or disability status combined with your income qualifies you for Medicare cost-sharing assistance."
        : "Medicare Savings requires age 65+ or qualifying disability, with income below 150% poverty level.",
    },
    {
      name: "Extra Help (Part D Low-Income Subsidy)",
      agency: "Social Security Administration",
      description: "Reduces prescription drug costs for people with Medicare — including premiums, deductibles, and co-pays on medications.",
      eligible: (isSenior || hasDisability) && lowIncome,
      reason: (isSenior || hasDisability) && lowIncome
        ? "Your Medicare status and income level qualify you for significant prescription drug cost reductions."
        : "Extra Help is reserved for Medicare beneficiaries with income and resources below program limits.",
    },
    {
      name: "Medicaid Maternity Coverage",
      agency: "CMS / State Health Dept.",
      description: "Comprehensive prenatal, delivery, and postpartum care coverage for pregnant individuals regardless of immigration status in many states.",
      eligible: isPregnant && midIncome,
      reason: isPregnant && midIncome
        ? "Your pregnancy and income level qualify you for expanded maternity Medicaid coverage."
        : "Maternity Medicaid is available to pregnant individuals within income guidelines.",
    },
  ];
}

function determineHousingPrograms(a: Record<string, string>): Program[] {
  const lowIncome = LOW_INCOME.includes(a.income);
  const midLowIncome = MID_LOW_INCOME.includes(a.income);
  const isCitizen = a.citizenship === "yes";
  const isVeteran = a.veteran === "yes";
  const isHomeless = a.housing_status === "homeless";
  const isAtRisk = ["renting_risk", "doubled_up", "homeless"].includes(a.housing_status);
  const isVulnerable = a.vulnerable === "yes";
  const isRural = a.rural === "yes";
  const largeHousehold = ["4", "5plus"].includes(a.household_size);

  return [
    {
      name: "Section 8 Housing Choice Voucher",
      agency: "HUD / Local Housing Authority",
      description: "Rental assistance vouchers that pay the difference between what you can afford and the fair market rent in your area.",
      eligible: isCitizen && (lowIncome || (midLowIncome && largeHousehold)),
      reason: isCitizen && (lowIncome || (midLowIncome && largeHousehold))
        ? "Your income and household profile meet HUD's criteria for rental voucher assistance."
        : "Section 8 requires income below 50% of area median income for your household size.",
      urgency: isAtRisk ? "immediate" : "standard",
    },
    {
      name: "Emergency Rental Assistance (ERA)",
      agency: "U.S. Treasury / Local Programs",
      description: "Immediate financial assistance to cover unpaid rent and utilities for households facing eviction or housing instability.",
      eligible: isAtRisk && midLowIncome,
      reason: isAtRisk && midLowIncome
        ? "Your at-risk housing status and income qualify you for emergency rental assistance."
        : "ERA programs prioritize households with immediate eviction risk and income below 80% area median.",
      urgency: "immediate",
    },
    {
      name: "HUD Public Housing",
      agency: "HUD / Local Housing Authority",
      description: "Government-owned housing units rented at reduced rates to qualifying low-income individuals and families.",
      eligible: isCitizen && lowIncome,
      reason: isCitizen && lowIncome
        ? "Your income level qualifies you for public housing at significantly reduced rent."
        : "Public housing is limited to households earning below 30–50% of area median income.",
    },
    {
      name: "HUD CoC Homeless Assistance",
      agency: "HUD / Continuum of Care",
      description: "Transitional and permanent supportive housing, rapid rehousing funds, and shelter placement for individuals experiencing homelessness.",
      eligible: isHomeless,
      reason: isHomeless
        ? "Your current housing situation makes you a priority candidate for rapid rehousing assistance."
        : "CoC assistance is designated for individuals actively experiencing homelessness.",
      urgency: "immediate",
    },
    {
      name: "HUD-VASH (Veterans Assistance)",
      agency: "HUD / VA / Local PHA",
      description: "Combines Section 8 rental assistance with VA supportive services — specifically designed for veterans experiencing homelessness or housing instability.",
      eligible: isVeteran && (lowIncome || isAtRisk),
      reason: isVeteran && (lowIncome || isAtRisk)
        ? "Your veteran status and housing need make you a strong candidate for HUD-VASH assistance."
        : "HUD-VASH is exclusively available to veterans who are homeless or at risk.",
      urgency: isVeteran && isAtRisk ? "immediate" : "standard",
    },
    {
      name: "USDA Rural Housing Service",
      agency: "USDA / Rural Development",
      description: "Low-interest loans, grants, and rental assistance specifically for rural residents to repair, purchase, or access stable housing.",
      eligible: isRural && midLowIncome,
      reason: isRural && midLowIncome
        ? "Your rural location and income level qualify you for USDA housing programs unavailable in urban areas."
        : "USDA programs are restricted to rural communities and specific income thresholds.",
    },
    {
      name: "HOME Tenant-Based Rental Assistance",
      agency: "HUD / Local Grantees",
      description: "Flexible rental assistance for low-income households, often prioritizing families with children, elderly, and disabled members.",
      eligible: isCitizen && midLowIncome && (isVulnerable || largeHousehold),
      reason: isCitizen && midLowIncome && (isVulnerable || largeHousehold)
        ? "Your household composition and income qualify you for prioritized HOME rental assistance."
        : "HOME assistance prioritizes vulnerable household members within income guidelines.",
    },
  ];
}

function determineFinancialPrograms(a: Record<string, string>): Program[] {
  const lowIncome = LOW_INCOME.includes(a.income);
  const midLowIncome = MID_LOW_INCOME.includes(a.income);
  const midIncome = MID_INCOME.includes(a.income);
  const isCitizen = a.citizenship === "yes";
  const hasDependents = a.dependents === "yes";
  const isVeteran = a.veteran === "yes";
  const isUnemployed = ["unemployed", "not_seeking"].includes(a.employment);
  const isDisabled = a.employment === "disabled";
  const isRetired = a.employment === "retired";
  const filedTaxes = ["yes", "not_required"].includes(a.filed_taxes);
  const working = ["full_time", "part_time", "self_employed"].includes(a.employment);

  return [
    {
      name: "SNAP (Food Stamps)",
      agency: "USDA / State SNAP Office",
      description: "Monthly benefits loaded onto an EBT card for purchasing groceries and food staples at authorized retailers.",
      eligible: isCitizen && (lowIncome || (midLowIncome && hasDependents)),
      reason: isCitizen && (lowIncome || (midLowIncome && hasDependents))
        ? "Your income level falls within SNAP gross income limits for your household size."
        : "SNAP requires income at or below 130% of the federal poverty level.",
      urgency: lowIncome ? "immediate" : "standard",
    },
    {
      name: "Supplemental Security Income (SSI)",
      agency: "Social Security Administration",
      description: "Monthly cash payments for individuals who are aged 65+, blind, or disabled and have limited income and resources.",
      eligible: (isDisabled || isRetired) && lowIncome,
      reason: (isDisabled || isRetired) && lowIncome
        ? "Your disability or retirement status combined with your income meets SSI eligibility criteria."
        : "SSI is limited to aged, blind, or disabled individuals with income and resources below federal limits.",
      urgency: "immediate",
    },
    {
      name: "Earned Income Tax Credit (EITC)",
      agency: "IRS",
      description: "A substantial tax refund credit for working individuals and families — often worth $3,000 to $7,000 for families with children.",
      eligible: working && midIncome && filedTaxes,
      reason: working && midIncome && filedTaxes
        ? "Your employment income and household size make you eligible for a significant EITC refund."
        : "EITC requires earned income within IRS thresholds and a filed tax return.",
    },
    {
      name: "TANF (Temporary Assistance for Needy Families)",
      agency: "HHS / State TANF Office",
      description: "Monthly cash assistance, job training, and childcare support for families with children in financial hardship.",
      eligible: hasDependents && lowIncome && isCitizen,
      reason: hasDependents && lowIncome && isCitizen
        ? "Your household's children and income level qualify you for TANF cash and support services."
        : "TANF is designed for families with dependent children at or below poverty level.",
      urgency: "immediate",
    },
    {
      name: "LIHEAP (Energy Assistance)",
      agency: "HHS / State Energy Office",
      description: "Helps pay heating and cooling bills, and provides emergency energy crisis assistance during extreme weather.",
      eligible: (lowIncome || (midLowIncome && hasDependents)) && isCitizen,
      reason: (lowIncome || (midLowIncome && hasDependents)) && isCitizen
        ? "Your income qualifies you for home energy cost assistance through LIHEAP."
        : "LIHEAP targets households with income below 60% of state median income.",
    },
    {
      name: "Unemployment Insurance (UI)",
      agency: "DOL / State Workforce Agency",
      description: "Weekly cash benefits replacing a portion of lost wages while you actively search for new employment.",
      eligible: isUnemployed && a.employment === "unemployed",
      reason: isUnemployed && a.employment === "unemployed"
        ? "Your active job-seeking status makes you a candidate for unemployment insurance benefits."
        : "UI is available to workers who lost their job involuntarily and are actively seeking new employment.",
      urgency: "immediate",
    },
    {
      name: "VA Financial Assistance",
      agency: "Department of Veterans Affairs",
      description: "Pension, disability compensation, and emergency financial assistance programs exclusively for veterans and their dependents.",
      eligible: isVeteran && midLowIncome,
      reason: isVeteran && midLowIncome
        ? "Your veteran status unlocks a suite of VA financial programs beyond standard eligibility."
        : "VA financial programs are available to qualifying veterans with service-connected needs.",
    },
    {
      name: "Child Tax Credit (CTC)",
      agency: "IRS",
      description: "Tax credits of up to $2,000 per qualifying child — partially refundable, putting money back in your pocket even with low tax liability.",
      eligible: hasDependents && midIncome && filedTaxes,
      reason: hasDependents && midIncome && filedTaxes
        ? "Your dependent children and income level qualify you for the Child Tax Credit."
        : "CTC requires dependent children under 17 and income within IRS phase-out thresholds.",
    },
  ];
}

function getEligibilityResults(vertical: Vertical, answers: Record<string, string>): Program[] {
  if (vertical === "healthcare") return determineHealthcarePrograms(answers);
  if (vertical === "housing") return determineHousingPrograms(answers);
  return determineFinancialPrograms(answers);
}

// ─── Vertical metadata ────────────────────────────────────────────────────────

const VERTICAL_META = {
  healthcare: {
    label: "Healthcare",
    tagline: "Medical coverage & prescription access",
    icon: "⚕",
    description: "Investigate eligibility for Medicaid, CHIP, ACA subsidies, Medicare savings programs, and maternity coverage.",
    color: "#5a7fa8",
  },
  housing: {
    label: "Housing",
    tagline: "Rental assistance & housing stability",
    icon: "⌂",
    description: "Investigate eligibility for Section 8 vouchers, emergency rental aid, public housing, veteran housing, and rural programs.",
    color: "#7a9e6e",
  },
  financials: {
    label: "Financial Aid",
    tagline: "Income support & tax benefits",
    icon: "$",
    description: "Investigate eligibility for SNAP, SSI, EITC, TANF, energy assistance, and veteran financial programs.",
    color: "#c8972a",
  },
};

// ─── Fun Facts Data ───────────────────────────────────────────────────────────

const PROGRAM_FACTS = [
  { vertical: "medical", program: "Medicaid", text: "Medicaid was signed into law on July 30, 1965, by President Lyndon B. Johnson as part of his 'Great Society' initiatives, right alongside Medicare." },
  { vertical: "medical", program: "Medicaid", text: "While funded partially by the federal government, Medicaid is actually run individually by each state, meaning it goes by different names like 'Medi-Cal' in California or 'TennCare' in Tennessee." },
  { vertical: "medical", program: "Medicaid", text: "Medicaid is the single largest source of funding for health-related services for children and long-term care for older adults in the United States." },
  { vertical: "medical", program: "Children's Health Insurance Program (CHIP)", text: "CHIP was created in 1997 through a rare, highly successful bipartisan effort led by Democratic Senator Ted Kennedy and Republican Senator Orrin Hatch." },
  { vertical: "medical", program: "Children's Health Insurance Program (CHIP)", text: "Before it was signed into federal law, the program was heavily inspired by 'Caring for Children,' a successful regional initiative launched by Blue Cross of Western Pennsylvania." },
  { vertical: "medical", program: "Children's Health Insurance Program (CHIP)", text: "CHIP covers not just basic doctor visits, but also comprehensive dental and vision care, which are often left out of standard private adult health insurance plans." },
  { vertical: "medical", program: "ACA Marketplace Subsidies", text: "The Affordable Care Act (ACA), which established these subsidies, famously survived multiple major Supreme Court challenges and over 50 congressional repeal votes." },
  { vertical: "medical", program: "ACA Marketplace Subsidies", text: "Marketplace subsidies are officially distributed as 'Advanced Premium Tax Credits,' meaning the government sends the tax credit directly to your insurance company every month instead of making you wait until tax season." },
  { vertical: "medical", program: "ACA Marketplace Subsidies", text: "Because of these subsidies, millions of Americans qualify for plans with premiums as low as $0 per month, depending on their income and location." },
  { vertical: "medical", program: "Medicare Savings Programs", text: "There are actually four different types of Medicare Savings Programs (QMB, SLMB, QI, and QDWI), each acting like a specific financial shield to cover different gaps in Medicare costs." },
  { vertical: "medical", program: "Medicare Savings Programs", text: "If you qualify for the QMB tier, doctors are legally prohibited from billing you for Medicare deductibles, copayments, and coinsurance." },
  { vertical: "medical", program: "Medicare Savings Programs", text: "Applying for a Medicare Savings Program in many states automatically tests your eligibility for other low-income benefits, essentially serving as a dual-application shortcut." },
  { vertical: "medical", program: "Extra Help (Part D Low-Income Subsidy)", text: "The Extra Help program is estimated to be worth about $5,900 per year in prescription drug savings for the average person who qualifies." },
  { vertical: "medical", program: "Extra Help (Part D Low-Income Subsidy)", text: "Once approved for Extra Help, you face absolutely no late-enrollment penalties for Medicare Part D, even if you missed your initial sign-up window years prior." },
  { vertical: "medical", program: "Extra Help (Part D Low-Income Subsidy)", text: "The program allows beneficiaries to switch their Medicare prescription drug plans once per quarter during the first nine months of the year, providing incredible flexibility compared to the standard annual window." },
  { vertical: "medical", program: "Medicaid Maternity Coverage", text: "Because of expanded federal rules, Medicaid covers nearly 40% of all births in the United States, making it the nation's primary builder of modern maternity care." },
  { vertical: "medical", program: "Medicaid Maternity Coverage", text: "While standard Medicaid has strict immigration requirements, federal emergency provisions allow undocumented pregnant individuals to receive Medicaid coverage for labor and delivery services in every state." },
  { vertical: "medical", program: "Medicaid Maternity Coverage", text: "Under recent extensions, postpartum coverage has been expanded from just 60 days to a full 12 months after giving birth in the vast majority of U.S. states." },
  { vertical: "housing", program: "Section 8 Housing Choice Voucher", text: "The nickname 'Section 8' comes directly from Section 8 of the Housing Act of 1937, which was heavily modified in 1974 to create the voucher program we know today." },
  { vertical: "housing", program: "Section 8 Housing Choice Voucher", text: "Unlike public housing units, Section 8 vouchers are entirely portable; you can legally take your voucher and move to any other city or state in the U.S. that has a housing authority." },
  { vertical: "housing", program: "Section 8 Housing Choice Voucher", text: "Some local housing authorities allow families to use their Section 8 vouchers toward a monthly mortgage payment instead of rent, turning it into a homeownership assistance tool." },
  { vertical: "housing", program: "Emergency Rental Assistance (ERA)", text: "The ERA program was launched during the COVID-19 pandemic and represents the largest single investment in rent relief in United States history, allocating over $46 billion." },
  { vertical: "housing", program: "Emergency Rental Assistance (ERA)", text: "To get money to people as fast as possible, ERA allowed tenants to 'self-certify' their financial hardship if they didn't have access to standard tax or wage documents." },
  { vertical: "housing", program: "Emergency Rental Assistance (ERA)", text: "Unlike most rental aid programs which only pay future rent, ERA was uniquely structured to wipe out up to 12 to 18 months of past-due utility bills and back-rent simultaneously." },
  { vertical: "housing", program: "HUD Public Housing", text: "The nation's first federal public housing complex, First Houses, opened in New York City's East Village in 1935 and was dedicated by First Lady Eleanor Roosevelt." },
  { vertical: "housing", program: "HUD Public Housing", text: "Public housing is not just high-rise buildings; it includes townhouses, scattered single-family homes, and garden apartments, spanning over 1 million units across the country." },
  { vertical: "housing", program: "HUD Public Housing", text: "Many historic public housing communities have produced major cultural icons; for example, musicians Jay-Z and Mary J. Blige famously grew up in New York public housing complexes." },
  { vertical: "housing", program: "HUD CoC Homeless Assistance", text: "The Continuum of Care (CoC) model relies on an event called the 'Point-in-Time (PIT) Count,' where thousands of volunteers across America go out on a single winter night to count every person experiencing homelessness." },
  { vertical: "housing", program: "HUD CoC Homeless Assistance", text: "CoC programs pioneered the 'Housing First' approach, demonstrating that providing permanent housing immediately, without making sobriety or employment a prerequisite, drastically improves long-term stability." },
  { vertical: "housing", program: "HUD CoC Homeless Assistance", text: "A CoC is not a government building, but a local collaborative network that forces nonprofits, city governments, and local businesses to merge their data into a single unified tracking system." },
  { vertical: "housing", program: "HUD-VASH (Veterans Assistance)", text: "The HUD-VASH program is a unique inter-agency alliance where HUD provides the rental voucher, but the Department of Veterans Affairs (VA) provides clinical case management and healthcare." },
  { vertical: "housing", program: "HUD-VASH (Veterans Assistance)", text: "Since 2008, HUD-VASH has successfully housed more than 100,000 homeless veterans, contributing to an over 50% drop in veteran homelessness nationwide." },
  { vertical: "housing", program: "HUD-VASH (Veterans Assistance)", text: "Even if a veteran was dishonorably discharged, they may still be eligible for HUD-VASH assistance depending on specific clinical determinations made by the VA." },
  { vertical: "housing", program: "USDA Rural Housing Service", text: "The USDA doesn't just manage farming and food; its Section 502 Direct Loan program lets low-income rural Americans buy homes with $0 down payments." },
  { vertical: "housing", program: "USDA Rural Housing Service", text: "What qualifies as 'rural' can be surprising; many suburban communities and towns right outside major metropolitan areas with populations under 35,000 fall within USDA boundaries." },
  { vertical: "housing", program: "USDA Rural Housing Service", text: "The program features a 'Mutual Self-Help' grant where groups of neighbors team up to build each other's houses, providing 'sweat equity' instead of a financial down payment." },
  { vertical: "housing", program: "HOME Tenant-Based Rental Assistance", text: "The HOME Investment Partnerships Program is the largest federal block grant given to state and local governments designed exclusively to create affordable housing for low-income households." },
  { vertical: "housing", program: "HOME Tenant-Based Rental Assistance", text: "Unlike standard Section 8 vouchers, HOME rental assistance can be highly customized by your local city council to target specific local crises, like supporting young adults aging out of foster care." },
  { vertical: "housing", program: "HOME Tenant-Based Rental Assistance", text: "HOME assistance funds can be used not just for monthly rent, but also to cover security deposits and utility deposits, which are often the biggest barriers to securing a lease." },
  { vertical: "financial", program: "SNAP (Food Stamps)", text: "The first food stamp recipient in 1939 was Mabel McFiggan of Rochester, New York; the first thing she bought with her stamps was a pack of butter." },
  { vertical: "financial", program: "SNAP (Food Stamps)", text: "Food 'stamps' haven't actually been stamps since the late 1990s and early 2000s, when the program fully transitioned to Electronic Benefits Transfer (EBT) plastic cards." },
  { vertical: "financial", program: "SNAP (Food Stamps)", text: "Under specific federal rules, you can use SNAP benefits to buy seeds and food-producing plants, allowing families to grow their own groceries." },
  { vertical: "financial", program: "Supplemental Security Income (SSI)", text: "Though administered by the Social Security Administration, SSI is not funded by Social Security taxes; it is entirely funded by general U.S. Treasury tax revenues." },
  { vertical: "financial", program: "Supplemental Security Income (SSI)", text: "SSI was signed into law by President Richard Nixon in 1972 to replace a messy patchwork of separate state programs for the blind, aged, and disabled." },
  { vertical: "financial", program: "Supplemental Security Income (SSI)", text: "Children with severe disabilities can qualify for SSI payments independently of their parents' work history, focusing strictly on the household's financial need." },
  { vertical: "financial", program: "Earned Income Tax Credit (EITC)", text: "The EITC was originally introduced in 1975 as a temporary 'work bonus' program to offset the burden of Social Security taxes on low-income working families." },
  { vertical: "financial", program: "Earned Income Tax Credit (EITC)", text: "The EITC is widely considered by economists to be one of the most effective anti-poverty programs in the United States, lifting millions of people out of poverty every single year." },
  { vertical: "financial", program: "Earned Income Tax Credit (EITC)", text: "The amount of EITC you receive scales upward with the number of children you have, maxing out once you have three or more qualifying dependents." },
  { vertical: "financial", program: "TANF (Temporary Assistance for Needy Families)", text: "TANF was created in 1996 under President Bill Clinton's welfare reform bill, completely replacing the decades-old 'Aid to Families with Dependent Children' (AFDC) program." },
  { vertical: "financial", program: "TANF (Temporary Assistance for Needy Families)", text: "Federal law sets a strict lifetime maximum of 60 months (5 years) for receiving TANF cash assistance, though states can choose to make those limits even shorter." },
  { vertical: "financial", program: "TANF (Temporary Assistance for Needy Families)", text: "TANF funds don't just go toward direct cash payments; states use block grants to fund local initiatives like subsidized childcare and job-readiness bootcamps." },
  { vertical: "financial", program: "LIHEAP (Energy Assistance)", text: "LIHEAP doesn't just assist with heating in the freezing winter; it also provides critical emergency 'cooling' assistance for air conditioning costs in scorching summer climates." },
  { vertical: "financial", program: "LIHEAP (Energy Assistance)", text: "In addition to paying utility bills, LIHEAP funds can be used for 'crisis weatherization,' which covers immediate repairs like fixing a broken furnace or sealing drafty windows." },
  { vertical: "financial", program: "LIHEAP (Energy Assistance)", text: "LIHEAP prioritizes households with high energy burdens relative to their income, meaning a large portion of the funding goes to families with children under five and households with elderly members." },
  { vertical: "financial", program: "Unemployment Insurance (UI)", text: "Wisconsin was the trailblazer for this program, enacting the first state unemployment compensation law in 1932, three years before the federal government followed suit." },
  { vertical: "financial", program: "Unemployment Insurance (UI)", text: "The system is funded almost entirely by insurance taxes paid by employers, not by deductions taken out of the workers' paychecks." },
  { vertical: "financial", program: "Unemployment Insurance (UI)", text: "During historical economic downturns, Congress can pass emergency measures to trigger 'Extended Benefits' (EB), stretching weekly UI checks far past the standard 26-week limit." },
  { vertical: "financial", program: "VA Financial Assistance", text: "The United States has been providing financial support to veterans all the way back to 1636, when the Pilgrims of Plymouth Colony passed a law to support disabled soldiers." },
  { vertical: "financial", program: "VA Financial Assistance", text: "The iconic GI Bill, passed in 1944, completely transformed the American economy by helping millions of WWII veterans buy homes and attend college risk-free." },
  { vertical: "financial", program: "VA Financial Assistance", text: "The VA offers a special tax-free benefit called 'Aid and Attendance' that adds extra monthly cash to a veteran's pension if they need help with daily tasks like dressing or cooking." },
  { vertical: "financial", program: "Child Tax Credit (CTC)", text: "When it was first introduced in 1997, the Child Tax Credit was worth just $400 per child; over the years, expansions have significantly increased that value." },
  { vertical: "financial", program: "Child Tax Credit (CTC)", text: "The credit is 'partially refundable' via the Additional Child Tax Credit, meaning you can get money back as a tax refund even if your federal income tax liability is zero." },
  { vertical: "financial", program: "Child Tax Credit (CTC)", text: "In 2021, the program underwent a historic temporary change where the IRS distributed half of the credit as direct monthly cash deposits throughout the summer and fall." }
];

// ─── Typewriter hook ──────────────────────────────────────────────────────────

function useTypewriter(text: string, speed = 18, active = true) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) {
      setDisplayed(text);
      setDone(true);
      return;
    }
    setDisplayed("");
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        setDone(true);
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed, active]);

  return { displayed, done };
}

// ─── Components ───────────────────────────────────────────────────────────────

function ScanlineOverlay() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-50"
      style={{
        background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)",
      }}
    />
  );
}

function GoldRule({ className = "" }: { className?: string }) {
  return <div className={`h-px bg-primary opacity-40 ${className}`} />;
}

function CaseTag({ number }: { number: string }) {
  return (
    <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground tracking-widest">
      <span className="text-primary">◆</span>
      <span>CASE #{number}</span>
      <span className="text-primary">◆</span>
      <span>BENEFITS INVESTIGATION UNIT</span>
      <span className="text-primary">◆</span>
      <span>SESSION ONLY — NO RECORDS RETAINED</span>
    </div>
  );
}

// ─── Copy Eligible Programs Button ────────────────────────────────────────────

interface CopyEligibleButtonProps {
  programs: Program[];
}

const CopyEligibleButton: FC<CopyEligibleButtonProps> = ({ programs }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const eligibleText = programs
      .map((p) => {
        return `${p.name}\n${p.agency}\n${p.description}\n\nWhy eligible: ${p.reason}\n`;
      })
      .join("\n---\n\n");

    try {
      await navigator.clipboard.writeText(eligibleText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`font-mono text-xs px-3 py-1.5 tracking-widest transition-all duration-200 flex items-center gap-2 ${
        copied
          ? "bg-green-600 text-white"
          : "border border-[#c8972a]/40 text-[#c8972a] hover:bg-[#c8972a]/10"
      }`}
    >
      {copied ? "✓ COPIED" : "COPY ALL"}
    </button>
  );
};

// ─── Landing ──────────────────────────────────────────────────────────────────

function Landing({ onStart, caseNumber }: { onStart: () => void; caseNumber: string }) {
  const { displayed } = useTypewriter(
    "I investigate benefit eligibility cases. Tell me about your situation — I'll find every program you qualify for. No accounts. No records. Just answers.",
    14
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col justify-between p-8 md:p-16 max-w-5xl mx-auto w-full">

        {/* Header */}
        <div>
          <GoldRule />
          <div className="flex items-start justify-between mt-6 mb-10">
            <div>
              <div className="font-mono text-xs text-primary tracking-widest mb-3 uppercase">
                Benefits Investigation Unit / AI Division
              </div>
              <h1 className="font-serif text-5xl md:text-7xl text-foreground leading-none font-bold tracking-tight">
                AGENT<br />
                <span className="text-primary italic">Cosmas</span>
              </h1>
            </div>
            <div className="hidden md:flex flex-col items-end font-mono text-xs text-muted-foreground gap-1 mt-1">
              <span>{new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
              <span className="text-primary">ACTIVE DUTY</span>
            </div>
          </div>
          <GoldRule className="mb-10" />

          {/* Intro quote */}
          <div className="border-l-2 border-primary pl-6 mb-12 max-w-2xl">
            <p className="font-mono text-sm text-foreground leading-relaxed min-h-[4.5rem]">
              &ldquo;{displayed}&rdquo;
            </p>
            <div className="font-mono text-xs text-muted-foreground mt-3">— Agent Cosmas, AI Benefits Detective</div>
          </div>

          {/* Case number */}
          <CaseTag number={caseNumber} />
        </div>

        {/* Privacy notice + CTA */}
        <div className="mt-16">
          <div className="bg-card border border-border p-6 mb-8 max-w-2xl">
            <div className="font-mono text-xs text-primary tracking-widest mb-3">PRIVACY DECLARATION</div>
            <GoldRule className="mb-4" />
            <ul className="font-mono text-xs text-muted-foreground space-y-2">
              <li><span className="text-primary mr-2">▸</span>No account required. No login. No sign-up.</li>
              <li><span className="text-primary mr-2">▸</span>All answers exist only in this browser session.</li>
              <li><span className="text-primary mr-2">▸</span>Nothing is stored, transmitted, or retained after you close this page.</li>
              <li><span className="text-primary mr-2">▸</span>We never ask for your name, SSN, or contact information.</li>
            </ul>
          </div>

          <button
            onClick={onStart}
            className="group flex items-center gap-4 bg-primary text-primary-foreground font-mono text-sm tracking-widest px-8 py-4 hover:bg-foreground transition-colors duration-200"
          >
            <span>OPEN A CASE</span>
            <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
          </button>
          <p className="font-mono text-xs text-muted-foreground mt-3">
            Takes 2–3 minutes. Results are immediate.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Vertical selection ───────────────────────────────────────────────────────

function VerticalSelect({ caseNumber, onSelect }: { caseNumber: string; onSelect: (v: Vertical) => void }) {
  const [hovered, setHovered] = useState<Vertical | null>(null);

  return (
    <div className="min-h-screen bg-background flex flex-col p-8 md:p-16 max-w-5xl mx-auto w-full">
      <GoldRule />
      <div className="mt-6 mb-2 font-mono text-xs text-primary tracking-widest">CASE #{caseNumber} / STEP 1 OF 3</div>
      <h2 className="font-serif text-3xl md:text-4xl text-foreground font-bold mt-4 mb-2">
        Choose an Investigation File
      </h2>
      <p className="font-mono text-sm text-muted-foreground mb-10 max-w-lg">
        Select the area where you need assistance. Each vertical opens a dedicated case file with targeted questions.
      </p>
      <GoldRule className="mb-10" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
        {(Object.entries(VERTICAL_META) as [Vertical, typeof VERTICAL_META[Vertical]][]).map(([key, meta]) => (
          <button
            key={key}
            onClick={() => onSelect(key)}
            onMouseEnter={() => setHovered(key)}
            onMouseLeave={() => setHovered(null)}
            className="group relative bg-card border border-border p-8 text-left flex flex-col transition-all duration-200 hover:border-primary/50"
            style={{ borderTopColor: hovered === key ? meta.color : undefined }}
          >
            {/* Corner mark */}
            <div
              className="absolute top-0 left-0 w-0 h-0 transition-all duration-300"
              style={{
                borderLeft: `${hovered === key ? 20 : 0}px solid ${meta.color}`,
                borderBottom: `${hovered === key ? 20 : 0}px solid transparent`,
              }}
            />

            <div
              className="font-mono text-3xl mb-6 transition-colors duration-200"
              style={{ color: hovered === key ? meta.color : "#4a4840" }}
            >
              {meta.icon}
            </div>

            <div className="font-mono text-xs tracking-widest text-muted-foreground mb-2">FILE TYPE</div>
            <h3 className="font-serif text-2xl text-foreground font-bold mb-3">{meta.label}</h3>
            <div className="font-mono text-xs text-primary mb-4">{meta.tagline}</div>
            <GoldRule className="mb-4" />
            <p className="font-mono text-xs text-muted-foreground leading-relaxed flex-1">{meta.description}</p>

            <div className="mt-6 font-mono text-xs flex items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors duration-200">
              <span>OPEN FILE</span>
              <span className="group-hover:translate-x-1 transition-transform duration-200">→</span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-8 font-mono text-xs text-muted-foreground">
        You may open multiple files in separate sessions to investigate different benefit types.
      </div>
    </div>
  );
}

// ─── Questions ────────────────────────────────────────────────────────────────

function QuestionScreen({
  caseNumber,
  vertical,
  onComplete,
}: {
  caseNumber: string;
  vertical: Vertical;
  onComplete: (answers: Record<string, string>) => void;
}) {
  const meta = VERTICAL_META[vertical];
  const allQuestions =
    vertical === "healthcare" ? HEALTHCARE_QUESTIONS :
    vertical === "housing" ? HOUSING_QUESTIONS :
    FINANCIALS_QUESTIONS;

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [logged, setLogged] = useState(false);
  const [selected, setSelected] = useState<string>("");

  const visibleQuestions = allQuestions.filter(
    (q) => !q.condition || q.condition(answers)
  );

  const current = visibleQuestions[currentIdx];
  const progress = currentIdx / visibleQuestions.length;

  const { displayed, done } = useTypewriter(current?.text ?? "", 20, true);
  sessionStorage.setItem("gemini-answer", "");

  useEffect(() => {
    setLogged(false);
    setSelected(answers[current?.id ?? ""] ?? "");
  }, [currentIdx, current?.id, answers]);

  const handleSelect = (value: string) => {
    setSelected(value);
  };

const handleNext = () => {
  if (!selected) return;
  const newAnswers = { ...answers, [current.id]: selected };
  setAnswers(newAnswers);

  const isLastQuestion = currentIdx + 1 >= visibleQuestions.length;

  if (!isLastQuestion) {
    setCurrentIdx((i) => i + 1);
  } else {
    onComplete(newAnswers);
  }
};

  if (!current) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col p-8 md:p-16 max-w-5xl mx-auto w-full">
      {/* Header */}
      <GoldRule />
      <div className="flex items-center justify-between mt-6 mb-8">
        <div className="font-mono text-xs text-primary tracking-widest">
          CASE #{caseNumber} / {meta.label.toUpperCase()} FILE
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          QUESTION {currentIdx + 1} OF {visibleQuestions.length}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-px bg-secondary mb-10 relative overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-primary transition-all duration-500"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Agent speaks */}
      <div className="flex gap-4 mb-8 max-w-2xl">
        <div className="shrink-0 w-8 h-8 border border-primary flex items-center justify-center font-mono text-xs text-primary">
          L
        </div>
        <div>
          <div className="font-mono text-xs text-muted-foreground mb-2">AGENT COSMAS ASKS:</div>
          <p className="font-serif text-xl md:text-2xl text-foreground font-bold leading-snug min-h-[2.5rem]">
            {displayed}
          </p>
          {current.subtext && done && (
            <p className="font-mono text-xs text-muted-foreground mt-3">{current.subtext}</p>
          )}
        </div>
      </div>

      {/* Options */}
      {done && (
        <div className="space-y-2 max-w-xl ml-12 mb-10">
          {current.type === "searchable-select" ? (
            <SearchableSelect
              options={CALIFORNIA_COUNTIES}
              value={selected}
              onChange={handleSelect}
              isSelected={selected !== ""}
            />
          ) : (
            current.options?.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className={`w-full text-left font-mono text-sm px-4 py-3 border transition-all duration-150 flex items-center gap-3
                  ${selected === opt.value
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
              >
                <span className={`w-3 h-3 border shrink-0 flex items-center justify-center
                  ${selected === opt.value ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                  {selected === opt.value && (
                    <span className="w-1.5 h-1.5 bg-primary-foreground block" />
                  )}
                </span>
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}

      {/* Log evidence / next */}
      {done && (
        <div className="ml-12 flex items-center gap-4">
          <button
            onClick={handleNext}
              disabled={!selected}
              className={`font-mono text-sm px-6 py-3 tracking-widest transition-all duration-150 flex items-center gap-3
                ${selected
                  ? "bg-primary text-primary-foreground hover:bg-foreground"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
            >
              LOG EVIDENCE →
            </button>
        </div>
      )}

      {/* Case notes sidebar hint */}
      <div className="mt-auto pt-10">
        <GoldRule />
        <div className="mt-4 font-mono text-xs text-muted-foreground">
          Your answers never leave this device. All data is erased when you close this tab.
        </div>
      </div>
    </div>
  );
}

// ─── Processing ───────────────────────────────────────────────────────────────

function Processing({ onDone }: { onDone: () => void }) {
  const steps = [
    "Parsing case evidence...",
    "Cross-referencing federal program databases...",
    "Evaluating HHS income thresholds...",
    "Checking household composition rules...",
    "Scanning for overlooked programs...",
    "Compiling eligibility report...",
    "Case analysis complete.",
  ];

  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    if (stepIdx < steps.length - 1) {
      const t = setTimeout(() => setStepIdx((i) => i + 1), 480);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(onDone, 100);
      return () => clearTimeout(t);
    }
  }, [stepIdx, steps.length, onDone]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      <div className="max-w-lg w-full">
        <GoldRule />
        <div className="mt-8 mb-10">
          <div className="font-mono text-xs text-primary tracking-widest mb-4">AGENT COSMAS / ANALYSIS IN PROGRESS</div>
          <h2 className="font-serif text-3xl text-foreground font-bold">Processing Your Case</h2>
        </div>

        <div className="space-y-3">
          {steps.slice(0, stepIdx + 1).map((step, i) => (
            <div key={i} className="flex items-center gap-3 font-mono text-sm">
              <span className={i < stepIdx ? "text-primary" : "text-muted-foreground animate-pulse"}>
                {i < stepIdx ? "◆" : "◈"}
              </span>
              <span className={i < stepIdx ? "text-muted-foreground" : "text-foreground"}>
                {step}
              </span>
            </div>
          ))}
        </div>

        <GoldRule className="mt-10" />
      </div>
    </div>
  );
}

// ─── Fact Flashcard Component ─────────────────────────────────────────────────

function FactFlashcard({ programName }: { programName: string }) {
  // Filter facts for this specific program
  const facts = PROGRAM_FACTS.filter((f) => f.program === programName);
  
  if (facts.length === 0) return null;

  // Grab a consistent pseudo-random fact based on the length to prevent jumping on re-renders
  const selectedFact = facts[Math.floor(programName.length % facts.length)];

  return (
    <div className="bg-[#1a1a1a] border border-[#c8972a]/30 p-4 mb-4 relative overflow-hidden group hover:border-[#c8972a] transition-colors duration-300">
      <div className="absolute -top-4 -right-4 w-12 h-12 bg-[#c8972a]/5 rounded-full flex items-center justify-center font-mono text-xl text-[#c8972a]/20 font-bold group-hover:bg-[#c8972a]/10 transition-colors">
        ?
      </div>
      <div className="font-mono text-[10px] text-[#c8972a] tracking-widest mb-1 uppercase">FUN FACT</div>
      <div className="font-serif text-sm text-white font-bold mb-2">{programName}</div>
      <p className="font-mono text-xs text-gray-400 leading-relaxed z-10 relative">
        "{selectedFact.text}"
      </p>
    </div>
  );
}

// ─── Verdict ──────────────────────────────────────────────────────────────────

function Verdict({
  caseNumber,
  vertical,
  programs,
  onRestart,
  answers,
}: {
  caseNumber: string;
  vertical: Vertical;
  programs: Program[];
  onRestart: () => void;
  answers: Record<string, string>;
}) {
  const [userQuestion, setUserQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  
  const [history, setHistory] = useState<ChatTurn[]>(() => {
    const saved = sessionStorage.getItem(`chat_history_${caseNumber}`);
    return saved ? JSON.parse(saved) : [];
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history, isAsking]);

  useEffect(() => {
    sessionStorage.setItem(`chat_history_${caseNumber}`, JSON.stringify(history));
  }, [history, caseNumber]);

  const handleAsk = async () => {
    if (!userQuestion.trim() || isAsking) return;
    
    const currentQuestion = userQuestion;
    setUserQuestion("");
    setIsAsking(true);

    setHistory((prev) => [...prev, { role: "user", text: currentQuestion }]);

    try {
      let data;
      if (history.length === 0) {
        const userDataString = `User Context: ${JSON.stringify(answers)}. User Question: ${currentQuestion}`;
        data = await submitPrompt(userDataString, vertical);
      } else {
        data = await submitChat(history, vertical, currentQuestion);
      }

      const modelText = typeof data === "string" ? data : data?.response;
      setHistory((prev) => [...prev, { role: "model", text: modelText || "No response received." }]);

    } catch (error: any) {
      console.error("Error asking AI:", error);
      setHistory((prev) => [
        ...prev, 
        { role: "model", text: error.message || "Error communicating with Agent Cosmas. Please try again." }
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  const eligible = programs.filter((p) => p.eligible);
  const ineligible = programs.filter((p) => !p.eligible);
  const hasEligible = eligible.length > 0;
  const immediate = eligible.filter((p) => p.urgency === "immediate");

  return (
    <div className="min-h-screen bg-background flex flex-col p-8 md:p-16 max-w-7xl mx-auto w-full">
      <div className="flex flex-col lg:flex-row gap-12">
        
        {/* Left Side: Main Investigation Report */}
        <div className="flex-1">
          <div className="w-full h-[2px] bg-[#c8972a] mb-6 opacity-50" />
          <div className="mt-6 mb-2 font-mono text-xs text-[#c8972a] tracking-widest uppercase">
            CASE #{caseNumber} / {vertical} FILE / VERDICT
          </div>

          {/* Verdict stamp */}
          <div className="mt-6 mb-8 flex items-start gap-8">
            <div>
              <div
                className="inline-block border-4 px-6 py-3 font-mono font-bold text-2xl md:text-3xl tracking-widest mb-4 rotate-[-2deg]"
                style={{
                  borderColor: hasEligible ? "#c8972a" : "#8b2020",
                  color: hasEligible ? "#c8972a" : "#8b2020",
                }}
              >
                {hasEligible ? "ELIGIBLE" : "INELIGIBLE"}
              </div>
              <h2 className="font-serif text-3xl md:text-4xl text-foreground font-bold leading-tight">
                {hasEligible
                  ? `${eligible.length} program${eligible.length > 1 ? "s" : ""} found for your case.`
                  : "No matching programs identified."}
              </h2>
              {hasEligible && (
                <p className="font-mono text-sm text-gray-400 mt-3 max-w-xl">
                  The evidence supports eligibility for the programs listed below. Each case is unique — contact the relevant agency to confirm and apply.
                </p>
              )}
            </div>
          </div>

          <div className="w-full h-[2px] bg-[#c8972a] mb-8 opacity-50" />

          {/* Immediate action banner */}
          {immediate.length > 0 && (
            <div className="border border-[#c8972a]/40 bg-[#c8972a]/5 p-4 mb-8 flex items-start gap-3">
              <span className="text-[#c8972a] font-mono text-sm shrink-0">!</span>
              <div className="font-mono text-xs text-foreground">
                <span className="text-[#c8972a] font-bold">PRIORITY ACTION: </span>
                {immediate.map((p) => p.name).join(", ")} — Apply as soon as possible for immediate assistance.
              </div>
            </div>
          )}

          {/* Eligible programs */}
          {eligible.length > 0 && (
            <div className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <div className="font-mono text-xs text-[#c8972a] tracking-widest">AUTHORIZED PROGRAMS ({eligible.length})</div>
                <CopyEligibleButton programs={eligible} />
              </div>
              <div className="space-y-3">
                {eligible.map((p) => (
                  <div key={p.name} className="bg-[#1a1a1a] border border-[#333] p-5 group hover:border-[#c8972a]/30 transition-colors duration-200">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-mono text-xs text-[#c8972a]">◆ ELIGIBLE</span>
                          {p.urgency === "immediate" && (
                            <span className="font-mono text-xs text-red-500 border border-red-500 px-2 py-0.5">PRIORITY</span>
                          )}
                        </div>
                        <h3 className="font-serif text-lg text-foreground font-bold">{p.name}</h3>
                        <div className="font-mono text-xs text-gray-400">{p.agency}</div>
                      </div>
                    </div>
                    <div className="w-full h-[1px] bg-[#c8972a] mb-3 opacity-30" />
                    <p className="font-mono text-xs text-gray-400 mb-3 leading-relaxed">{p.description}</p>
                    <div className="font-mono text-xs text-foreground">
                      <span className="text-[#c8972a] mr-2">WHY:</span>{p.reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ineligible programs */}
          {ineligible.length > 0 && (
            <div className="mb-10">
              <div className="font-mono text-xs text-gray-500 tracking-widest mb-4">
                REVIEWED — DID NOT QUALIFY ({ineligible.length})
              </div>
              <div className="space-y-2">
                {ineligible.map((p) => (
                  <div key={p.name} className="bg-[#1a1a1a] border border-[#333] p-4 opacity-50">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-mono text-xs text-gray-500 mb-1">✕ INELIGIBLE</div>
                        <div className="font-serif text-sm text-foreground font-bold">{p.name}</div>
                        <div className="font-mono text-xs text-gray-500 mt-1">{p.reason}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expanding Chat Section */}
          <div className="mt-12 bg-[#1a1a1a] border border-[#c8972a]/20 p-6 flex flex-col">
            <div className="font-mono text-xs text-[#c8972a] tracking-widest mb-4">
              ASK AGENT COSMAS
            </div>

            {/* Chat History Window */}
            {history.length > 0 && (
              <div className="mb-6 space-y-4 max-h-[600px] overflow-y-auto pr-2 flex-grow transition-all duration-300">
                {history.map((msg, idx) => (
                  <div key={idx} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    <div className="font-mono text-[10px] text-gray-500 mb-1 opacity-70">
                      {msg.role === "user" ? "YOU" : "AGENT COSMAS"}
                    </div>
                    <div 
                      className={`p-4 max-w-[85%] font-mono text-sm leading-relaxed [&_h1]:font-serif [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-2 [&_h2]:font-serif [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:font-serif [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_strong]:font-bold [&_em]:italic ${
                        msg.role === "user" 
                          ? "bg-[#c8972a] text-black [&_a]:text-blue-900 [&_a]:underline [&_a]:font-bold [&_a]:hover:opacity-80 [&_a]:cursor-pointer [&_a]:transition-opacity" 
                          : "bg-[#c8972a]/5 border border-[#c8972a]/30 text-white [&_a]:text-blue-400 [&_a]:underline [&_a]:cursor-pointer [&_a]:hover:text-blue-300 [&_a]:transition-colors [&_a]:font-semibold"
                      }`}
                    >
                      <div dangerouslySetInnerHTML={{ __html: (msg.text || "").replace(/\n/g, '<br/>') }} />
                    </div>
                  </div>
                ))}
                {isAsking && (
                   <div className="font-mono text-xs text-[#c8972a] animate-pulse mt-4">
                      Agent Cosmas is analyzing records...
                   </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}

	    {/* Suggested Questions (Only show on first prompt) */}
            {history.length === 0 && (
              <div className="flex flex-row flex-wrap gap-3 mb-4">
                <button
                  onClick={() => setUserQuestion("What are the next steps for ")}
                  className="font-mono text-xs px-3 py-2 border border-[#c8972a]/40 text-[#c8972a] hover:bg-[#c8972a]/10 transition-colors text-left"
                >
                  "What are the next steps for ___?"
                </button>
                <button
                  onClick={() => setUserQuestion("why don't I qualify for ")}
                  className="font-mono text-xs px-3 py-2 border border-[#c8972a]/40 text-[#c8972a] hover:bg-[#c8972a]/10 transition-colors text-left"
                >
                  "Why don't I qualify for ___?"
                </button>
                <button
                  onClick={() => setUserQuestion("Can you check for more opportunities?")}
                  className="font-mono text-xs px-3 py-2 border border-[#c8972a]/40 text-[#c8972a] hover:bg-[#c8972a]/10 transition-colors text-left"
                >
                  "Can you check for more opportunities?"
                </button>
              </div>
            )}

            {/* Input Area */}
            <textarea
              value={userQuestion}
              onChange={(e) => setUserQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAsk();
                }
              }}
              placeholder="Ask a question about your eligibility results... (Press Enter to send)"
              className="w-full bg-[#111] border border-[#333] p-3 font-mono text-sm text-white focus:border-[#c8972a] outline-none resize-y min-h-[80px]"
              disabled={isAsking}
            />
            <div className="flex justify-between items-center mt-4">
              <button
                onClick={handleAsk}
                disabled={isAsking || !userQuestion.trim()}
                className="font-mono text-xs px-6 py-2 bg-[#c8972a] text-black hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold"
              >
                {isAsking ? "ANALYZING..." : "SUBMIT QUERY →"}
              </button>
              
              {history.length > 0 && (
                <button 
                  onClick={() => {
                    sessionStorage.removeItem(`chat_history_${caseNumber}`);
                    setHistory([]);
                  }}
                  className="font-mono text-[10px] text-gray-500 hover:text-red-400 transition-colors"
                >
                  [ CLEAR TRANSCRIPT ]
                </button>
              )}
            </div>
          </div>
          
          {/* Disclaimer */}
          <div className="bg-[#1a1a1a] border border-[#333] p-5 mb-8 mt-8">
            <div className="font-mono text-xs text-[#c8972a] tracking-widest mb-2">AGENT COSMAS / CASE NOTES</div>
            <div className="w-full h-[1px] bg-[#c8972a] mb-3 opacity-30" />
            <p className="font-mono text-xs text-gray-400 leading-relaxed">
              This determination is based on federal program guidelines and the evidence you provided. Actual eligibility is determined by the issuing agency and may vary by state, local rules, or changes in circumstances. This is not legal or financial advice.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 no-print">
            <button
              onClick={onRestart}
              className="font-mono text-sm px-8 py-4 bg-[#c8972a] text-black tracking-widest hover:bg-white transition-colors duration-200 flex items-center justify-center font-bold"
            >
              OPEN NEW CASE →
            </button>
            <button
              onClick={() => window.print()}
              className="font-mono text-sm px-8 py-4 border border-[#333] text-gray-400 tracking-widest hover:border-[#c8972a]/40 hover:text-white transition-colors duration-200"
            >
              PRINT REPORT
            </button>
          </div>

          <div className="w-full h-[2px] bg-[#c8972a] mt-10 opacity-50" />
          <div className="mt-4 font-mono text-xs text-gray-500">
            Case #{caseNumber} closed. No data was stored.
          </div>
        </div>

        {/* Right Margin: Fun Facts (only rendering if there are eligible programs) */}
        {hasEligible && (
          <div className="w-full lg:w-80 shrink-0 no-print mt-12 lg:mt-0 pt-6">
            <div className="sticky top-8">
              <div className="font-mono text-[10px] text-gray-500 tracking-widest mb-4">
                SUPPLEMENTAL PROGRAM DATA
              </div>
              
              {/* Maps over only the eligible programs to generate their specific flashcards */}
              {eligible.map((program) => (
                <FactFlashcard key={`fact-${program.name}`} programName={program.name} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [step, setStep] = useState<AppStep>("landing");
  const [caseNumber] = useState(generateCaseNumber);
  const [vertical, setVertical] = useState<Vertical | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [programs, setPrograms] = useState<Program[]>([]);
  const [geminiAnswer, setGeminiAnswer] = useState("");

  const handleVerticalSelect = (v: Vertical) => {
    setVertical(v);
    setStep("questions");
    sessionStorage.clear();
  };

  const handleQuestionsComplete = (a: Record<string, string>) => {
    setAnswers(a);
    setStep("processing");
  };
  
  const handleProcessingDone = () => {
    if (!vertical) return;
    const results = getEligibilityResults(vertical, answers);
    setPrograms(results);
    setStep("verdict");
  };

  const handleRestart = () => {
    setVertical(null);
    setAnswers({});
    setPrograms([]);
    setStep("landing");
    sessionStorage.clear();
  };

  const runGeminiAnalysis = async (userQuestion: string) => {
    try {
      const geminiAnswer = await submitPrompt(
        { 
          ...answers, 
          customQuestion: userQuestion 
        }, 
        vertical!
      );
      sessionStorage.setItem("gemini-answer", String(geminiAnswer));
      return String(geminiAnswer);
    } catch (error) {
      console.error("Error calling Gemini:", error);
    }
  };
  
  return (
    <div
      className="min-h-screen bg-background"
      style={{ fontFamily: "'DM Mono', monospace" }}
    >
      <style>{`
        h1, h2, h3, h4 { font-family: 'Playfair Display', serif; }
        .font-serif { font-family: 'Playfair Display', serif; }
        .font-mono { font-family: 'DM Mono', monospace; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #c8972a33; }
        ::-webkit-scrollbar-thumb:hover { background: #c8972a66; }
        @media print {
          .no-print { display: none; }
        }
      `}</style>

      <ScanlineOverlay />

      {step === "landing" && (
        <Landing caseNumber={caseNumber} onStart={() => setStep("vertical")} />
      )}

      {step === "vertical" && (
        <VerticalSelect caseNumber={caseNumber} onSelect={handleVerticalSelect} />
      )}

      {step === "questions" && vertical && (
        <QuestionScreen
          caseNumber={caseNumber}
          vertical={vertical}
          onComplete={handleQuestionsComplete}
        />
      )}

      {step === "processing" && (
        <Processing onDone={handleProcessingDone} />
      )}

      {step === "verdict" && vertical && (
        <Verdict
          caseNumber={caseNumber}
          vertical={vertical}
          programs={programs}
          onRestart={handleRestart}
          answers={answers}
        />
      )}
    </div>
  );
}