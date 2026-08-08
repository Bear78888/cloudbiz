import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const requiredText = (max: number) => z.string().trim().min(1).max(max);

export const quotePayloadSchema = z.object({
  contact: z.object({
    firstName: requiredText(80),
    lastName: requiredText(80),
    company: optionalText(160),
    email: z.string().trim().email().max(254),
    phone: requiredText(50),
    messenger: optionalText(120),
    country: requiredText(100),
    preferredLanguage: z.enum(["en", "ru"]),
    timezone: optionalText(100),
  }),
  selling: z.object({
    amazonStatus: requiredText(40),
    marketplaces: z.array(requiredText(40)).min(1).max(10),
    monthlyVolume: requiredText(80),
    numberOfSkus: requiredText(40),
    firstUSShipment: requiredText(20),
    currentPrepCenter: requiredText(20),
    readiness: requiredText(40),
  }),
  product: z.object({
    category: requiredText(120),
    description: requiredText(2000),
    brand: optionalText(160),
    manufactureCountry: requiredText(100),
    supplierCountry: requiredText(100),
    totalUnits: requiredText(60),
    numberOfSkus: requiredText(40),
    cartonsPallets: optionalText(80),
    unitDimensions: optionalText(120),
    unitWeight: optionalText(80),
    cartonDimensions: optionalText(120),
    arrivalDate: optionalText(60),
  }),
  services: z.array(requiredText(80)).min(1).max(30),
  flags: z.array(requiredText(80)).min(1).max(30),
  final: z.object({
    heardFrom: optionalText(120),
    message: optionalText(4000),
    contactMethod: requiredText(40),
    callRequested: z.boolean(),
    intent: z.enum(["custom_quote", "pilot_shipment", "agency"]).default("custom_quote"),
    accurate: z.literal(true),
    approvalUnderstood: z.literal(true),
    termsAccepted: z.literal(true),
  }),
  tracking: z.object({
    utmSource: optionalText(200),
    utmMedium: optionalText(200),
    utmCampaign: optionalText(200),
    utmContent: optionalText(200),
    utmTerm: optionalText(200),
    referrer: optionalText(1000),
    landingPage: optionalText(1000),
    language: z.enum(["en", "ru"]),
    timestamp: requiredText(80),
    deviceCategory: optionalText(40),
    consentVersion: requiredText(40),
    turnstileToken: optionalText(4000),
    website: optionalText(200),
  }),
});

export type QuotePayload = z.infer<typeof quotePayloadSchema>;

const baseLead = z.object({
  locale: z.enum(["en", "ru"]),
  tracking: z.object({
    utmSource: optionalText(200),
    utmMedium: optionalText(200),
    utmCampaign: optionalText(200),
    referrer: optionalText(1000),
    landingPage: optionalText(1000),
    timestamp: requiredText(80),
    turnstileToken: optionalText(4000),
    website: optionalText(200),
  }),
});

export const contactLeadSchema = baseLead.extend({
  type: z.literal("contact"),
  fields: z.object({
    name: requiredText(160),
    email: z.string().trim().email().max(254),
    topic: requiredText(80),
    message: requiredText(4000),
    language: z.enum(["en", "ru"]),
  }),
});

export const agencyLeadSchema = baseLead.extend({
  type: z.literal("agency"),
  fields: z.object({
    agencyName: requiredText(200),
    website: optionalText(500),
    contactPerson: requiredText(160),
    email: z.string().trim().email().max(254),
    phone: requiredText(50),
    countriesServed: requiredText(500),
    activeSellers: requiredText(80),
    monthlyUnits: requiredText(80),
    requiredServices: z.array(requiredText(80)).min(1).max(30),
    partnershipModel: requiredText(80),
    whiteLabel: requiredText(20),
    message: optionalText(4000),
  }),
});

export const leadPayloadSchema = z.discriminatedUnion("type", [contactLeadSchema, agencyLeadSchema]);
export type LeadPayload = z.infer<typeof leadPayloadSchema>;
