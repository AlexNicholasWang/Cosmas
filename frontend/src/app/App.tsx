import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Vertical = "healthcare" | "housing" | "financials";
type AppStep = "landing" | "vertical" | "questions" | "processing" | "verdict";

interface Question {
  id: string;
  text: string;
  subtext?: string;
  type: "select" | "radio" | "number";
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
}

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

  useEffect(() => {
    setLogged(false);
    setSelected(answers[current?.id ?? ""] ?? "");
  }, [currentIdx]);

  const handleSelect = (value: string) => {
    setSelected(value);
  };

  const handleNext = () => {
    if (!selected) return;
    const newAnswers = { ...answers, [current.id]: selected };
    setAnswers(newAnswers);
    setLogged(true);

    setTimeout(() => {
      if (currentIdx + 1 < visibleQuestions.length) {
        setCurrentIdx((i) => i + 1);
      } else {
        onComplete(newAnswers);
      }
    }, 700);
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
          {current.options?.map((opt) => (
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
          ))}
        </div>
      )}

      {/* Log evidence / next */}
      {done && (
        <div className="ml-12 flex items-center gap-4">
          {logged ? (
            <div className="font-mono text-xs text-primary flex items-center gap-2">
              <span>◆</span> EVIDENCE LOGGED — PROCEEDING...
            </div>
          ) : (
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
          )}
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
      const t = setTimeout(onDone, 900);
      return () => clearTimeout(t);
    }
  }, [stepIdx]);

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

// ─── Verdict ──────────────────────────────────────────────────────────────────

function Verdict({
  caseNumber,
  vertical,
  programs,
  onRestart,
}: {
  caseNumber: string;
  vertical: Vertical;
  programs: Program[];
  onRestart: () => void;
}) {
  const eligible = programs.filter((p) => p.eligible);
  const ineligible = programs.filter((p) => !p.eligible);
  const hasEligible = eligible.length > 0;
  const immediate = eligible.filter((p) => p.urgency === "immediate");
  const meta = VERTICAL_META[vertical];

  return (
    <div className="min-h-screen bg-background flex flex-col p-8 md:p-16 max-w-5xl mx-auto w-full">
      <GoldRule />
      <div className="mt-6 mb-2 font-mono text-xs text-primary tracking-widest">
        CASE #{caseNumber} / {meta.label.toUpperCase()} FILE / VERDICT
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
            <p className="font-mono text-sm text-muted-foreground mt-3 max-w-xl">
              The evidence supports eligibility for the programs listed below. Each case is unique — contact the relevant agency to confirm and apply.
            </p>
          )}
        </div>
      </div>

      <GoldRule className="mb-8" />

      {/* Immediate action banner */}
      {immediate.length > 0 && (
        <div className="border border-primary/40 bg-primary/5 p-4 mb-8 flex items-start gap-3">
          <span className="text-primary font-mono text-sm shrink-0">!</span>
          <div className="font-mono text-xs text-foreground">
            <span className="text-primary font-bold">PRIORITY ACTION: </span>
            {immediate.map((p) => p.name).join(", ")} — Apply as soon as possible for immediate assistance.
          </div>
        </div>
      )}

      {/* Eligible programs */}
      {eligible.length > 0 && (
        <div className="mb-10">
          <div className="font-mono text-xs text-primary tracking-widest mb-4">AUTHORIZED PROGRAMS ({eligible.length})</div>
          <div className="space-y-3">
            {eligible.map((p) => (
              <div key={p.name} className="bg-card border border-border p-5 group hover:border-primary/30 transition-colors duration-200">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-mono text-xs text-primary">◆ ELIGIBLE</span>
                      {p.urgency === "immediate" && (
                        <span className="font-mono text-xs text-destructive border border-destructive px-2 py-0.5">PRIORITY</span>
                      )}
                    </div>
                    <h3 className="font-serif text-lg text-foreground font-bold">{p.name}</h3>
                    <div className="font-mono text-xs text-muted-foreground">{p.agency}</div>
                  </div>
                </div>
                <GoldRule className="mb-3" />
                <p className="font-mono text-xs text-muted-foreground mb-3 leading-relaxed">{p.description}</p>
                <div className="font-mono text-xs text-foreground">
                  <span className="text-primary mr-2">WHY:</span>{p.reason}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ineligible programs */}
      {ineligible.length > 0 && (
        <div className="mb-10">
          <div className="font-mono text-xs text-muted-foreground tracking-widest mb-4">
            REVIEWED — DID NOT QUALIFY ({ineligible.length})
          </div>
          <div className="space-y-2">
            {ineligible.map((p) => (
              <div key={p.name} className="bg-card border border-border p-4 opacity-50">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-xs text-muted-foreground mb-1">✕ INELIGIBLE</div>
                    <div className="font-serif text-sm text-foreground font-bold">{p.name}</div>
                    <div className="font-mono text-xs text-muted-foreground mt-1">{p.reason}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="bg-card border border-border p-5 mb-8">
        <div className="font-mono text-xs text-primary tracking-widest mb-2">AGENT LYRA / CASE NOTES</div>
        <GoldRule className="mb-3" />
        <p className="font-mono text-xs text-muted-foreground leading-relaxed">
          This determination is based on federal program guidelines and the evidence you provided. Actual eligibility is determined by the issuing agency and may vary by state, local rules, or changes in circumstances. This is not legal or financial advice. Contact 211 (dial 2-1-1) or BenefitsCheckUp.org for further assistance.
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={onRestart}
          className="font-mono text-sm px-8 py-4 bg-primary text-primary-foreground tracking-widest hover:bg-foreground transition-colors duration-200 flex items-center gap-3"
        >
          OPEN NEW CASE →
        </button>
        <button
          onClick={() => window.print()}
          className="font-mono text-sm px-8 py-4 border border-border text-muted-foreground tracking-widest hover:border-primary/40 hover:text-foreground transition-colors duration-200"
        >
          PRINT REPORT
        </button>
      </div>

      <GoldRule className="mt-10" />
      <div className="mt-4 font-mono text-xs text-muted-foreground">
        Case #{caseNumber} closed. No data was stored.
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

  const handleVerticalSelect = (v: Vertical) => {
    setVertical(v);
    setStep("questions");
  };

  const handleQuestionsComplete = (a: Record<string, string>) => {
    setAnswers(a);
    setStep("processing");
  };

  const handleProcessingDone = () => {
    if (!vertical) return;
    setPrograms(getEligibilityResults(vertical, answers));
    setStep("verdict");
  };

  const handleRestart = () => {
    setVertical(null);
    setAnswers({});
    setPrograms([]);
    setStep("landing");
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
          key={vertical}
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
        />
      )}
    </div>
  );
}
