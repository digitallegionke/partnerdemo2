import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const industries = [
  { label: "Food & Beverage", value: "food-beverage" },
  { label: "Retail", value: "retail" },
  { label: "Courier/Logistics", value: "courier-logistics" },
  { label: "E-commerce", value: "e-commerce" },
  { label: "Pharmacy & Medical", value: "pharmacy-medical" },
  { label: "Wholesale / Distribution", value: "wholesale-distribution" },
  { label: "Manufacturing / Supply Chain", value: "manufacturing" },
  { label: "Agriculture / Fresh Produce", value: "agriculture" },
  { label: "Construction / Building Materials", value: "construction" },
  { label: "Field Services / Utilities", value: "services" },
  { label: "Other", value: "other" },
];

