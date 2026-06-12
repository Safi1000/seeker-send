export type SearchStatus =
  | "Pending Search"
  | "Found"
  | "Inconclusive"
  | "Not Found"
  | "Ready To Send"
  | "Email Sent"
  | "Email Failed";

export type RfqStatus = "Processing" | "Ready" | "Sent" | "Partial" | "Failed";

export interface Supplier {
  id: string;
  name: string;
  website: string;
  productLink: string;
  email: string;
  confidence: number;
  status: "Pending" | "Approved" | "Rejected";
}

export interface RfqItem {
  id: string;
  itemNumber: number;
  partNumber: string;
  manufacturer: string;
  product: string;
  boxSize?: string;
  application?: string;
  analyzerModel?: string;
  tagNumber?: string;
  quantity: number;
  unit: string;
  status: SearchStatus;
  suppliers: Supplier[];
}

export interface Rfq {
  id: string;
  number: string;
  uploadDate: string;
  totalItems: number;
  status: RfqStatus;
  items: RfqItem[];
}

export const rfqs: Rfq[] = [
  {
    id: "rfq-2401",
    number: "RFQ-2024-0142",
    uploadDate: "2026-06-10",
    totalItems: 8,
    status: "Ready",
    items: [
      {
        id: "item-1",
        itemNumber: 1,
        partNumber: "2010B-2111-MS",
        manufacturer: "Servomex",
        product: "Oxygen Analyzer Sensor Cell",
        boxSize: "1",
        application: "Combustion control",
        analyzerModel: "SERVOTOUGH OxyExact 2200",
        tagNumber: "AT-4501",
        quantity: 2,
        unit: "pcs",
        status: "Found",
        suppliers: [
          {
            id: "s1",
            name: "Servomex Direct",
            website: "servomex.com",
            productLink: "https://servomex.com/parts/2010b-2111-ms",
            email: "sales@servomex.com",
            confidence: 0.98,
            status: "Approved",
          },
          {
            id: "s2",
            name: "ProcessAnalytics Inc.",
            website: "processanalytics.com",
            productLink: "https://processanalytics.com/p/2010b",
            email: "quotes@processanalytics.com",
            confidence: 0.82,
            status: "Pending",
          },
        ],
      },
      {
        id: "item-2",
        itemNumber: 2,
        partNumber: "M400-FF-N1",
        manufacturer: "Mettler Toledo",
        product: "pH Transmitter",
        boxSize: "1",
        application: "Effluent monitoring",
        analyzerModel: "M400",
        tagNumber: "AIT-2210",
        quantity: 4,
        unit: "pcs",
        status: "Ready To Send",
        suppliers: [
          {
            id: "s3",
            name: "Mettler Toledo Process",
            website: "mt.com",
            productLink: "https://mt.com/m400",
            email: "process.sales@mt.com",
            confidence: 0.96,
            status: "Approved",
          },
        ],
      },
      {
        id: "item-3",
        itemNumber: 3,
        partNumber: "FCX-AIII-V5",
        manufacturer: "Fuji Electric",
        product: "Differential Pressure Transmitter",
        quantity: 1,
        unit: "pc",
        status: "Inconclusive",
        suppliers: [
          { id: "s4", name: "Fuji Instruments EU", website: "fujielectric.com", productLink: "#", email: "info@fujielectric.eu", confidence: 0.61, status: "Pending" },
          { id: "s5", name: "Industrial Reps Ltd.", website: "indreps.com", productLink: "#", email: "rfq@indreps.com", confidence: 0.54, status: "Pending" },
          { id: "s6", name: "Global Process Supply", website: "gpsupply.io", productLink: "#", email: "team@gpsupply.io", confidence: 0.49, status: "Pending" },
        ],
      },
      {
        id: "item-4",
        itemNumber: 4,
        partNumber: "ROSEMOUNT-3051S",
        manufacturer: "Emerson",
        product: "Pressure Transmitter",
        quantity: 6,
        unit: "pcs",
        status: "Email Sent",
        suppliers: [
          { id: "s7", name: "Emerson Authorized", website: "emerson.com", productLink: "#", email: "auth@emerson.com", confidence: 0.99, status: "Approved" },
        ],
      },
      {
        id: "item-5",
        itemNumber: 5,
        partNumber: "X-9921-CUSTOM",
        manufacturer: "Unknown",
        product: "Custom analyzer manifold",
        quantity: 1,
        unit: "set",
        status: "Not Found",
        suppliers: [],
      },
      {
        id: "item-6",
        itemNumber: 6,
        partNumber: "SI-7720-O3",
        manufacturer: "Siemens",
        product: "Ozone Sensor Module",
        quantity: 2,
        unit: "pcs",
        status: "Email Failed",
        suppliers: [
          { id: "s8", name: "Siemens Process Instruments", website: "siemens.com", productLink: "#", email: "process@siemens.com", confidence: 0.91, status: "Approved" },
        ],
      },
      {
        id: "item-7",
        itemNumber: 7,
        partNumber: "ABB-AZ20",
        manufacturer: "ABB",
        product: "Zirconia Oxygen Analyzer",
        quantity: 1,
        unit: "pc",
        status: "Pending Search",
        suppliers: [],
      },
      {
        id: "item-8",
        itemNumber: 8,
        partNumber: "YOK-EJX110A",
        manufacturer: "Yokogawa",
        product: "DP Transmitter",
        quantity: 3,
        unit: "pcs",
        status: "Found",
        suppliers: [
          { id: "s9", name: "Yokogawa Direct", website: "yokogawa.com", productLink: "#", email: "sales@yokogawa.com", confidence: 0.94, status: "Pending" },
        ],
      },
    ],
  },
  {
    id: "rfq-2402",
    number: "RFQ-2024-0141",
    uploadDate: "2026-06-08",
    totalItems: 5,
    status: "Sent",
    items: [],
  },
  {
    id: "rfq-2403",
    number: "RFQ-2024-0140",
    uploadDate: "2026-06-05",
    totalItems: 12,
    status: "Partial",
    items: [],
  },
  {
    id: "rfq-2404",
    number: "RFQ-2024-0139",
    uploadDate: "2026-06-02",
    totalItems: 3,
    status: "Processing",
    items: [],
  },
];

export const dashboardStats = {
  rfqsUploaded: 24,
  itemsProcessed: 187,
  suppliersFound: 412,
  emailsSent: 134,
  emailsFailed: 6,
};

export function findRfq(id: string) {
  return rfqs.find((r) => r.id === id);
}

export function findItem(itemId: string) {
  for (const r of rfqs) {
    const item = r.items.find((i) => i.id === itemId);
    if (item) return { rfq: r, item };
  }
  return null;
}

export const allItems = rfqs.flatMap((r) =>
  r.items.map((i) => ({ ...i, rfqNumber: r.number, rfqId: r.id })),
);

export const defaultEmailTemplate = `Dear {{supplier_name}},

We are requesting a quotation for the following item:

Part Number: {{part_number}}
Manufacturer: {{manufacturer}}
Product: {{product}}
Quantity: {{quantity}} {{unit}}

Please provide:
- Unit price and total
- Lead time
- Validity of offer
- Payment terms

Best regards,
Procurement Team`;