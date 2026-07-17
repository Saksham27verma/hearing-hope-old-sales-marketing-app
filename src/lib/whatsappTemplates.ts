/** Template options shown in the WhatsApp picker (Pinnacle keys + labels). */
export type WhatsAppTemplateOption = {
  key: string;
  label: string;
  /** Fallback body when no milestone rule message is available */
  defaultMessage: string;
};

export const WHATSAPP_TEMPLATE_OPTIONS: WhatsAppTemplateOption[] = [
  {
    key: 'service_6mo',
    label: '6-month service',
    defaultMessage:
      'Hi {{customerName}}, your Hearing Hope device purchased on {{saleDate}} ({{reference}}) is due for a 6-month service checkup. Please call us to book your appointment.',
  },
  {
    key: 'service_1yr',
    label: '1-year service',
    defaultMessage:
      'Hi {{customerName}}, your Hearing Hope device purchased on {{saleDate}} ({{reference}}) is due for annual servicing. Please call us to schedule.',
  },
  {
    key: 'upgrade_2yr',
    label: '2-year upgrade',
    defaultMessage:
      'Hi {{customerName}}, it has been 2 years since your purchase on {{saleDate}} ({{reference}}). We have upgrade and trade-in options available — reply or call Hearing Hope.',
  },
  {
    key: 'general_followup',
    label: 'General follow-up',
    defaultMessage:
      'Hi {{customerName}}, this is Hearing Hope following up regarding your purchase on {{saleDate}} ({{reference}}). How can we help you today?',
  },
];
