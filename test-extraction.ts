import { extractRealEstateDataEnhanced } from "./server/enhancedArabicExtraction";

const testMessages = [
  "مرحبا، أنا أبحث عن شقة في مدينتي B12، بسعر من 2 إلى 3 مليون جنيه، 3 غرف نوم، حوالي 150 متر مربع. اسمي أحمد، رقمي 01012345678",
  "عندي فيلا في التجمع الخامس، 5 غرف، 500 متر، السعر 15 مليون. للبيع. اتصل بي: محمد - 01098765432",
  "بدور على شقة في الرحاب، 2 غرف، إيجار شهري من 5 إلى 8 آلاف. اسمي فاطمة، 01156789012"
];

async function test() {
  console.log("Testing enhanced Arabic extraction...\n");
  
  for (const msg of testMessages) {
    console.log(`Message: ${msg}\n`);
    try {
      const result = await extractRealEstateDataEnhanced(msg);
      console.log("Extracted:", JSON.stringify(result, null, 2));
      console.log("---\n");
    } catch (e) {
      console.error("Error:", e);
    }
  }
}

test();
