export const eventTypeDefaults: Record<
  string,
  {
    serviceForm: string;
    modules: string[];
    defaultMenuKeywords: string[];
    infrastructure: string[];
    durationHours: number;
  }
> = {
  meeting: {
    serviceForm: "coffee_break",
    modules: ["coffee-station", "pastry-assortment", "water-service"],
    defaultMenuKeywords: ["kaffee", "tee", "croissant"],
    infrastructure: ["coffee_station", "glassware"],
    durationHours: 3
  },
  conference: {
    serviceForm: "buffet",
    modules: ["buffet-lunch", "coffee-station", "water-service"],
    defaultMenuKeywords: ["lunch buffet", "salad", "soup"],
    infrastructure: ["buffet_line", "coffee_station", "cooling"],
    durationHours: 8
  },
  reception: {
    serviceForm: "standing_reception",
    modules: ["flying-bites", "aperitif", "service-equipment"],
    defaultMenuKeywords: ["canape", "sparkling wine"],
    infrastructure: ["bar_station", "glassware"],
    durationHours: 4
  },
  lunch: {
    serviceForm: "buffet",
    modules: ["buffet-lunch", "soft-drinks", "service-equipment"],
    defaultMenuKeywords: ["salad", "main course", "dessert"],
    infrastructure: ["buffet_line", "cutlery"],
    durationHours: 2
  },
  dinner: {
    serviceForm: "plated",
    modules: ["fine-dining", "wine-pairing", "table-setting"],
    defaultMenuKeywords: ["starter", "main course", "dessert"],
    infrastructure: ["tableware", "service_station"],
    durationHours: 4
  },
  trade_fair: {
    serviceForm: "grab_and_go",
    modules: ["fair-snacks", "coffee-station", "branding-setup"],
    defaultMenuKeywords: ["finger food", "coffee", "juice"],
    infrastructure: ["presentation_furniture", "cooling"],
    durationHours: 8
  }
};

export const serviceFormKeywords: Record<string, string> = {
  buffet: "buffet",
  lunchbuffet: "buffet",
  plated: "plated",
  sitdown: "plated",
  flying: "standing_reception",
  empfang: "standing_reception",
  messe: "grab_and_go",
  coffeebreak: "coffee_break",
  kaffeepause: "coffee_break"
};

export const eventTypeKeywords: Record<string, string> = {
  meeting: "meeting",
  workshop: "meeting",
  konferenz: "conference",
  conference: "conference",
  symposium: "conference",
  empfang: "reception",
  reception: "reception",
  lunch: "lunch",
  mittagessen: "lunch",
  dinner: "dinner",
  abendessen: "dinner",
  fine: "dinner",
  messe: "trade_fair",
  trade: "trade_fair"
};

export const infrastructureCatalog = {
  coffee_station: "Kaffeestation",
  glassware: "Gläser und Wasserservice",
  buffet_line: "Buffet- und Ausgabeinfrastruktur",
  cooling: "Kühlschränke / Kühlung",
  bar_station: "Bar- und Aperitifstation",
  cutlery: "Besteck, Geschirr und Gläser",
  tableware: "Tisch- und Serviceausstattung",
  service_station: "Service-Backoffice / Stationen",
  presentation_furniture: "Präsentationsmöbel",
  mobile_kitchen: "Mobile Küche"
};

export const moduleCatalog: Record<
  string,
  {
    label: string;
    category: string;
    pricingModel: "per_person" | "flat";
    amount: number;
  }
> = {
  "coffee-station": {
    label: "Kaffeestation mit Filterkaffee und Tee",
    category: "beverage",
    pricingModel: "per_person",
    amount: 7.5
  },
  "pastry-assortment": {
    label: "Süßes Gebäck / Croissant-Auswahl",
    category: "food",
    pricingModel: "per_person",
    amount: 5.5
  },
  "water-service": {
    label: "Wasser und Saftauswahl",
    category: "beverage",
    pricingModel: "per_person",
    amount: 3.2
  },
  "buffet-lunch": {
    label: "Lunchbuffet",
    category: "food",
    pricingModel: "per_person",
    amount: 21
  },
  "soft-drinks": {
    label: "Softdrinks und Wasser",
    category: "beverage",
    pricingModel: "per_person",
    amount: 4.5
  },
  "service-equipment": {
    label: "Service- und Ausgabeausstattung",
    category: "infrastructure",
    pricingModel: "flat",
    amount: 180
  },
  "fine-dining": {
    label: "Fine-Dining-Menü",
    category: "food",
    pricingModel: "per_person",
    amount: 58
  },
  "wine-pairing": {
    label: "Weinbegleitung",
    category: "beverage",
    pricingModel: "per_person",
    amount: 18
  },
  "table-setting": {
    label: "Tischsetting und Dekoration",
    category: "infrastructure",
    pricingModel: "flat",
    amount: 320
  },
  "flying-bites": {
    label: "Flying Bites Auswahl",
    category: "food",
    pricingModel: "per_person",
    amount: 26
  },
  aperitif: {
    label: "Aperitif und Schaumwein",
    category: "beverage",
    pricingModel: "per_person",
    amount: 12
  },
  "fair-snacks": {
    label: "Messe-Snacks und Fingerfood",
    category: "food",
    pricingModel: "per_person",
    amount: 15
  },
  "branding-setup": {
    label: "Gebrandete Ausgabe- und Präsentationsfläche",
    category: "infrastructure",
    pricingModel: "flat",
    amount: 250
  }
};

export const unitNormalization: Record<string, string> = {
  g: "g",
  gram: "g",
  grams: "g",
  kg: "kg",
  ml: "ml",
  l: "l",
  stueck: "pcs",
  stück: "pcs",
  piece: "pcs",
  pcs: "pcs"
};

export const ingredientGroupHints: Record<string, string> = {
  coffee: "beverages",
  water: "beverages",
  tea: "beverages",
  milk: "dairy",
  butter: "dairy",
  cream: "dairy",
  lettuce: "produce",
  tomato: "produce",
  salad: "produce",
  bread: "bakery",
  croissant: "bakery",
  flour: "dry_goods",
  salt: "dry_goods",
  sugar: "dry_goods",
  chicken: "protein",
  beef: "protein",
  fish: "protein",
  pasta: "dry_goods"
};

