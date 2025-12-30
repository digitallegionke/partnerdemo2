import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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

/**
 * Validates Kenyan phone number format
 * Accepts formats like: +254712345678, +254 712 345 678, 0712345678, 254712345678
 * Returns normalized format: +254712345678
 */
export function validateKenyanPhone(phone: string): { valid: boolean; normalized?: string; error?: string } {
  if (!phone || !phone.trim()) {
    return { valid: false, error: "Phone number is required" };
  }

  // Remove spaces, dashes, and parentheses
  let cleaned = phone.trim().replace(/[\s\-()]/g, "");

  // Check if it's a valid Kenyan number
  // Pattern: starts with +254, 254, or 0
  let normalized = "";

  if (cleaned.startsWith("+254")) {
    // Already has +254 prefix
    normalized = cleaned;
  } else if (cleaned.startsWith("254")) {
    // Has 254 without +
    normalized = "+" + cleaned;
  } else if (cleaned.startsWith("0")) {
    // Has leading 0, convert to +254
    normalized = "+254" + cleaned.substring(1);
  } else {
    return { valid: false, error: "Phone number must start with +254, 254, or 0" };
  }

  // Validate length: +254 + 9 digits = 13 characters
  if (normalized.length !== 13) {
    return { valid: false, error: "Kenyan phone number must have 9 digits after country code" };
  }

  // Validate that the number part is all digits
  if (!/^\+254\d{9}$/.test(normalized)) {
    return { valid: false, error: "Phone number must contain only digits" };
  }

  // Validate mobile operator prefixes (common Kenyan patterns)
  const operatorPrefixes = ["0701", "0702", "0703", "0704", "0705", "0706", "0707", "0708", "0709", "0710", "0711", "0712", "0713", "0714", "0715", "0716", "0717", "0718", "0719", "0720", "0721", "0722", "0723", "0724", "0725", "0726", "0727", "0728", "0729", "0730", "0731", "0732", "0733", "0734", "0735", "0736", "0737", "0738", "0739", "0740", "0741", "0742", "0743", "0744", "0745", "0746", "0747", "0748", "0749", "0750", "0751", "0752", "0753", "0754", "0755", "0756", "0757", "0758", "0759", "0760", "0761", "0762", "0763", "0764", "0765", "0766", "0767", "0768", "0769", "0770", "0771", "0772", "0773", "0774", "0775", "0776", "0777", "0778", "0779", "0780", "0781", "0782", "0783", "0784", "0785", "0786", "0787", "0788", "0789", "0790", "0791", "0792", "0793", "0794", "0795", "0796", "0797", "0798", "0799"];

  const last9Digits = "0" + normalized.substring(4); // Convert back to 0-prefixed format for checking
  const validPrefix = operatorPrefixes.some(prefix => last9Digits.startsWith(prefix));

  if (!validPrefix) {
    return { valid: false, error: "Invalid Kenyan phone number format" };
  }

  return { valid: true, normalized };
}

