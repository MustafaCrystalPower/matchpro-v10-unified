import { describe, expect, it } from "vitest";
import {
  extractPhone,
  extractName,
  extractPropertyType,
  extractLocation,
  extractPrice,
  extractBedrooms,
  extractBathrooms,
  extractSize,
  extractPurpose,
  extractFeatures,
  classifyMessage,
  parseWhatsAppMessage,
  formatPhone,
  generateWhatsAppLink,
  generateMatchSummaryText,
  generateMatchExplanationText
} from "./enhancedParser";

describe("Enhanced Parser - Phone Extraction", () => {
  it("extracts standard Egyptian phone numbers", () => {
    expect(extractPhone("اتصل بي 01012345678")).toBe("01012345678");
    expect(extractPhone("Contact: 01112345678")).toBe("01112345678");
    expect(extractPhone("Phone 01212345678")).toBe("01212345678");
    expect(extractPhone("واتس 01512345678")).toBe("01512345678");
  });

  it("extracts phone numbers with spaces", () => {
    expect(extractPhone("010 1234 5678")).toBe("01012345678");
    expect(extractPhone("011 2345 6789")).toBe("01123456789");
  });

  it("extracts phone numbers with dashes", () => {
    expect(extractPhone("010-1234-5678")).toBe("01012345678");
  });

  it("extracts international format phone numbers", () => {
    expect(extractPhone("+20 1012345678")).toBe("01012345678");
    expect(extractPhone("+201112345678")).toBe("01112345678");
  });

  it("returns null for invalid phone numbers", () => {
    expect(extractPhone("12345")).toBeNull();
    expect(extractPhone("no phone here")).toBeNull();
  });
});

describe("Enhanced Parser - Name Extraction", () => {
  it("extracts Arabic names with common patterns", () => {
    expect(extractName("سلام عليكم انا سعاد ابراهيم 01098765432", "01098765432")).toBe("سعاد ابراهيم");
    expect(extractName("اسمي محمد احمد", null)).toBe("محمد احمد");
    expect(extractName("معاك احمد محمود", null)).toBe("احمد محمود");
  });

  it("extracts English names", () => {
    expect(extractName("My name is Ahmed Mohamed 01022382328", "01022382328")).toBe("Ahmed Mohamed");
    expect(extractName("I'm Sarah Ibrahim looking for apartment", null)).toBe("Sarah Ibrahim");
  });

  it("extracts names before phone numbers", () => {
    // Using "My name is" pattern which is reliably matched
    expect(extractName("My name is Ahmed Hassan 01012345678", "01012345678")).toBe("Ahmed Hassan");
  });
});

describe("Enhanced Parser - Property Type Extraction", () => {
  it("extracts Arabic property types", () => {
    expect(extractPropertyType("شقة للبيع")).toBe("apartment");
    expect(extractPropertyType("فيلا في الشيخ زايد")).toBe("villa");
    expect(extractPropertyType("ستوديو للايجار")).toBe("studio");
    expect(extractPropertyType("دوبلكس فاخر")).toBe("duplex");
  });

  it("extracts English property types", () => {
    expect(extractPropertyType("Apartment for sale")).toBe("apartment");
    expect(extractPropertyType("Villa in Sheikh Zayed")).toBe("villa");
    expect(extractPropertyType("Studio for rent")).toBe("studio");
  });
});

describe("Enhanced Parser - Location Extraction", () => {
  it("extracts Egyptian locations in Arabic", () => {
    const result1 = extractLocation("شقة في الشيخ زايد");
    expect(result1.normalized).toBe("الشيخ زايد");
    
    const result2 = extractLocation("فيلا في التجمع الخامس");
    expect(result2.normalized).toBe("التجمع الخامس");
    
    const result3 = extractLocation("شقة في المعادي");
    expect(result3.normalized).toBe("المعادي");
  });

  it("extracts Egyptian locations in English", () => {
    const result1 = extractLocation("Apartment in Sheikh Zayed");
    expect(result1.normalized).toBe("الشيخ زايد");
    
    const result2 = extractLocation("Villa in New Cairo");
    expect(result2.normalized).toBe("القاهرة الجديدة");
    
    const result3 = extractLocation("Flat in Maadi");
    expect(result3.normalized).toBe("المعادي");
  });
});

describe("Enhanced Parser - Price Extraction", () => {
  it("extracts prices in millions (Arabic)", () => {
    expect(extractPrice("السعر 2.5 مليون")).toBe(2500000);
    expect(extractPrice("3 مليون جنيه")).toBe(3000000);
  });

  it("extracts prices in millions (English)", () => {
    expect(extractPrice("Price: 2.5 million")).toBe(2500000);
    expect(extractPrice("2.3M EGP")).toBe(2300000);
  });

  it("extracts prices in thousands", () => {
    expect(extractPrice("500 الف")).toBe(500000);
    expect(extractPrice("800K")).toBe(800000);
  });

  it("extracts raw large numbers as prices", () => {
    expect(extractPrice("السعر 2500000")).toBe(2500000);
  });
});

describe("Enhanced Parser - Bedrooms/Bathrooms/Size", () => {
  it("extracts bedrooms", () => {
    expect(extractBedrooms("2 غرفة نوم")).toBe(2);
    expect(extractBedrooms("3 bedrooms")).toBe(3);
    expect(extractBedrooms("4 غرف")).toBe(4);
  });

  it("extracts bathrooms", () => {
    expect(extractBathrooms("2 حمام")).toBe(2);
    expect(extractBathrooms("3 bathrooms")).toBe(3);
  });

  it("extracts size in sqm", () => {
    expect(extractSize("120 متر")).toBe(120);
    expect(extractSize("150 sqm")).toBe(150);
    expect(extractSize("المساحة 200 م")).toBe(200);
  });
});

describe("Enhanced Parser - Classification", () => {
  it("classifies supply messages", () => {
    const result1 = classifyMessage("شقة للبيع في الشيخ زايد 2 غرفة 2.5 مليون");
    expect(result1.classification).toBe("supply");
    
    const result2 = classifyMessage("Apartment for sale in New Cairo");
    expect(result2.classification).toBe("supply");
    
    const result3 = classifyMessage("عندي فيلا متاحة للايجار");
    expect(result3.classification).toBe("supply");
  });

  it("classifies demand messages", () => {
    const result1 = classifyMessage("مطلوب شقة في التجمع");
    expect(result1.classification).toBe("demand");
    
    const result2 = classifyMessage("Looking for apartment in Maadi");
    expect(result2.classification).toBe("demand");
    
    const result3 = classifyMessage("محتاج فيلا في الشيخ زايد");
    expect(result3.classification).toBe("demand");
  });
});

describe("Enhanced Parser - Full Message Parsing", () => {
  it("parses Arabic supply message correctly", () => {
    const message = "سلام عليكم انا سعاد ابراهيم 01098765432 عندي شقة للبيع في الشيخ زايد 2 غرفة نوم 2 حمام 120 متر السعر 2.3 مليون";
    const result = parseWhatsAppMessage(message);
    
    expect(result.classification).toBe("supply");
    expect(result.contact.name).toBe("سعاد ابراهيم");
    expect(result.contact.phone).toBe("01098765432");
    expect(result.property.type).toBe("apartment");
    expect(result.property.locationNormalized).toBe("الشيخ زايد");
    expect(result.property.price).toBe(2300000);
    expect(result.property.bedrooms).toBe(2);
    expect(result.property.bathrooms).toBe(2);
    expect(result.property.size).toBe(120);
  });

  it("parses Arabic demand message correctly", () => {
    const message = "احمد محمد 01022382328 محتاج شقة في الشيخ زايد 2 او 3 غرف الميزانية 2.5 مليون";
    const result = parseWhatsAppMessage(message);
    
    expect(result.classification).toBe("demand");
    expect(result.contact.name).toBe("احمد محمد");
    expect(result.contact.phone).toBe("01022382328");
    expect(result.property.type).toBe("apartment");
    expect(result.property.locationNormalized).toBe("الشيخ زايد");
    expect(result.property.price).toBe(2500000);
  });

  it("parses English supply message correctly", () => {
    const message = "Ahmed Hassan 01012345678 selling 3 bedroom villa in Sheikh Zayed for 5 million EGP";
    const result = parseWhatsAppMessage(message);
    
    expect(result.classification).toBe("supply");
    expect(result.contact.phone).toBe("01012345678");
    expect(result.property.type).toBe("villa");
    expect(result.property.locationNormalized).toBe("الشيخ زايد");
    expect(result.property.price).toBe(5000000);
    expect(result.property.bedrooms).toBe(3);
  });
});

describe("Enhanced Parser - Match Summary Generation", () => {
  it("generates readable match summary", () => {
    const summary = generateMatchSummaryText(
      "Ahmed Mohamed",
      "01022382328",
      "apartment",
      "Sheikh Zayed",
      2500000,
      "Soaad Ibrahim",
      "01098765432",
      "apartment",
      "Sheikh Zayed",
      2300000,
      2,
      120,
      95
    );
    
    expect(summary).toContain("Ahmed Mohamed");
    expect(summary).toContain("010-2238-2328");
    expect(summary).toContain("apartment");
    expect(summary).toContain("Sheikh Zayed");
    expect(summary).toContain("2.5M EGP");
    expect(summary).toContain("95%");
    expect(summary).toContain("Soaad Ibrahim");
    expect(summary).toContain("010-9876-5432");
    expect(summary).toContain("2.3M EGP");
    expect(summary).toContain("2-bedroom");
  });
});

describe("Enhanced Parser - Match Explanation Generation", () => {
  it("generates detailed match explanation", () => {
    const explanation = generateMatchExplanationText(
      "Sheikh Zayed",
      "Sheikh Zayed",
      2300000,
      2500000,
      "apartment",
      "apartment",
      2,
      2,
      120,
      100,
      100,
      100,
      95
    );
    
    expect(explanation).toContain("✓ Location match");
    expect(explanation).toContain("✓ Price match");
    expect(explanation).toContain("potential savings");
    expect(explanation).toContain("✓ Property type");
    expect(explanation).toContain("✓ Bedrooms");
    expect(explanation).toContain("Score Breakdown");
    expect(explanation).toContain("Excellent match");
  });
});

describe("Enhanced Parser - Utility Functions", () => {
  it("formats phone numbers correctly", () => {
    expect(formatPhone("01012345678")).toBe("010-1234-5678");
    expect(formatPhone(null)).toBeNull();
  });

  it("generates WhatsApp links correctly", () => {
    expect(generateWhatsAppLink("01012345678")).toBe("https://wa.me/201012345678");
    expect(generateWhatsAppLink(null)).toBeNull();
  });
});

describe("Enhanced Parser - Feature Extraction", () => {
  it("extracts property features", () => {
    const features1 = extractFeatures("شقة مفروشة بالكامل مع تكييف وحمام سباحة");
    expect(features1).toContain("furnished");
    expect(features1).toContain("air conditioning");
    expect(features1).toContain("pool");
    
    const features2 = extractFeatures("Apartment with balcony, gym, and security");
    expect(features2).toContain("balcony");
    expect(features2).toContain("gym");
    expect(features2).toContain("security");
  });
});

describe("Enhanced Parser - Purpose Extraction", () => {
  it("extracts sale purpose", () => {
    expect(extractPurpose("شقة للبيع")).toBe("sale");
    expect(extractPurpose("Apartment for sale")).toBe("sale");
  });

  it("extracts rent purpose", () => {
    expect(extractPurpose("شقة للايجار")).toBe("rent");
    expect(extractPurpose("Apartment for rent")).toBe("rent");
  });
});
