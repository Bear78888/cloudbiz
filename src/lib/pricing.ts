import { LIMITS, PRICING, type PaidProductCode } from "./config";

/**
 * Interpolation variables for price/limit strings, derived from config
 * (spec §6.2: no hardcoded prices inside components).
 */
export function toolVars(code: PaidProductCode): Record<string, string | number> {
  switch (code) {
    case "call_answering":
      return {
        price: PRICING.call_answering.monthly,
        minutes: LIMITS.call_answering.includedMinutes,
        overage: LIMITS.call_answering.overagePerMinute.toFixed(2),
      };
    case "estimate_quote_maker":
      return { price: PRICING.estimate_quote_maker.monthly };
    case "reviews_followups":
      return {
        price: PRICING.reviews_followups.monthly,
        sms: LIMITS.reviews_followups.includedSms,
      };
    case "bad_lead_refund_helper":
      return {
        price: PRICING.bad_lead_refund_helper.monthly,
        oneTime: PRICING.bad_lead_refund_helper.oneTime,
        analyses: LIMITS.bad_lead_refund_helper.includedAnalyses,
      };
    case "business_website":
      return {
        monthly: PRICING.business_website.monthly,
        yearly: PRICING.business_website.yearly,
        sites: LIMITS.business_website.sitesPerOrganization,
      };
  }
}

export const bundleVars: Record<string, string | number> = {
  price: PRICING.all_tools_bundle.monthly,
  save: PRICING.all_tools_bundle.savePercent,
  minutes: LIMITS.call_answering.includedMinutes,
  sms: LIMITS.reviews_followups.includedSms,
  analyses: LIMITS.bad_lead_refund_helper.includedAnalyses,
};
