export type NumberStatus = "live" | "paused";

export type PhoneNumber = {
  id: string;
  label: string;
  number: string;
  kind: string;
  provider: string;
  status: NumberStatus;
};

export const NUMBERS: PhoneNumber[] = [
  {
    id: "1",
    label: "Front desk",
    number: "+1 415 555 0132",
    kind: "Main line",
    provider: "Twilio",
    status: "live",
  },
  {
    id: "2",
    label: "Billing support",
    number: "+91 80 4567 8901",
    kind: "Toll-free",
    provider: "Exotel",
    status: "live",
  },
  {
    id: "3",
    label: "Order status",
    number: "+1 888 555 0187",
    kind: "Toll-free",
    provider: "Telnyx",
    status: "live",
  },
  {
    id: "4",
    label: "Collections",
    number: "+91 80 6754 3210",
    kind: "Mobile",
    provider: "Vobiz",
    status: "paused",
  },
  {
    id: "5",
    label: "Sales line",
    number: "+1 800 555 0144",
    kind: "Toll-free",
    provider: "Plivo",
    status: "paused",
  },
];
