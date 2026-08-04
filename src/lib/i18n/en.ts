/**
 * English (en-US) dictionary. This file defines the canonical shape:
 * `es.ts` must satisfy `Dict` (typeof en), so a missing or extra key in
 * Spanish fails `npm run typecheck` (spec §9.4 missing-key check).
 *
 * Copy rules: plain words, no corporate jargon, results before technology
 * (spec §8.1–8.2). All seed copy is a draft for owner approval (§00.2).
 */

export const en = {
  meta: {
    siteName: "HandyAlliance",
    home: {
      title: "HandyAlliance — Simple Tools for Home Service Pros",
      description:
        "Answer calls, create estimates, follow up with customers, protect your lead budget, build your website, and keep every job organized.",
    },
    tools: {
      title: "Tools — HandyAlliance",
      description:
        "Five simple paid tools plus a free Job Tracker. Use them separately or together.",
    },
    jobTracker: {
      title: "Job Tracker — Free — HandyAlliance",
      description:
        "Keep customers, estimates, jobs, payments, and follow-ups in one simple table. Free forever, with automatic Google Sheets sync.",
    },
    pricing: {
      title: "Pricing — HandyAlliance",
      description:
        "Simple monthly prices. Pick one tool, a few, or get All Tools and save about 30%.",
    },
    signIn: {
      title: "Sign In — HandyAlliance",
      description: "Sign in to your HandyAlliance account.",
    },
    signUp: {
      title: "Create Account — HandyAlliance",
      description: "Create your free HandyAlliance account and start with the free Job Tracker.",
    },
  },

  nav: {
    tools: "Tools",
    pricing: "Pricing",
    trades: "For Your Trade",
    jobTracker: "Job Tracker",
    signIn: "Sign In",
    chooseTools: "Choose My Tools",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    switchLocale: "Español",
    switchLocaleLabel: "Cambiar a español",
  },

  common: {
    free: "Free",
    from: "From",
    perMonth: "/month",
    perYear: "/year",
    or: "or",
    oneTime: "one time",
    learnMore: "Learn more",
    getStarted: "Get Started",
    seePricing: "See Pricing",
    includedInBundle: "Included in All Tools",
    allToolsName: "All Tools",
    saveAbout: "Save about 30%",
    comingSoon: "Coming soon",
    skipToContent: "Skip to content",
  },

  hero: {
    title: "Simple Tools for Home Service Pros",
    subtitle:
      "Answer calls, create estimates, follow up with customers, protect your lead budget, build your website, and keep every job organized.",
    ctaPrimary: "Choose My Tools",
    ctaSecondary: "Get All Tools — Save 30%",
    note: "Free Job Tracker included. No complicated CRM. Cancel anytime.",
    badges: ["Works in English & Spanish", "Built for your phone", "Syncs to Google Sheets"],
  },

  toolsSection: {
    heading: "Pick only the tools you need",
    subheading:
      "Each tool works on its own. Together, they share one company profile and one job list.",
  },

  tools: {
    call_answering: {
      name: "24/7 Call Answering",
      tagline: "Answers customer calls, asks what they need, and sends the job details to your phone.",
      cta: "Hear a Demo",
      priceLine: "From ${price}/month",
      detail: {
        promise:
          "Never lose a job because you were on a ladder. The assistant answers, asks the right questions, and texts you the details.",
        howTitle: "How it works",
        steps: [
          "A customer calls your business number — day or night.",
          "The assistant answers in English or Spanish and asks what they need, where, and how urgent it is.",
          "You get a text and email with the job details right away.",
          "The new job appears in your Job Tracker and your Google Sheet automatically.",
        ],
        featuresTitle: "What it does",
        features: [
          "Answers in English and Spanish",
          "Ready-made scripts for your trade — no setup from scratch",
          "Knows your services, hours, and service area",
          "Transfers urgent calls to you when you want",
          "Flags emergencies and notifies you immediately",
          "Every call becomes a job in your Job Tracker",
        ],
        limitsTitle: "Included in the price",
        limits: [
          "{minutes} minutes per month included",
          "${overage}/minute after that",
          "Unused minutes don't roll over",
        ],
        honestyTitle: "Straight talk",
        honesty: [
          "It always tells callers it's an automated assistant.",
          "It never promises prices or exact arrival times — that stays your call.",
          "It's not an emergency service and says so when someone is in danger.",
        ],
        faq: [
          {
            q: "What happens if the caller speaks Spanish?",
            a: "The assistant detects the language or offers a quick choice, then continues the whole call in Spanish. Your summary arrives in the language you chose for your account.",
          },
          {
            q: "Can it transfer calls to me?",
            a: "Yes. You choose when: always, only for urgent calls, or only during certain hours.",
          },
          {
            q: "Do I need new phone numbers?",
            a: "We set up a business number for the assistant. You can forward your existing line to it whenever you're busy.",
          },
        ],
      },
    },
    estimate_quote_maker: {
      name: "Estimate & Quote Maker",
      tagline: "Turn a voice note, job description, or photos into a professional estimate in minutes.",
      cta: "See How It Works",
      priceLine: "${price}/month",
      detail: {
        promise:
          "Describe the job the way you'd tell a friend. Get back a clean, professional estimate your customer can accept online.",
        howTitle: "How it works",
        steps: [
          "Describe the job — type it, record a voice note, or add photos.",
          "We draft the scope of work and line items using templates for your trade.",
          "You review everything and set the final price. Nothing goes out without your approval.",
          "Send it as a PDF or a secure link. Your customer can accept right from their phone.",
        ],
        featuresTitle: "What it does",
        features: [
          "Ready-made templates for your trade — faucet swaps, TV mounting, deep cleans, and more",
          "Estimates in English, Spanish, or both",
          "Labor, materials, and tax laid out clearly",
          "Customers accept or decline online — you get notified instantly",
          "Every estimate is linked to the job in your Job Tracker",
          "Statuses update automatically: sent, viewed, accepted",
        ],
        limitsTitle: "Included in the price",
        limits: ["Unlimited estimates", "PDF and secure web link included"],
        honestyTitle: "Straight talk",
        honesty: [
          "The draft is a starting point — you always confirm the final price before anything is sent.",
        ],
        faq: [
          {
            q: "Can I edit the estimate before sending?",
            a: "Always. You can change every line item, the price, the terms — everything. The estimate is only sent when you approve it.",
          },
          {
            q: "Can my customer accept it online?",
            a: "Yes. They open a secure link, see the estimate in their language, and tap Accept — you get notified and the job status updates.",
          },
        ],
      },
    },
    reviews_followups: {
      name: "Review Requests & Follow-Ups",
      tagline: "Send thank-you messages, review requests, estimate reminders, and polite follow-ups.",
      cta: "See Example Messages",
      priceLine: "${price}/month",
      detail: {
        promise:
          "The money is in the follow-up — but it's easy to forget. We draft the right message at the right moment; you just approve it.",
        howTitle: "How it works",
        steps: [
          "A job changes status — estimate sent, work scheduled, job done, payment received.",
          "We suggest the right message: a reminder, a thank-you, or a review request.",
          "You review the draft and tap send. That's it.",
        ],
        featuresTitle: "Message types",
        features: [
          "Thank-you messages after a completed job",
          "Estimate reminders so quotes don't go cold",
          "Appointment reminders that reduce no-shows",
          "Review requests with your real Google review link",
          "Payment reminders — polite but effective",
          "Seasonal reminders for repeat services",
        ],
        limitsTitle: "Included in the price",
        limits: ["{sms} text messages per month included", "Email messages — unlimited"],
        honestyTitle: "Straight talk",
        honesty: [
          "Messages go only to your real customers — this is not a mass-texting tool.",
          "Customers can reply STOP at any time, and we honor it automatically.",
          "We never write fake reviews or reward customers for positive ones.",
        ],
        faq: [
          {
            q: "Do messages send automatically?",
            a: "By default, no — we prepare a draft and you approve it. Once you're comfortable, you can turn on automatic sending for specific message types.",
          },
          {
            q: "Does it work in Spanish?",
            a: "Yes. Each customer has a preferred language, and messages are drafted in it automatically.",
          },
        ],
      },
    },
    bad_lead_refund_helper: {
      name: "Bad Lead Refund Helper",
      tagline: "Check a paid lead, see what evidence is missing, and create a clear refund request draft.",
      cta: "Check a Lead",
      priceLine: "${price}/month",
      priceLineExtra: "or ${oneTime} for a single check",
      detail: {
        promise:
          "Paid for a lead with a wrong number, wrong city, or a job nobody asked for? Build a clear, well-documented refund request in minutes.",
        howTitle: "How it works",
        steps: [
          "Upload screenshots of the lead and your conversation with the customer.",
          "We check them against the platform's refund reasons and show what evidence you have — and what's missing.",
          "You get a clear, editable refund request draft.",
          "You copy it and submit it yourself in your Thumbtack account.",
        ],
        featuresTitle: "What it does",
        features: [
          "Works with Thumbtack leads (more platforms later)",
          "Finds the strongest refund reason: wrong service, wrong location, duplicate, invalid contact, and more",
          "Shows exactly what evidence is missing before you submit",
          "Keeps every case organized and linked to the job",
          "Your screenshots stay private — never shared or published",
        ],
        limitsTitle: "Included in the price",
        limits: [
          "{analyses} lead checks per month with subscription",
          "Or pay ${oneTime} for a single check — no subscription needed",
        ],
        honestyTitle: "Straight talk",
        honesty: [
          "We help you organize the evidence and prepare a clearer refund request. The platform makes the final decision.",
          "We never log into your Thumbtack account or submit anything for you.",
          "No refund is ever guaranteed — anyone who promises that isn't being honest.",
        ],
        faq: [
          {
            q: "Do you guarantee the refund?",
            a: "No — and no honest service can. The platform makes the final decision. We make sure your request is clear, complete, and backed by the right evidence.",
          },
          {
            q: "Do you need my Thumbtack password?",
            a: "Never. You upload screenshots, we prepare the draft, and you submit it yourself from your own account.",
          },
        ],
      },
    },
    business_website: {
      name: "Business Website",
      tagline: "Get a professional mobile-friendly website built from a ready-made template for your trade.",
      cta: "See Templates",
      priceLine: "${yearly}/year",
      priceLineExtra: "or ${monthly}/month",
      detail: {
        promise:
          "A clean, professional website with your services, photos, and a contact form — live in minutes, not months.",
        howTitle: "How it works",
        steps: [
          "Pick the template for your trade.",
          "Your company profile fills in the site automatically — name, services, hours, service area.",
          "Add your photos, review the preview, and hit publish.",
          "Every contact form submission becomes a new job in your Job Tracker.",
        ],
        featuresTitle: "What's included",
        features: [
          "Professional template designed for your trade",
          "Works great on phones — where your customers are",
          "English, Spanish, or bilingual with a language switch",
          "Contact form that creates jobs and notifies you instantly",
          "Click-to-call button on every page",
          "Your address at handyalliance.com/pro/your-business",
        ],
        limitsTitle: "Included in the price",
        limits: ["{sites} website per business", "Hosting and updates included"],
        honestyTitle: "Straight talk",
        honesty: [
          "Templates keep it simple and affordable — this is not custom web design.",
          "We never invent licenses, reviews, or service areas for your site. What's published is what's true.",
        ],
        faq: [
          {
            q: "Can my website be in both languages?",
            a: "Yes. Choose English, Spanish, or both — bilingual sites get separate pages per language and a language switch.",
          },
          {
            q: "What happens when someone fills out the form?",
            a: "You get a text and email right away, and the request appears as a new job in your Job Tracker and your Google Sheet.",
          },
        ],
      },
    },
  },

  jobTracker: {
    name: "Job Tracker",
    badge: "Free",
    tagline: "Keep customers, estimates, jobs, payments, and follow-ups in one simple table.",
    cta: "Start Free",
    homeHeading: "Your jobs, organized — free",
    homeSub:
      "Every HandyAlliance account includes the Job Tracker. No trial, no card, no catch. It's the home base that all the other tools plug into.",
    page: {
      heroTitle: "One simple list for every job",
      heroSub:
        "From the first call to the final payment — customers, estimates, schedules, and payments in one place. Free forever.",
      flowTitle: "It follows your real workflow",
      flow: ["Call", "Lead", "Job", "Estimate", "Follow-Up", "Review", "Payment"],
      featuresTitle: "What you can do",
      features: [
        "Add a job in under a minute — or dictate it by voice",
        "See what's new, scheduled, in progress, and unpaid at a glance",
        "Track estimate amounts, job totals, and materials costs",
        "Search, filter, and sort everything",
        "Works beautifully on your phone with simple job cards",
        "Export to CSV anytime — your data is yours",
      ],
      voiceTitle: "Add a job by voice",
      voiceExample:
        "“John Smith needs a faucet replaced on Friday afternoon. Total quote is 280 dollars, and materials should cost around 45.”",
      voiceNote: "We fill in the fields; you confirm before anything is saved.",
      sampleTitle: "Simple cards on your phone",
      notCrmTitle: "Not a CRM — on purpose",
      notCrm:
        "No pipelines to configure, no sales stages to study. Just your customers and jobs in a simple list that stays organized by itself.",
      syncTitle: "Synced to your Google Sheet",
      syncText:
        "Every change lands in your own Google Sheet automatically — perfect for backups, accountants, or connecting other services.",
    },
  },

  sheets: {
    heading: "Your data lives in your Google Sheet too",
    promise: "Your jobs stay organized in HandyAlliance and sync automatically to your Google Sheet.",
    points: [
      "One click connects your Google account — we create the sheet for you",
      "Every job, customer, and estimate stays up to date automatically",
      "It's your sheet, in your Google Drive — you keep it even if you leave",
      "Connect Zapier, Make, or anything else that reads Google Sheets",
    ],
    sheetNote: "Edit jobs in HandyAlliance. This sheet updates automatically.",
    lastSynced: "Last synced: just now",
  },

  setupOnce: {
    heading: "Set up your company once",
    sub: "Your business name, services, hours, and service area power every tool. Fill them in once — every tool you add later is ready in minutes.",
    points: [
      "One profile shared by all your tools",
      "Add or remove tools anytime",
      "Everything speaks English and Spanish",
    ],
  },

  pricingPreview: {
    heading: "Simple prices, no surprises",
    sub: "Pick one tool, a few, or everything. The free Job Tracker is always included.",
    cta: "See Full Pricing",
  },

  pricingPage: {
    title: "Pricing",
    sub: "Every account starts with the free Job Tracker and Google Sheets sync. Add only the tools you need — or get everything and save about 30%.",
    perToolHeading: "Individual tools",
    bundleHeading: "Best value",
    bundle: {
      name: "All Tools — Save 30%",
      priceLine: "About ${price}/month",
      blurb: "All five paid tools, one simple subscription, about 30% cheaper than buying them separately.",
      includes: [
        "24/7 Call Answering — {minutes} minutes/month included",
        "Estimate & Quote Maker — unlimited estimates",
        "Review Requests & Follow-Ups — {sms} texts/month included",
        "Bad Lead Refund Helper — {analyses} checks/month",
        "Business Website — hosted while subscribed",
      ],
      cta: "Get All Tools",
    },
    freeCard: {
      name: "Job Tracker + Google Sheets Sync",
      priceLine: "Free forever",
      blurb: "Included with every account. Not a trial.",
      cta: "Start Free",
    },
    limitsNote:
      "Included limits and overage rates are always shown before you buy. Prices may change as we learn — existing subscribers are notified first.",
    faq: [
      {
        q: "Can I buy just one tool?",
        a: "Yes. Every tool works on its own. Start with one, add more whenever you want.",
      },
      {
        q: "What happens if I go over my included minutes or texts?",
        a: "Nothing stops working. Extra usage is billed at the posted overage rate, and we warn you before you get close to the limit.",
      },
      {
        q: "Can I cancel anytime?",
        a: "Yes. Cancel from your account in two clicks. Your Job Tracker and your Google Sheet stay yours, free.",
      },
      {
        q: "Is there a contract?",
        a: "No contracts. Monthly plans renew month to month; the website has a cheaper yearly option.",
      },
    ],
  },

  trades: {
    heading: "Built for your trade",
    sub: "Scripts, estimate templates, and website designs made for the work you actually do.",
    seeAll: "See how it works for your trade",
    page: {
      heroTitleTpl: "HandyAlliance for {trade}",
      heroSubTpl: "Tools that already know {trade} work — no setup from scratch.",
      templatesTitle: "Estimate templates ready to go",
      templatesSub: "Start from a template, adjust the numbers, send. Typical jobs we cover:",
      toolsTitle: "The tools, tuned for your trade",
      toolsSub: "Call scripts, estimate line items, follow-up messages, and website templates — all prepared for your kind of work.",
      ctaTitle: "Try it with your next job",
      ctaSub: "Start with the free Job Tracker. Add paid tools whenever you're ready.",
    },
    items: {
      handyman: {
        name: "Handyman",
        blurb: "From TV mounting to door repairs — keep every small job profitable and organized.",
        examples: ["TV Mounting", "Furniture Assembly", "Drywall Patch", "Door Repair", "Shelf Installation"],
      },
      plumbing: {
        name: "Plumbing",
        blurb: "Emergency calls answered, estimates out fast, follow-ups that win the job.",
        examples: ["Faucet Replacement", "Toilet Installation", "Leak Diagnosis", "Garbage Disposal Replacement"],
      },
      hvac: {
        name: "HVAC",
        blurb: "Seasonal rushes handled: calls answered 24/7 and maintenance reminders that bring customers back.",
        examples: ["Diagnostic Visit", "Thermostat Replacement", "Maintenance", "Installation Estimate"],
      },
      electrical: {
        name: "Electrical",
        blurb: "Professional estimates for every panel, fixture, and outlet — with safety-first call handling.",
        examples: ["Light Fixture Installation", "Outlet Replacement", "Troubleshooting Visit"],
      },
      cleaning: {
        name: "Cleaning",
        blurb: "Recurring schedules, quick quotes, and review requests that fill your calendar.",
        examples: ["Standard Cleaning", "Deep Cleaning", "Move-Out Cleaning"],
      },
      appliance_repair: {
        name: "Appliance Repair",
        blurb: "Diagnostic visits booked while you work, parts and labor quoted clearly.",
        examples: ["Diagnostic Visit", "Part Replacement", "Installation"],
      },
    },
  },

  demo: {
    heading: "See it in action",
    sub: "Real product screens are coming here as each tool ships. No stock testimonials, no invented reviews — just the product.",
  },

  faq: {
    heading: "Common questions",
    items: [
      {
        q: "Is the Job Tracker really free?",
        a: "Yes — free forever, including Google Sheets sync. It's the center of HandyAlliance, and the paid tools plug into it.",
      },
      {
        q: "Do I have to buy all the tools?",
        a: "No. Each tool works on its own. Buy one, a few, or get All Tools and save about 30%.",
      },
      {
        q: "Is this a CRM?",
        a: "No. It's a set of simple, ready-made tools. No pipelines, no training courses, no consultants — you'll understand it in minutes.",
      },
      {
        q: "Does everything work in Spanish?",
        a: "Yes. The whole platform — calls, estimates, messages, your website — works in English, Spanish, or both.",
      },
      {
        q: "What happens to my data if I cancel?",
        a: "Your Google Sheet is in your own Google Drive and stays with you. You can also export everything to CSV anytime.",
      },
      {
        q: "Do you replace my phone or my tools?",
        a: "No. HandyAlliance works alongside how you already work — your phone, your customers, your Google account.",
      },
    ],
  },

  ctaBanner: {
    title: "Ready to stay organized?",
    sub: "Start free with the Job Tracker. Add tools when you need them.",
    ctaPrimary: "Choose My Tools",
    ctaSecondary: "Get All Tools — Save 30%",
  },

  footer: {
    tagline: "Simple tools for home service pros.",
    toolsHeading: "Tools",
    productHeading: "Product",
    languageHeading: "Language",
    legalNote: "Terms of Service and Privacy Policy are being finalized and will be published here.",
    rights: "All rights reserved.",
  },

  auth: {
    signIn: {
      title: "Welcome back",
      sub: "Sign in to your HandyAlliance account.",
      email: "Email",
      password: "Password",
      submit: "Sign In",
      magic: "Email me a sign-in link",
      google: "Sign in with Google",
      divider: "or",
      noAccount: "New to HandyAlliance?",
      switchLink: "Create a free account",
      note: "Sign-in opens with the platform launch. This page is a preview.",
    },
    signUp: {
      title: "Create your free account",
      sub: "Start with the free Job Tracker. Add paid tools whenever you're ready.",
      email: "Email",
      password: "Password",
      submit: "Create Account",
      google: "Sign up with Google",
      divider: "or",
      hasAccount: "Already have an account?",
      switchLink: "Sign in",
      note: "Sign-up opens with the platform launch. This page is a preview.",
      perks: ["Free Job Tracker included", "No credit card required", "English & Spanish"],
    },
  },

  trackerSample: {
    columns: { customer: "Customer", service: "Service", status: "Status", amount: "Amount", date: "Date" },
    rows: [
      { customer: "John Smith", service: "Faucet Replacement", status: "Estimate Sent", amount: "$280", date: "Fri, 2:00 PM" },
      { customer: "Maria Lopez", service: "Deep Cleaning", status: "Scheduled", amount: "$180", date: "Mon, 9:00 AM" },
      { customer: "Dave Wilson", service: "TV Mounting", status: "Completed", amount: "$150", date: "Yesterday" },
    ],
    statuses: {
      newLead: "New Lead",
      estimateSent: "Estimate Sent",
      scheduled: "Scheduled",
      completed: "Completed",
      paid: "Paid",
    },
  },

  /** Signed-in platform area (Stage 1: auth, onboarding, dashboard shell, billing, admin). */
  platform: {
    common: {
      signOut: "Sign out",
      backToSite: "Back to site",
      loading: "Loading…",
      error: "Something went wrong. Please try again.",
    },
    authFlow: {
      magicLinkSent: "Check your email — we sent you a sign-in link.",
      confirmationSent: "Check your email to confirm your account.",
      invalidCredentials: "That email and password don't match. Try again.",
      passwordTooShort: "Password must be at least 8 characters.",
      genericError: "Sign-in isn't working right now. Please try again in a minute.",
      notConfigured: "Sign-in isn't open yet. Please check back soon.",
      working: "One moment…",
    },
    onboarding: {
      title: "Set up your company",
      sub: "One quick step — this information powers all your tools.",
      businessName: "Business name",
      businessNamePlaceholder: "e.g. Smith Plumbing",
      trade: "Your trade",
      language: "Preferred language for your business",
      timezone: "Time zone",
      submit: "Create my workspace",
      creating: "Creating your workspace…",
      errorRequired: "Please enter your business name.",
      errorGeneric: "We couldn't create your workspace. Please try again.",
    },
    dashboard: {
      title: "Dashboard",
      planFree: "Free plan",
      planPaid: "Paid tools active",
      cards: {
        newLeads: "New Leads",
        estimatesWaiting: "Estimates Waiting",
        jobsThisWeek: "Jobs This Week",
        unpaidJobs: "Unpaid Jobs",
        callsAnswered: "Calls Answered",
        followUpsDue: "Follow-Ups Due",
      },
      comingSoon: "Coming soon",
      trackerTeaser: "Your Job Tracker is being built right now — it arrives in the next update.",
      nextStepTitle: "Recommended next step",
      nextStepChooseTool: "Explore the paid tools and pick the one that saves you the most time.",
      nextStepSeePricing: "See tools & pricing",
      toolsTitle: "Your tools",
      toolStates: {
        active: "Active",
        setup_required: "Setup required",
        trial: "Trial",
        not_active: "Not active",
        payment_issue: "Payment issue",
        usage_limit_reached: "Limit reached",
        disconnected: "Disconnected",
      },
      navDashboard: "Dashboard",
      navBilling: "Billing",
    },
    /**
     * Job Tracker (§13). `statuses`, `paymentStatuses`, `priorities`,
     * `leadSources` and `views` are the display layer of the stable codes in
     * `src/features/jobs/model.ts` (§13.6) — the codes never change, these
     * strings do.
     */
    jobs: {
      views: {
        all_jobs: "All Jobs",
        new_leads: "New Leads",
        estimates: "Estimates",
        scheduled: "Scheduled",
        in_progress: "In Progress",
        completed: "Completed",
        unpaid: "Unpaid",
        lost: "Lost",
      },
      statuses: {
        new_lead: "New Lead",
        contacted: "Contacted",
        estimate_draft: "Estimate Draft",
        estimate_sent: "Estimate Sent",
        estimate_accepted: "Estimate Accepted",
        scheduled: "Scheduled",
        in_progress: "In Progress",
        completed: "Completed",
        paid: "Paid",
        lost: "Lost",
        canceled: "Canceled",
      },
      priorities: {
        normal: "Normal",
        urgent: "Urgent",
      },
      paymentStatuses: {
        unpaid: "Unpaid",
        partial: "Partly paid",
        paid: "Paid",
        refunded: "Refunded",
      },
      leadSources: {
        phone_call: "Phone call",
        website: "Website",
        thumbtack: "Thumbtack",
        yelp: "Yelp",
        google: "Google",
        referral: "Referral",
        other: "Other",
      },
      sorts: {
        newest: "Newest first",
        oldest: "Oldest first",
        scheduled: "By scheduled date",
        amount: "By job total",
      },
      fieldErrors: {
        required: "This field is required.",
        too_long: "This is too long — please shorten it.",
        invalid_email: "Enter a valid email address.",
        invalid_amount: "Enter an amount like 280 or 280.50.",
        invalid_date: "Enter a valid date and time.",
        invalid_choice: "Choose one of the options.",
        schedule_order: "The end time cannot be before the start time.",
      },
    },
    billing: {
      title: "Billing",
      sub: "Subscribe to tools one by one, or get All Tools and save about 30%.",
      includedFree: "Included free",
      subscribe: "Subscribe",
      subscribed: "Active",
      manage: "Manage billing",
      manageHint: "Update your card, view invoices, or cancel in the secure Stripe portal.",
      redirecting: "Opening secure checkout…",
      notConfigured: "Payments open with the platform launch. Prices are final — you can start with the free Job Tracker today.",
      alreadySubscribed: "You already have this tool.",
      upgradeFlowRequired: "To switch between single tools and All Tools, contact support — the self-serve upgrade is coming soon.",
      errorGeneric: "Checkout didn't start. Please try again.",
    },
    admin: {
      title: "Platform admin",
      sub: "Internal operations. Every sensitive action is audit-logged.",
      organizations: "Organizations",
      totalOrganizations: "Total organizations",
      name: "Name",
      trade: "Trade",
      status: "Status",
      created: "Created",
      empty: "No organizations yet.",
    },
  },
};

export type Dict = typeof en;
